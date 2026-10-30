# Company API — Integration Contract (DRAFT / MUST BE CONFIRMED)

> ⚠️ **Status: UNCONFIRMED PLACEHOLDER.**
> Every endpoint, path, method, request body and response shape in this document
> is an **assumption** made by the `n8n-nodes-company-citizen` adapter layer.
> None of it has been verified against a real company backend. The platform/API
> team **must review and confirm or correct** each row before this node is used
> against staging or production.
>
> The single source of truth in code is
> [`src/adapters/operations.ts`](../src/adapters/operations.ts). Keep this
> document and that file in sync.

---

## 1. Connection & Authentication

| Item | Value / Assumption | Confirm? |
|------|--------------------|:--------:|
| Base URL (dev) | `http://localhost:8088` (mock server) | n/a |
| Base URL (staging) | `https://<CONFIRM>` | ✅ |
| Base URL (production) | `https://<CONFIRM>` | ✅ |
| Auth option A | `X-API-Key: <key>` header | ✅ |
| Auth option B | `Authorization: Bearer <token>` header | ✅ |
| Content type | `application/json` (request & response) | ✅ |
| Health endpoint | `GET /health` → `200` (used by credential "Test") | ✅ |
| TLS | HTTPS required in staging/production (node enforces) | ✅ |

The node sends **one** of the two auth schemes, chosen in the credential. TLS
and certificate validation are handled by n8n's HTTP layer; production refuses
plain HTTP.

---

## 2. Standard Response Envelope (ASSUMED)

Single record:

```json
{ "data": { "id": "cus_1001", "email": "jane@example.com", "createdAt": "…", "updatedAt": "…" } }
```

List / search:

```json
{
  "data": [ { "id": "cus_1001" }, { "id": "cus_1002" } ],
  "pagination": { "total": 57, "nextCursor": "eyJvZmZzZXQiOjUwfQ==", "nextOffset": 50 }
}
```

The service layer also accepts a **bare array** or an envelope whose list lives
under `items` / `results` / `records`. **CONFIRM** which the backend actually
returns so the adapter can be simplified.

### Pagination inputs (ASSUMED)

- `limit` — page size (node caps at 500 per request).
- `offset` **or** `cursor` — the node sends `cursor` if the previous response
  returned `pagination.nextCursor`, otherwise it increments `offset`.

**CONFIRM**: offset-based, cursor-based, or page-number based?

---

## 3. Standard Error Shape (ASSUMED)

```json
{ "error": { "code": "validation", "message": "Field \"email\" is required." } }
```

HTTP status codes the node understands and maps to friendly messages:

| Status | Node category | Retried automatically? |
|-------:|---------------|------------------------|
| 400 | validation | no |
| 401 | authentication | no |
| 403 | authorization | no |
| 404 | notFound | no |
| 408 | timeout | yes (safe methods) |
| 429 | rateLimit | yes (honors `Retry-After`) |
| 5xx | server | yes (safe/idempotent methods) |

**CONFIRM** the real error body shape and rate-limit headers.

---

## 4. Endpoints by Resource (ALL PLACEHOLDERS — CONFIRM EACH)

Legend: 🔒 = destructive (guarded in the node) · ♻️ = accepts `Idempotency-Key`.

### Customer
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Create | `POST` | `/customers` | ♻️ body: `{ email, firstName?, lastName?, phone?, company?, status?, notes? }` |
| Get | `GET` | `/customers/{id}` | |
| Update | `PATCH` | `/customers/{id}` | partial update |
| Delete | `DELETE` | `/customers/{id}` | 🔒 |
| Search | `GET` | `/customers?query=&limit=&offset=` | paginated |

### Employee
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Create | `POST` | `/employees` | ♻️ body: `{ email, firstName?, lastName?, department?, title?, phone?, status? }` |
| Get | `GET` | `/employees/{id}` | |
| Update | `PATCH` | `/employees/{id}` | |
| Search | `GET` | `/employees?query=&limit=&offset=` | paginated |

### Lead
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Create | `POST` | `/leads` | ♻️ body: `{ email, name?, phone?, company?, source?, status?, notes? }` |
| Get | `GET` | `/leads/{id}` | |
| Update | `PATCH` | `/leads/{id}` | |
| Search | `GET` | `/leads?query=&limit=&offset=` | paginated |

### Appointment
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Create | `POST` | `/appointments` | ♻️ body: `{ title, startTime, endTime?, location?, customerId?, notes?, status? }` |
| Get | `GET` | `/appointments/{id}` | |
| Update | `PATCH` | `/appointments/{id}` | |
| Cancel | `POST` | `/appointments/{id}/cancel` | 🔒 body: `{ reason? }` |
| List | `GET` | `/appointments?query=&limit=&offset=` | paginated |

### Document
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Upload | `POST` | `/documents` | ♻️ body: `{ name, storageRef, contentType?, ownerId?, customerId?, tags? }` — **CONFIRM** whether the backend expects a storage reference/URL or a multipart binary upload. This node sends metadata JSON only. |
| Get | `GET` | `/documents/{id}` | |
| Search | `GET` | `/documents?query=&limit=&offset=` | paginated |

### Notification
| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Send Email | `POST` | `/notifications/email` | ♻️ body: `{ to, subject, body, cc?, bcc?, replyTo?, isHtml?, templateId? }` |
| Send Notification | `POST` | `/notifications` | ♻️ body: `{ recipientId, message, title?, priority?, channel? }` |

---

## 5. Idempotency (ASSUMED)

For ♻️ operations the node sends an `Idempotency-Key` header derived from a hash
of the request body, so retries / re-runs with identical data do not create
duplicates. **CONFIRM** the backend honors `Idempotency-Key`; if not, set
`idempotent: false` for that operation in `operations.ts`.

---

## 6. Open Questions for the Platform/API Team

1. Confirm base URLs per environment (dev/staging/prod).
2. Confirm auth scheme(s) and header names.
3. Confirm the response envelope and pagination style.
4. Confirm the error body shape and rate-limit headers (`Retry-After`?).
5. Confirm each resource path, method, and required fields above.
6. Confirm document upload mechanism (metadata vs. binary).
7. Confirm `Idempotency-Key` support per write endpoint.
8. Confirm whether `Employee` operations are exposed to automation at all, and
   the least-privilege scopes required for each operation.
