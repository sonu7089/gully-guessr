// Budget kill switch. A Cloud Billing budget publishes the project's running cost to Pub/Sub, which pushes it here.
// Once the month's cost reaches the budget, this takes the game offline and stops all further charges:
//   1. removes public access from the Cloud Run service
//   2. disables the paid Maps APIs
//   3. unlinks billing from THIS project only (never the billing account or other projects)
// Restoring is manual on purpose; see "Budget cap" in the README.
import { createServer } from 'node:http';

const PROJECT = process.env.PROJECT_ID;
const REGION = process.env.REGION;
const SERVICE = process.env.RUN_SERVICE;
const BUDGET_NAME = process.env.BUDGET_NAME;
const APIS = (process.env.DISABLE_APIS ?? '').split(',').filter(Boolean);
const PORT = Number(process.env.PORT) || 8080;

const log = (severity, message, extra = {}) => console.log(JSON.stringify({ severity, message, ...extra }));

async function accessToken() {
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
  return (await r.json()).access_token;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.split('?')[0]} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const serviceUrl = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}`;

async function makePrivate() {
  const policy = await api('GET', `${serviceUrl}:getIamPolicy`);
  const bindings = (policy.bindings ?? [])
    .map((b) => ({ ...b, members: b.members.filter((m) => m !== 'allUsers' && m !== 'allAuthenticatedUsers') }))
    .filter((b) => b.members.length > 0);
  await api('POST', `${serviceUrl}:setIamPolicy`, { policy: { ...policy, bindings } });
}

const disableApis = () =>
  Promise.all(APIS.map((a) => api('POST', `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${a}:disable`, { disableDependentServices: false })));

const unlinkBilling = () => api('PUT', `https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`, { billingAccountName: '' });

async function shutDown(reason) {
  log('CRITICAL', `Budget reached (${reason}). Shutting down.`);
  const steps = { makePrivate, disableApis, unlinkBilling };
  const failed = [];
  for (const [name, fn] of Object.entries(steps)) {
    try {
      await fn();
      log('NOTICE', `${name}: done`);
    } catch (e) {
      failed.push(name);
      log('ERROR', `${name}: ${e.message}`);
    }
  }
  return failed;
}

/** Checks the guard can really do its job, without doing it. */
async function selfTest() {
  const need = {
    project: ['resourcemanager.projects.deleteBillingAssignment', 'serviceusage.services.disable'],
    service: ['run.services.getIamPolicy', 'run.services.setIamPolicy'],
  };
  const p = await api('POST', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:testIamPermissions`, { permissions: need.project });
  const s = await api('POST', `${serviceUrl}:testIamPermissions`, { permissions: need.service });
  const have = new Set([...(p.permissions ?? []), ...(s.permissions ?? [])]);
  const all = [...need.project, ...need.service];
  return { ok: all.every((x) => have.has(x)), missing: all.filter((x) => !have.has(x)) };
}

createServer(async (req, res) => {
  const send = (code, body) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  try {
    if (req.method === 'GET' && req.url === '/selftest') return send(200, await selfTest());
    if (req.method !== 'POST') return send(200, { guarding: SERVICE });

    let raw = '';
    for await (const chunk of req) raw += chunk;
    const data = JSON.parse(Buffer.from(JSON.parse(raw).message.data, 'base64').toString());
    const { costAmount, budgetAmount, budgetDisplayName } = data;
    if (BUDGET_NAME && budgetDisplayName !== BUDGET_NAME) return send(200, { ignored: budgetDisplayName });
    log('INFO', 'budget update', { costAmount, budgetAmount });

    if (typeof costAmount !== 'number' || typeof budgetAmount !== 'number' || costAmount < budgetAmount) return send(200, { action: 'none', costAmount, budgetAmount });
    const failed = await shutDown(`${costAmount} of ${budgetAmount} ${data.currencyCode ?? ''}`);
    // A non-2xx makes Pub/Sub retry, and every step is safe to repeat.
    return send(failed.length ? 500 : 200, { action: 'shutdown', failed });
  } catch (e) {
    log('ERROR', e.message);
    return send(500, { error: e.message });
  }
}).listen(PORT, () => log('INFO', `budget guard listening on ${PORT}`));
