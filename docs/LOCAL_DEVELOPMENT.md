# Local Development Guide (Windows PowerShell)

Exact commands to build, lint, test, and run the `n8n-nodes-company-citizen`
node locally against the bundled mock backend.

> Paths below assume the repo is at `E:\Custome Node\Rajnish_Node_N8n_globalX`.
> Adjust if yours differs. Run commands in **PowerShell**.

---

## 0. Prerequisites

```powershell
node --version   # expect v20.15+ (tested on v24.16)
npm --version    # expect 10+
```

Install Docker Desktop if you intend to use the `docker compose` path in step 6.

---

## 1. Install dependencies

```powershell
cd "E:\Custome Node\Rajnish_Node_N8n_globalX"
npm install
```

## 2. Build the node

```powershell
npm run build
```

Outputs compiled JS + icons to `dist\`. n8n loads from `dist\`.

## 3. Lint

```powershell
npm run lint
# auto-fix where possible:
npm run lint:fix
```

## 4. Run the test suite

```powershell
npm test
# with coverage:
npm run test:coverage
```

All unit tests and the mock-server integration test run with `jest` and need no
network access.

## 5. Start the mock Company API (separate terminal)

```powershell
cd "E:\Custome Node\Rajnish_Node_N8n_globalX"
npm run mock-server
# -> [mock-company-api] listening on http://localhost:8088
```

Quick manual check (new terminal):

```powershell
# 401 without a key:
curl.exe -i http://localhost:8088/health
# 200 with the dev key:
curl.exe -i -H "X-API-Key: dev-key-local" http://localhost:8088/health
```

---

## 6. Run n8n with the custom node

### Option A — Docker Compose (recommended, reproducible)

```powershell
cd "E:\Custome Node\Rajnish_Node_N8n_globalX"
npm run build
docker compose -f docker/docker-compose.yml up
```

Open <http://localhost:5678>. This also starts the mock API as
`mock-company-api` on the compose network.

### Option B — Local n8n via npx (no Docker)

```powershell
# 1) Build first
npm run build

# 2) Point n8n at this package as a custom extension, then start n8n
$env:N8N_CUSTOM_EXTENSIONS = "E:\Custome Node\Rajnish_Node_N8n_globalX"
$env:N8N_SECURE_COOKIE = "false"
npx n8n
```

Open <http://localhost:5678>. After changing node code, re-run `npm run build`
and restart n8n to pick up changes.

---

## 7. Configure the credential in n8n

1. In n8n: **Credentials → New → Company API**.
2. Set:
   - **Environment**: `Development`
   - **Base URL**:
     - Docker Compose path: `http://mock-company-api:8088`
     - npx/local path: `http://localhost:8088`
   - **Authentication**: `API Key` → **API Key**: `dev-key-local`
   - **Allow Insecure HTTP (Dev Only)**: **ON** (dev only)
3. Click **Test**. It should succeed (hits `GET /health`).

---

## 8. Test each operation (happy path)

Add a **Company Citizen** node after a **Manual Trigger** and try:

| Resource | Operation | Minimal input |
|----------|-----------|---------------|
| Customer | Create | Email = `jane@example.com` |
| Customer | Get | Record ID = the id returned by Create |
| Customer | Update | Record ID + Update Fields → Company = `Acme` |
| Customer | Search | Search Query = `jane` |
| Customer | Delete | Record ID + **enable** the "I Understand…" toggle |
| Lead | Create | Email = `lead@example.com` |
| Appointment | Create | Title + Start Time |
| Appointment | Cancel | Record ID + **enable** the confirm toggle |
| Document | Upload | Name + Storage Reference |
| Notification | Send Email | To + Subject + Body |

Verify that:
- **Delete / Cancel are blocked** until the confirmation toggle is enabled.
- Outputs are structured JSON.
- Credentials never appear in any node output.

---

## 9. Common issues

| Symptom | Fix |
|---------|-----|
| Node doesn't appear in n8n | Did you `npm run build`? Is `N8N_CUSTOM_EXTENSIONS` set to the repo root? Restart n8n. |
| Credential "Test" fails with 401 | Wrong API key, or mock server not running. |
| "not HTTPS" error | In dev, enable **Allow Insecure HTTP**; in prod, use `https://`. |
| Connection refused | Mock server not running, or wrong Base URL (container vs host name). |
