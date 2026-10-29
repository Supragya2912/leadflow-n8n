# LeadFlow: n8n + GoHighLevel Lead Automation

Three importable n8n workflows that match common Upwork automation jobs,
plus a 4-week learning plan and a checklist for turning them into Upwork
portfolio pieces.

| # | Workflow | Upwork job it matches | Skills it shows |
|---|----------|-----------------------|-----------------|
| 01 | Lead intake → GHL | "Connect my website/Typeform/Facebook leads to GoHighLevel" | Webhook, expressions, IF, Code, HTTP Request, GHL API v2, retries |
| 02 | Google Sheets → GHL sync | "Import/sync contacts from a spreadsheet into my CRM" | Schedule trigger, Loop Over Items, rate limiting, writing results back |
| 03 | Error handler → Slack | "What happens when it breaks?" (every client asks) | Error Trigger, error workflows, alerting |

---

## 1. Setup (10 minutes)

```bash
npx n8n
```

Open http://localhost:5678 and create the owner account. Data is stored in `~/.n8n`.

You can also use **n8n Cloud** (free trial). It gives you a public webhook URL
without tunnelling, which helps when a client's form must reach your workflow.

**Import a workflow:** Workflows → *Create* → ⋯ menu → *Import from File* → choose a file in `workflows/`.

### Practise without a GHL account

```bash
node mock-ghl-server.js
```

This starts a fake GHL API at `http://localhost:4010`. In each workflow's
**Config** node, set `ghlBaseUrl` to `http://localhost:4010`. For the Slack
alert, use `http://localhost:4010/slack`. Any email containing `fail` gets
HTTP 500, so you can watch retries and the error workflow fire.
`http://localhost:4010/_log` lists every request the mock received.

### Connect the real GoHighLevel

1. In your GHL **sub-account**, go to *Settings → Private Integrations → Create new*.
   Give it the scopes `contacts.write`, `contacts.readonly`, `opportunities.write` and `opportunities.readonly`. Copy the token.
2. In n8n, go to *Credentials → New → Header Auth*:
   - Name: `GHL Private Integration`
   - Header name: `Authorization`
   - Value: `Bearer <your token>`
3. Find your **Location ID** under *Settings → Business Profile*, or in the URL `/location/<id>/`.
4. Find your **Pipeline** and **Stage IDs** by calling `GET /opportunities/pipelines?locationId=...`
   from an HTTP Request node. This is good practice too.
5. Fill those values into the **Config** node of each workflow.

API docs: https://highlevel.stoplight.io/docs/integrations. Every call needs
the header `Version: 2021-07-28`. The rate limit is about 100 requests per
10 seconds per location. That limit is why workflow 02 throttles its calls.

---

## 2. The workflows

### 01 · Lead Intake → GoHighLevel
`Webhook → Config → Validate & Score (Code) → Valid? → Upsert Contact → Add Tags → Qualified? → Create Opportunity → Respond`

- It **upserts** contacts instead of creating them, so a repeat submission does not create a duplicate. Clients love this.
- The Code node cleans up the name, email and phone and scores the lead as hot, warm or cold.
- Invalid data gets an HTTP **400** with the reasons. Good data gets a **200** with the contact ID.
- Every GHL call retries 3 times, 2 seconds apart. If GHL is still failing after that, the caller gets a **502**. The execution is then marked as failed, which fires the error workflow (03).

Test it after you activate the workflow:

```bash
curl -X POST http://localhost:5678/webhook/lead-intake -H 'Content-Type: application/json' -d '{"name":"Jane Doe","email":"jane@acme.com","phone":"+1 555 123 4567","company":"Acme","budget":6000,"message":"We need our Facebook lead ads pushed into GHL with tagging and pipeline stages."}'
```

### 02 · Google Sheets → GHL batch sync
`Schedule/Manual → Config → Read Sheet → Only Unsynced Rows → Loop Over Leads (10 at a time) → Upsert → Write Result Back → Wait 1s → loop … → Run Summary`

- Sheet tab `Leads`, columns: `first_name, last_name, email, phone, company, synced_at, ghl_contact_id, sync_error`.
- It only processes rows where `synced_at` is empty, so re-running it is safe.
- A failed row does not stop the run. The error is written to `sync_error` and the next run tries that row again.
- You need a Google Sheets OAuth credential in n8n. Open the *Write Result Back* node once after import so n8n loads the sheet's columns.

### 03 · Error Handler → Slack
`Error Trigger → Config → Format Alert → Send Slack Alert`

To use it, open workflows 01 and 02, go to *Settings → Error workflow* and pick this workflow.
Create the Slack incoming-webhook URL at https://api.slack.com/apps → *Incoming Webhooks*.

---

## 3. Learning plan (about 4 weeks, 1–2 hours a day)

| Week | Learn | Build or practise |
|------|-------|-------------------|
| 1 | n8n **Level 1** course (docs.n8n.io/courses). Triggers: Webhook, Schedule, Google Sheets/Forms trigger. Expressions: `{{ $json.email }}`, `$('Node Name').item.json`, `$now` | Import 01, run it against the mock server, and read every expression in it. Then rebuild it from scratch without looking. |
| 2 | **Level 2** course. IF, Switch, Merge, Loop Over Items, item linking | Import 02 and run it against a real sheet. Then add a **Switch** that routes leads to different GHL pipelines by `source`. |
| 3 | HTTP Request node in depth: auth, pagination, rate limits. The Code node: `$input.all()`, returning `[{json}]` | Call 5 new GHL endpoints yourself: search contacts, update an opportunity's stage, add a note, create a task, and list pipelines. |
| 4 | Error workflows, retries, `onError: continue`, credentials, and n8n's Executions log | Wire 03 to 01 and 02. Record Loom demos and publish everything (see section 4). |

Study 2–3 templates a week from https://n8n.io/workflows. Search "GoHighLevel", "lead", "CRM", "AI agent".
Open each template and work out why every node is there.

### Next portfolio pieces (in order of Upwork demand)
1. **AI lead qualifier.** Add an *AI Agent* or *OpenAI/Anthropic* node to 01 that reads `message`, writes a summary, and sets the score. "AI automation" is the hottest keyword on Upwork right now.
2. **Missed-call text-back / appointment reminder.** GHL webhook → n8n → SMS through GHL's conversations API.
3. **Facebook Lead Ads / Typeform → GHL + Slack notify.** Same pattern as 01 with a different trigger.
4. **Stripe payment → GHL opportunity "Won" + invoice email.**

---

## 4. Publishing for Upwork

### A. GitHub (your technical proof)
1. Create a public repo, for example `n8n-ghl-automations`, and push this folder.
2. **Before you push**, make sure the Config nodes hold only placeholders.
   n8n does *not* export credential secrets, but IDs and URLs you typed into nodes **are** exported.
3. Add a screenshot of each workflow canvas to `screenshots/`.

### B. Loom video (the thing that actually wins jobs)
Record 2–3 minutes per workflow:
1. State the client problem in one sentence.
2. Show the canvas.
3. Run it live: send the curl, then show the contact, tags and opportunity appearing in GHL.
4. Break it on purpose (`fail@test.com`) and show the Slack alert.
5. Close with what you would customise for their business.

### C. Upwork portfolio item (Profile → Portfolio → Add)
For each project:
- **Title:** "GoHighLevel Lead Intake Automation with n8n (Validation, Scoring, Pipeline)"
- **Your role:** "Automation Engineer – designed and built the full workflow"
- **Description:** *Problem → Solution → Result*. For example: "Website leads were typed into GHL by hand and often duplicated. Built an n8n workflow that validates and scores each lead, upserts it into GHL with tags, and opens a pipeline opportunity for qualified leads in under 2 seconds, with automatic retries and Slack alerts on failure."
- **Skills:** n8n, GoHighLevel, API Integration, JavaScript, Automation, Zapier (clients search for it, so list it)
- **Media:** canvas screenshot, a GHL "after" screenshot, and the Loom link.

### D. Profile and proposals
- **Headline:** "n8n & GoHighLevel Automation Expert | CRM, Lead Flows, AI Workflows"
- **Search terms to use:** `n8n`, `GoHighLevel`, `GHL automation`, `make.com`, `zapier`, `workflow automation`, `AI agent`.
- **Proposal template** (keep it under 120 words and personalise the first line):

> Hi [Name], you need [their exact problem in your words]. I built almost exactly this: [link to the matching Loom]. Leads come in by webhook, get validated, are upserted into GHL so there are no duplicates, get tagged, and land in the right pipeline stage. Failures retry automatically and alert Slack.
> For you I'd [1–2 specifics from their post]. Quick question: [one smart question about their setup, e.g. "Is the form on WordPress or Webflow?"].
> I can have a working first version in [X] days.

Start with small fixed-price jobs ($50–$200) to earn your first reviews. Then raise your rates.
