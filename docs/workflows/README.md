# Sample Workflows

Importable n8n workflows demonstrating common business automations with the
**Company Citizen** node. They run against the bundled mock server
(`npm run mock-server`) or a confirmed company backend.

## How to import

1. In n8n: top-right menu (⋯) → **Import from File** (or paste JSON).
2. Open each imported node and select your **Company API** credential (the JSON
   uses a placeholder `REPLACE_WITH_CREDENTIAL_ID`).
3. For workflow 5, replace the HTTP `url` with the real downstream app (CONFIRM).
4. Click **Test workflow**.

| File | Scenario | Flow |
|------|----------|------|
| `1-new-lead-to-customer.json` | New lead becomes a customer | Lead → Create → Customer Create |
| `2-appointment-booked-update.json` | Appointment booked updates CRM | Appointment Create → Customer Update |
| `3-document-uploaded-notification.json` | Document upload triggers alert | Document Upload → Send Notification |
| `4-new-employee-create-record.json` | New hire record + onboarding email | Employee Create → Send Email |
| `5-customer-updated-sync.json` | Sync CRM change to another app | Customer Update → HTTP sync (placeholder) |
| `6-monitor-and-alert.json` | Scheduled monitor → identify → alert | Schedule → Search → IF → Send Email |
| `7-trigger-new-lead-to-customer.json` | **Event-driven** complete loop | **Trigger (On New Lead)** → Create Customer → Notify Sales |

> Notes:
> - All example IDs, emails and hosts are **illustrative placeholders**.
> - Destructive operations (Delete/Cancel) are intentionally **not** included in
>   these starter flows; add them only with the confirmation toggle enabled and
>   against disposable records.
