# LeadFlow: n8n + GoHighLevel Lead Automation

Production-style n8n workflows that capture, qualify and route leads into
GoHighLevel. They validate input, prevent duplicate contacts, retry failed
API calls and send an alert when something breaks.

| # | Workflow | What it does | Built with |
|---|----------|--------------|------------|
| 01 | Lead intake → GHL | Webhook lead → validate & score → upsert contact → tags & owner → pipeline opportunity | Webhook, Code (JS), IF, HTTP Request, GHL API v2 |
| 02 | Google Sheets → GHL sync | Hourly batch sync of new rows, rate-limit safe, writes results back to the sheet | Schedule, Loop Over Items, Google Sheets, Wait |
| 03 | Error handler → Slack | Posts a readable alert with the failing node and a link to the run | Error Trigger, Code, HTTP Request |

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

## Roadmap
- AI lead qualification: summarise the lead's message and adjust the score with an LLM node
- More lead sources: Facebook Lead Ads, Typeform, Calendly
- Missed-call text-back and appointment reminders through GHL conversations
