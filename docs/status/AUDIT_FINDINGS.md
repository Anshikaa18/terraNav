# Audit Findings & Independent Verification Ledger

This document tracks every finding from `terranav_audit_report.md`, independent code evidence, remediation implementation, and verification test status.

Allowed final statuses:
- `CONFIRMED_OPEN`
- `IN_PROGRESS`
- `FIXED_VERIFIED`
- `FIXED_UNVERIFIED`
- `NOT_REPRODUCED`
- `ACCEPTED_RISK`

---

## 1. High-Priority Findings

### Finding 1.1: Secrets and Environment Files Included in Archive
- **Original Severity:** High
- **Verified Code Evidence:**
  - `terraNav/.env` contains `JWT_SECRET=terranav_ai_jwt_super_secret_key_2026_production_change_me` and live `TOMTOM_API_KEY`.
  - `terraNav/backend/.env` contains the identical secrets.
  - While `.gitignore` includes `.env`, manual zip creation included `.env` and `node_modules` in the distributed archive `minor (7).zip`.
- **Affected Files:**
  - `terraNav/.env` (lines 14, 24)
  - `terraNav/backend/.env` (lines 14, 24)
  - `terraNav/.env.example`
  - `terraNav/backend/.env.example`
  - `terraNav/.gitignore`
  - `create_clean_release.ps1`
- **Exploitability Assessment:**
  - High if an archive is shared publicly or with untrusted parties. The JWT secret enables token forgery; the TomTom API key allows unauthorized billing/quota exhaustion.
- **Remediation Plan:**
  - Replace weak placeholder JWT secret with a cryptographically secure random string (>= 32 chars) in local `.env`.
  - Sanitize all `.env.example` templates to only have safe dummy placeholders.
  - Document provider-side rotation requirement for TomTom API key.
  - Ensure release packaging script (`create_clean_release.ps1`) aborts if `.env` or real keys are present.
- **Verification Evidence:** Pending implementation in SEC-001.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** Live TomTom key must be rotated by account owner in developer portal.

---

### Finding 1.2: Public Endpoints Allow Incident Creation
- **Original Severity:** High
- **Verified Code Evidence:**
  - `terraNav/backend/api/index.js:99`: `incidentRouter.post('/', incidentCreateRateLimit, optionalAuth, incidentController.create);`
  - `terraNav/backend/api/incidents/service.js:24`: `reported_by = null` allowed; incidents can be inserted without a valid authenticated user.
- **Affected Files:**
  - `terraNav/backend/api/index.js:99`
  - `terraNav/backend/api/incidents/controller.js:22-23`
  - `terraNav/backend/api/incidents/service.js:24-72`
  - `terraNav/backend/api/_lib/validation.js`
- **Exploitability Assessment:**
  - High. Any network client within the rate limit can submit fake roadblock, accident, or flooding incidents, altering routing calculations and misleading drivers.
- **Remediation Plan:**
  - Switch `optionalAuth` to `requireAuth` on `POST /api/incidents`.
  - Require `req.user.id` to be stored in `reported_by`.
  - Enforce strict validation on coordinates, incident type, and description length.
- **Verification Evidence:** Pending implementation in SEC-002.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** None once authenticated and validated.

---

### Finding 1.3: JWT Signing Secret is a Known Placeholder
- **Original Severity:** High
- **Verified Code Evidence:**
  - `terraNav/backend/api/_lib/auth.js:10-13`: `KNOWN_WEAK_SECRETS` defined.
  - `terraNav/backend/api/_lib/auth.js:29-34`: In non-production environments (`NODE_ENV !== 'production'`), placeholder is logged as a warning but permitted:
    ```js
    if (KNOWN_WEAK_SECRETS.has(secret)) {
      logger.warn('JWT_SECRET uses a known placeholder value; replace it before production deployment.');
    }
    return secret;
    ```
- **Affected Files:**
  - `terraNav/backend/api/_lib/auth.js:10-44`
  - `terraNav/.env`
  - `terraNav/backend/.env`
- **Exploitability Assessment:**
  - High for any staging/dev deployment exposed to the network. An attacker can forge JWTs for any user ID including admin.
- **Remediation Plan:**
  - Reject weak secrets unconditionally unless `NODE_ENV === 'test'`.
  - Require secrets to meet minimum length (>= 32 characters) in all operational environments.
  - Supply a fresh 64-character cryptographically random secret in `.env`.
- **Verification Evidence:** Pending implementation in SEC-001.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** Old tokens signed with the placeholder secret become invalid upon secret change.

---

### Finding 1.4: Destructive Incident Operations Need Ownership and Authorization Review
- **Original Severity:** High (BOLA / IDOR)
- **Verified Code Evidence:**
  - `terraNav/backend/api/incidents/controller.js:39-56`:
    ```js
    async function updateStatus(req, res, next) {
      const { status } = req.body;
      const result = await incidentService.updateIncidentStatus(req.params.id, status);
      return sendSuccess(res, result, 'Incident status updated', 200);
    }
    async function remove(req, res, next) {
      const result = await incidentService.deleteIncident(req.params.id);
      return sendSuccess(res, result, 'Incident deleted successfully', 200);
    }
    ```
  - `req.user` is NEVER passed to `updateIncidentStatus` or `deleteIncident`.
  - `terraNav/backend/api/incidents/service.js:96-125` updates and deletes solely by `id`. Any authenticated user can modify or delete ANY incident created by ANY other user.
- **Affected Files:**
  - `terraNav/backend/api/incidents/controller.js:39-56`
  - `terraNav/backend/api/incidents/service.js:96-125`
- **Exploitability Assessment:**
  - High. Classic Insecure Direct Object Reference (IDOR) / Broken Object Level Authorization (BOLA). Any user can clear or delete all traffic incidents in the database.
- **Remediation Plan:**
  - Pass `userId` and user roles from controller to service.
  - In `updateIncidentStatus` and `deleteIncident`, verify that the incident belongs to `userId` or the user has an `admin` role. If not, throw `ForbiddenError`.
- **Verification Evidence:** Pending implementation in SEC-003.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** None once authorization predicate is enforced in service layer.

---

## 2. Medium-Priority Findings

### Finding 2.1: Permissive CORS Configuration
- **Original Severity:** Medium
- **Verified Code Evidence:**
  - `terraNav/backend/api/server.js:26`: `const corsOrigin = process.env.CORS_ORIGIN || '*';`
  - In `terraNav/.env`: `CORS_ORIGIN=*`.
  - In `terraNav/frontend/src/services/api.js:8`: `withCredentials: true`.
  - Wildcard CORS with `withCredentials: true` is invalid under the Fetch/XHR standard and allows cross-origin probing.
- **Affected Files:**
  - `terraNav/backend/api/server.js:26-35`
  - `terraNav/.env:27`
  - `terraNav/backend/.env:27`
  - `terraNav/frontend/src/services/api.js:8`
- **Exploitability Assessment:**
  - Medium. Browser security prevents reading credentials with wildcard CORS, but permissive origins allow arbitrary web origins to interact with public endpoints.
- **Remediation Plan:**
  - Configure explicit origin allowlist in `.env` (e.g., `http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173`).
  - Configure `cors({ origin: allowedOrigins, credentials: true })`.
- **Verification Evidence:** Pending implementation in SEC-004.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** Origins must be kept in sync when frontend hosting port or domain changes.

---

### Finding 2.2: Rate Limiter Trusts Client-Supplied Header
- **Original Severity:** Medium
- **Verified Code Evidence:**
  - `terraNav/backend/api/_lib/rateLimit.js:7-13`:
    ```js
    function clientKey(req) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket?.remoteAddress || 'unknown';
    }
    ```
  - Directly trusts client-provided `X-Forwarded-For` header without checking whether Express has `trust proxy` enabled or if the immediate connection is a trusted proxy.
- **Affected Files:**
  - `terraNav/backend/api/_lib/rateLimit.js:7-13`
  - `terraNav/backend/api/server.js`
- **Exploitability Assessment:**
  - Medium. Attackers can bypass IP rate limits on `/api/auth/login`, `/api/auth/register`, and `/api/incidents` by rotating arbitrary `X-Forwarded-For` header values.
- **Remediation Plan:**
  - Use `req.ip` directly after properly configuring `app.set('trust proxy', process.env.TRUSTED_PROXY || 'loopback')`.
  - Do not parse raw untrusted headers manually.
- **Verification Evidence:** Pending implementation in SEC-005.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** In environments behind reverse proxies, operators must configure `TRUSTED_PROXY`.

---

### Finding 2.3: JWT Storage in Browser localStorage
- **Original Severity:** Medium
- **Verified Code Evidence:**
  - `terraNav/frontend/src/services/authService.js:10-11, 21-22`:
    ```js
    localStorage.setItem('terranav_token', token);
    localStorage.setItem('terranav_jwt_token', token);
    ```
  - Double storage of tokens in localStorage.
- **Affected Files:**
  - `terraNav/frontend/src/services/authService.js`
  - `terraNav/frontend/src/services/api.js`
- **Exploitability Assessment:**
  - Low to Medium. While localStorage is vulnerable to XSS if an injection occurs, duplicate keys create sync issues and unnecessary exposure.
- **Remediation Plan:**
  - Consolidate to single canonical key `chunkflow_auth_token` (with backward compatibility reading `terranav_jwt_token`/`terranav_token` on upgrade).
  - Verify DOM sanitization across React components.
- **Verification Evidence:** Pending implementation in SEC-006.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** Bearer tokens in single-page apps without backend session cookies remain accessible to same-origin scripts.

---

### Finding 2.4: Large Dependency and Build Artifacts Included
- **Original Severity:** Medium
- **Verified Code Evidence:**
  - `terraNav/legacy_frontend_backup.zip` (1.1 MB) untracked in repository root.
  - `terraNav/backend/database/backup_terra_nav.sql` untracked database dump.
  - `create_clean_release.ps1` previously did not exclude `legacy_frontend_backup.zip`.
- **Affected Files:**
  - `terraNav/legacy_frontend_backup.zip`
  - `terraNav/.gitignore`
  - `create_clean_release.ps1`
- **Exploitability Assessment:**
  - Low (hygiene and exposure risk). Accidental redistribution of backups or stale code leaks legacy bugs.
- **Remediation Plan:**
  - Remove `legacy_frontend_backup.zip` from distribution path; ignore in `.gitignore`.
  - Update `create_clean_release.ps1` to explicitly verify exclusion of any zip or sql backup.
- **Verification Evidence:** Pending implementation in SEC-007.
- **Status:** CONFIRMED_OPEN
- **Residual Risk:** None once excluded.

---

## 3. Additional Code-Level Checks (SEC-008)

| Check ID | Area | Finding / Check Description | Current Code Evidence | Status |
|---|---|---|---|---|
| **CHK-001** | Auth Password Limits | Bcrypt DoS: no upper limit on password length in registration/login. | `backend/api/auth/service.js:22`: `password.length < 6` checked, but no max length check. Large strings (> 1000 chars) cause high CPU load in bcrypt. | CONFIRMED_OPEN |
| **CHK-002** | Input Validation | Coordinates and String bounds in places/incidents/history. | `isValidCoordinate` is utilized across services; need to verify numeric clamping on pagination and radius parameters. | IN_PROGRESS |
| **CHK-003** | Database Parameterization | SQL injection review across all services. | Verified: `saved/service.js`, `history/service.js`, `incidents/service.js`, `auth/service.js` use parameterized statements with `?` placeholders. No string concatenation in queries. | FIXED_VERIFIED |
| **CHK-004** | External Services SSRF | Upstream URLs in Nominatim, Overpass, Valhalla, TomTom. | URLs loaded from validated environment config. Need to ensure user input cannot control the destination hostname. | IN_PROGRESS |
| **CHK-005** | ML Worker Timeout | Subprocess execution bounds for ChunkFlow ML daemon. | `backend/api/directions/mlAdapter.js` runs daemon with health checks; timeout handling should be verified. | IN_PROGRESS |
