# Deployment Guide

How to install and operate `n8n-nodes-company-citizen` across n8n hosting
models, with a staging rollout and rollback procedure.

> ⚠️ **Do not deploy to, or modify, a live production environment without
> explicit written approval.** Items marked **CONFIRM** depend on the company's
> infrastructure and must be verified with the platform team first.

---

## 0. Which install path applies to you?

| Your n8n | Can it load this node? | How |
|----------|------------------------|-----|
| **n8n Cloud** (`*.app.n8n.cloud`) | Only after it is **published to npm** | Settings → Community Nodes → Install → `n8n-nodes-company-citizen` |
| **Self-hosted (npm/global)** | Yes | Install into the n8n user folder, or via Community Nodes UI |
| **Self-hosted (Docker)** | Yes | Bake into an image, or install via Community Nodes UI |
| **Self-hosted (Kubernetes)** | Yes | Bake into the image used by the Deployment |

### ❗ About the n8n Cloud instance (`rajnish96087.app.n8n.cloud`)

n8n Cloud **cannot** side-load an unpublished/local build. To use this node on
Cloud you must first **publish the package to npm** (public, or a registry the
Cloud instance can reach), then install it from
**Settings → Community Nodes → Install a community node** and acknowledge the
"unverified" prompt. There is no file-upload or Docker option on Cloud.

If you would rather not publish publicly yet, run **self-hosted n8n** (Docker,
below) where a local build loads directly.

---

## 1. Publish to npm (required for Cloud; optional for self-hosted)

```bash
npm run build
npm run lint
npm test
npm publish --access public      # public npm
```

For a **private registry** (e.g. Verdaccio, GitHub Packages, Artifactory):

```bash
npm config set @yourscope:registry https://<registry-url>   # CONFIRM
npm publish
```

**CONFIRM**: registry URL, scope, and whether the n8n host can authenticate to
it (self-hosted can use a private registry; n8n Cloud generally needs public npm).

---

## 2. Self-hosted via Docker (bake into an image)

`Dockerfile` for a custom n8n image that ships the node:

```dockerfile
FROM n8nio/n8n:latest           # CONFIRM: pin to your running n8n version
USER root
# Option A: install from npm (after step 1)
RUN cd /usr/local/lib/node_modules/n8n && npm install n8n-nodes-company-citizen
USER node
```

Or, without publishing, mount a pre-built package directory and set
`N8N_CUSTOM_EXTENSIONS` (see `docker/docker-compose.yml` in this repo).

Build & run:

```bash
docker build -t company/n8n-with-citizen:0.1.0 .
docker run -d --name n8n -p 5678:5678 \
  -e N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY \   # CONFIRM: supply a stable key
  -v n8n_data:/home/node/.n8n \
  company/n8n-with-citizen:0.1.0
```

---

## 3. Self-hosted via Community Nodes UI (no image rebuild)

Settings → **Community Nodes** → **Install** → `n8n-nodes-company-citizen`.
Requires `N8N_COMMUNITY_PACKAGES_ENABLED=true` (default on self-hosted) and
outbound access to the registry. **CONFIRM** your instance allows unverified
community nodes.

---

## 4. Kubernetes (if applicable — CONFIRM infra)

- Build the custom image from §2 and push to the company registry. **CONFIRM**
  registry + image pull secrets.
- Reference it in the n8n `Deployment`.
- Supply secrets via a `Secret` / external secrets manager:
  - `N8N_ENCRYPTION_KEY` (**must be stable and identical across replicas**)
  - DB connection, etc. **CONFIRM** DB (n8n needs Postgres for multi-replica).
- The `CompanyApi` credential itself is stored **inside n8n** (encrypted), not
  in Kubernetes secrets.

---

## 5. Credential & secret management

- The `CompanyApi` credential (base URL, API key/token, custom headers) is
  entered in the n8n UI and stored **encrypted at rest** using
  `N8N_ENCRYPTION_KEY`.
- **Manage `N8N_ENCRYPTION_KEY` as a secret.** If it changes or differs between
  instances, existing credentials cannot be decrypted. Back it up securely.
- Use **least-privilege** API keys scoped to only the operations in use.
  **CONFIRM** available scopes with the platform team.
- The node never writes credentials to output or logs (verified by tests);
  auth headers are injected by n8n and redacted in logs.
- Production refuses non-HTTPS base URLs.

---

## 6. Environment configuration

| Environment | Credential "Environment" | Base URL | HTTPS |
|-------------|--------------------------|----------|-------|
| Development | Development | `http://localhost:8088` (mock) | optional (toggle) |
| Staging | Staging | `https://<CONFIRM>` | required |
| Production | Production | `https://<CONFIRM>` | **enforced** |

Keep one credential per environment; name them clearly (e.g. "Company API –
Staging").

---

## 7. Logging & monitoring

- Set `N8N_LOG_LEVEL` (`info` default; `debug` for troubleshooting). Even at
  `debug`, credential values are redacted.
- Monitor n8n's execution list / `executions` for failures; the node returns
  structured errors with a `category` (authentication, rateLimit, timeout, …).
- **CONFIRM** whether to ship logs/metrics to the company's observability stack
  (e.g. Prometheus, Loki, Datadog).

---

## 8. Backup

- **n8n data**: back up the n8n database (workflows, credentials) and the
  `N8N_ENCRYPTION_KEY` together — one is useless without the other.
- **This package**: versioned in git + the npm registry; a given version is
  immutable once published.

---

## 9. Staging deployment procedure

1. **Pre-checks** (CI or local):
   ```bash
   npm ci && npm run build && npm run lint && npm test
   ```
2. **Version bump**: `npm version patch` (or minor) → commit + tag.
3. **Publish**: `npm publish` to the registry the staging n8n can reach.
4. **Install on staging n8n** (not production):
   - Community Nodes UI → install/upgrade to the new version, **or** roll a new
     Docker image tag and redeploy the staging stack.
5. **Configure** the `Company API – Staging` credential (HTTPS base URL, staging
   key). Click **Test**.
6. **Smoke test** with a dedicated staging workflow:
   - A read (Customer → Search) — confirms auth + connectivity.
   - A create against **staging data only**.
   - A destructive op against a disposable staging record (with the confirm
     toggle) — verifies the safeguard and the delete path.
7. **Verify**: structured outputs, correct error handling (temporarily point at
   a wrong key to confirm a clean 401), no credentials in logs/outputs.
8. **Sign-off**: record the version, who tested, and the result before any
   production consideration. **Production requires separate explicit approval.**

---

## 10. Rollback procedure

**Symptom → action.** Rollback is fast because the node is a versioned package
and workflows/credentials are unchanged by a downgrade.

### A. Community Nodes UI
1. Settings → Community Nodes → select `n8n-nodes-company-citizen`.
2. **Uninstall**, then **Install** the previous known-good version
   (e.g. `n8n-nodes-company-citizen@0.1.0`).
3. Restart n8n if prompted. Re-run the staging smoke test.

### B. Docker / Kubernetes (image-baked)
1. Redeploy the **previous image tag** (e.g. `company/n8n-with-citizen:0.1.0`).
   ```bash
   docker compose pull && docker compose up -d        # with the pinned old tag
   # or k8s:
   kubectl rollout undo deployment/n8n                 # CONFIRM deployment name
   ```
2. Confirm the pod/container is healthy and the node version is the expected one.

### C. If a bad credential/config caused the issue (not the code)
- Revert the credential to the previous base URL/key; no package change needed.

### Post-rollback
- Keep the failed version's logs.
- Open an issue, fix forward, and re-run the **staging procedure** before
  re-attempting the upgrade. **Do not** hotfix directly in production.

---

## 11. What must be CONFIRMED before production

- [ ] All items in [`API_CONTRACT.md`](./API_CONTRACT.md) §6.
- [ ] Target n8n version (pin the Docker tag / Cloud compatibility).
- [ ] Registry (public npm vs private) and host network access to it.
- [ ] `N8N_ENCRYPTION_KEY` management & backup.
- [ ] Least-privilege API scopes for each operation used.
- [ ] Logging/monitoring destination.
- [ ] Explicit production deployment approval.
