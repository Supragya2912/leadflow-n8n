// Tiny stand-in for the GoHighLevel API v2 (+ a Slack webhook), so you can
// build and demo workflows before you have a GHL account.
//   node mock-ghl-server.js        -> http://localhost:4010
// In n8n, set Config.ghlBaseUrl to http://localhost:4010 and the Slack URL to
// http://localhost:4010/slack. Any email containing "fail" returns HTTP 500,
// so you can demo retries and the error workflow.
// GET /_log shows every request received.
const http = require('http');

const PORT = Number(process.env.PORT) || 4010;
const log = [];
let nextId = 1;
const contactsByEmail = new Map();

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(res, 400, { message: 'Invalid JSON' });
      }
      const path = req.url.split('?')[0];
      log.push({ at: new Date().toISOString(), method: req.method, path, body });
      console.log(req.method, path, raw);

      if (req.method === 'GET' && path === '/_log') return send(res, 200, log);
      if (req.method === 'POST' && path === '/slack') return send(res, 200, { ok: true });

      // Everything below mimics GHL, which requires these two headers.
      if (!/^Bearer\s+\S+/.test(req.headers.authorization ?? '')) {
        return send(res, 401, { message: 'Missing Bearer token' });
      }
      if (!req.headers.version) return send(res, 400, { message: 'Missing Version header' });

      if (req.method === 'POST' && path === '/contacts/upsert') {
        if (String(body.email).includes('fail')) return send(res, 500, { message: 'Simulated GHL outage' });
        const existing = contactsByEmail.get(body.email);
        const contact = { ...existing, ...body, id: existing?.id ?? `mock_contact_${nextId++}` };
        contactsByEmail.set(body.email, contact);
        return send(res, existing ? 200 : 201, { new: !existing, contact, traceId: 'mock' });
      }
      const tagMatch = path.match(/^\/contacts\/([^/]+)\/tags$/);
      if (req.method === 'POST' && tagMatch) return send(res, 201, { tags: body.tags ?? [] });
      const noteMatch = path.match(/^\/contacts\/([^/]+)\/notes$/);
      if (req.method === 'POST' && noteMatch) {
        if (!body.body) return send(res, 422, { message: 'body is required' });
        return send(res, 201, { note: { id: `mock_note_${nextId++}`, contactId: noteMatch[1], body: body.body } });
      }
      if (req.method === 'POST' && (path === '/opportunities' || path === '/opportunities/')) {
        return send(res, 201, { opportunity: { id: `mock_opp_${nextId++}`, ...body } });
      }
      send(res, 404, { message: `No mock for ${req.method} ${path}` });
    });
  })
  .listen(PORT, () => console.log(`Mock GHL API on http://localhost:${PORT}`));
