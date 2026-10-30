# Screenshots Checklist (for project demonstration)

Capture these to demonstrate the custom node end-to-end. Suggested order tells a
clean story from install → configure → run → safety → errors.

## Setup & install
- [ ] `npm run build` succeeding in PowerShell.
- [ ] `npm test` output showing all suites passing.
- [ ] `npm run lint` with no errors.
- [ ] Mock server terminal: `[mock-company-api] listening on http://localhost:8088`.
- [ ] n8n running (Docker Compose up, or `npx n8n`) — the canvas at localhost:5678.

## Node & credential
- [ ] The **Company Citizen** node in the n8n nodes panel (search "Company").
- [ ] The node on the canvas showing the **Resource** dropdown (6 resources).
- [ ] The **Operation** dropdown for a resource (e.g. Customer: Create/Get/Update/Delete/Search).
- [ ] The **Company API** credential screen with masked API key field.
- [ ] Credential **Test** → success (green).

## Core operations (happy path)
- [ ] Customer → **Create** input (Email + Additional Fields) and its JSON output.
- [ ] Customer → **Get** by the returned ID → structured JSON record.
- [ ] Customer → **Update** → changed field reflected in output.
- [ ] Customer → **Search** → multiple items returned.
- [ ] Lead → **Create**, Appointment → **Create**, Document → **Upload**,
      Notification → **Send Email** (one screenshot each of input + output).

## Safety / destructive guardrails
- [ ] Customer → **Delete** with the "I Understand…" toggle **OFF** → node errors
      with the safeguard message (shows it is blocked).
- [ ] Customer → **Delete** with the toggle **ON** → success envelope
      `{ success: true, recordId, operation: "delete" }`.
- [ ] Appointment → **Cancel** showing the same confirmation toggle.

## Error handling
- [ ] A Get on a non-existent ID → clean `notFound` (404) error message.
- [ ] A credential with a wrong key → `authentication` (401) error.
- [ ] (Optional) Set request header via mock `X-Force-Status: 500` path to show
      a retried server error.
- [ ] "Continue On Fail" enabled → the error returned as a structured item
      (`{ error, category, statusCode }`) instead of stopping the workflow.

## Sample workflows
- [ ] Each imported sample workflow from `docs/workflows/` on the canvas.
- [ ] One full run of "Search logs → identify errors → send alert"-style flow
      (New Lead → Create Customer) with successful execution ticks.

## Evidence of security
- [ ] A node output expanded, showing **no credential values** anywhere.
- [ ] n8n logs at `debug` level showing redacted auth (no raw key/token).
