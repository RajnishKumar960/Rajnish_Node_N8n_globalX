# n8n-nodes-company-citizen

An **enterprise n8n community node** that lets non-technical employees ("citizen
developers") automate the company's internal systems — **Customer, Employee,
Lead, Appointment, Document, Notification** — from the n8n visual editor, with no
code.

It is built on the official n8n node framework (`n8n-workflow`), in TypeScript,
with a clean separation between the node UI, execution logic, a reusable API
service layer, validation, error handling, tests, a mock backend, Docker, and
deployment docs.

> ⚠️ **Backend status: placeholder / adapter.** This package does **not** connect
> to a confirmed company backend. All endpoints are **assumptions** in an adapter
> layer and are listed in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for the
> platform team to confirm. A runnable **mock server** is included so you can
> develop and demo immediately. Nothing here claims to talk to a real system.

---

## Features

- **Two nodes** — an **action** node (Company Citizen) and a **polling trigger**
  (Company Citizen Trigger), covering both of n8n's node paradigms so you can
  build complete event → action automations.
- **Resource + Operation UX** with dynamic fields, friendly labels, validation,
  sensible defaults, and full expression/incoming-data support.
- **Dynamic dropdowns (loadOptions)** — the trigger's owner filter is populated
  live from the company API.
- **6 resources, 26 operations** (see table below).
- **Secure `CompanyApi` credential**: base URL, API key *or* bearer token,
  optional custom headers, per-environment HTTPS enforcement. Secrets are stored
  encrypted by n8n and **never** written to output or logs.
- **Robust service layer**: timeouts, retries with exponential backoff + jitter,
  `Retry-After` support, pagination (cursor **and** offset), response
  normalization, and consistent error categorization.
- **Safety first**: Delete/Cancel are **blocked** behind an explicit "I
  Understand…" confirmation toggle (off by default).
- **Idempotency** keys on create-style operations to prevent accidental
  duplicates (where the backend supports it).
- **Tested**: 47 Jest tests incl. a mock-server integration suite — success,
  auth failures, 400/401/403/404/429/500, timeouts, pagination, retries,
  multi-item, idempotency, and credential-redaction.

## Supported operations

| Resource | Operations |
|----------|------------|
| Customer | Create · Get · Update · **Delete** 🔒 · Search |
| Employee | Create · Get · Update · Search |
| Lead | Create · Get · Update · Search |
| Appointment | Create · Get · Update · **Cancel** 🔒 · List |
| Document | Upload · Get · Search |
| Notification | Send Email · Send Notification |

🔒 = destructive, guarded by a required confirmation toggle.

### Trigger node (Company Citizen Trigger)

A **polling** trigger that starts a workflow when records appear or change:

| Setting | Values |
|---------|--------|
| Resource | Customer · Lead · Appointment |
| Event | Created · Created or Updated |
| Filter by Owner | **dynamic dropdown** loaded live from the API (loadOptions) |
| Max Records per Poll | safety cap |

It dedupes with a watermark stored in the workflow's static data (each record
emitted once), returns a sample on manual "fetch test event", and avoids
flooding history on first activation. n8n adds the poll-schedule UI automatically.

---

## Quick start (local, with the mock backend)

```powershell
# 1. Install & build
npm install
npm run build

# 2. Run the mock Company API (terminal A)
npm run mock-server      # http://localhost:8088  (key: dev-key-local)

# 3. Run n8n with this node (terminal B)
#    Docker (recommended):
docker compose -f docker/docker-compose.yml up
#    …or without Docker:
$env:N8N_CUSTOM_EXTENSIONS = "E:\Custome Node\Rajnish_Node_N8n_globalX"
npx n8n
```

Then open <http://localhost:5678>, create a **Company API** credential
(Development, `http://localhost:8088`, key `dev-key-local`, Allow Insecure HTTP
ON), add a **Company Citizen** node, and run an operation.

Full step-by-step (Windows PowerShell): [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md).

### Using it on n8n Cloud

n8n Cloud cannot load a local/unpublished build. **Publish to npm first**, then
in your Cloud instance go to **Settings → Community Nodes → Install** and enter
`n8n-nodes-company-citizen`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0–1.

---

## Architecture

```
nodes/CompanyCitizen/
  CompanyCitizen.node.ts        # action node: presentation + execution
  descriptions/*.ts             # per-resource UI (properties, fields, options)
  companyCitizen.svg            # branded icon
nodes/CompanyCitizenTrigger/
  CompanyCitizenTrigger.node.ts # polling trigger + loadOptions dropdown
credentials/
  CompanyApi.credentials.ts     # secure credential definition + auth injection
src/
  adapters/operations.ts        # endpoint registry (single source of truth)
  adapters/buildRequest.ts      # pure body/query assembly
  services/CompanyApiService.ts # HTTP, auth, retries, pagination, normalization
  helpers/errors.ts             # error categorization + secret redaction
  helpers/validation.ts         # field + URL + email validation
  types/index.ts                # shared types
mock-server/server.ts           # in-memory stand-in for the company backend
test/                           # jest unit + integration tests
docker/ , docs/                 # deployment + documentation + sample workflows
```

Design notes:
- `execute()` is bound to `IExecuteFunctions` (not the class), so all logic lives
  in standalone, testable functions.
- The service layer takes an injectable transport, so it is tested without n8n
  and reused unchanged in production (backed by n8n's authenticated request
  helper, which redacts secrets).

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run build` | Compile TS → `dist/` and copy icons |
| `npm run lint` / `lint:fix` | ESLint with the n8n node ruleset |
| `npm test` / `test:coverage` | Jest test suite |
| `npm run mock-server` | Start the mock Company API on :8088 |
| `npm run format` | Prettier |

---

## Security

- Credentials stored encrypted by n8n (`N8N_ENCRYPTION_KEY`); never hardcoded.
- Auth headers injected centrally and redacted in logs; outputs are scrubbed and
  tested to contain no secrets.
- HTTPS enforced for the Production environment.
- Least-privilege API keys recommended (confirm scopes with the platform team).
- Destructive operations require deliberate configuration.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §5 for encryption-key management.

---

## Documentation

- [API integration contract (CONFIRM list)](docs/API_CONTRACT.md)
- [Local development (Windows PowerShell)](docs/LOCAL_DEVELOPMENT.md)
- [Deployment, staging rollout & rollback](docs/DEPLOYMENT.md)
- [Sample workflows](docs/workflows/)
- [Screenshots checklist](docs/SCREENSHOTS_CHECKLIST.md)

---

## Status & caveats

- **Pre-1.0.** API paths are unconfirmed placeholders pending platform-team
  review. Do not point at production until `docs/API_CONTRACT.md` is confirmed
  and production deployment is explicitly approved.

## License

MIT © Rajnish Kumar
