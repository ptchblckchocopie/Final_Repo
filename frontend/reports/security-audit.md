# Security Audit Report

**Project:** VeentTix - Ticket Generator + Messaging/Call Platform
**Date:** 2026-02-18
**Auditor:** Security Guardian (quality-assurance team)
**Scope:** Full codebase - SvelteKit 2 frontend + Payload CMS 3.x backend
**Branch:** `commenttest` (commit `c955fbc`)

---

## Executive Summary

This audit identified **27 security findings** across the full-stack application: **4 Critical**, **7 High**, **8 Medium**, and **8 Low/Informational**. The most severe issues center on **completely open access control** across the majority of backend collections — any anonymous user can create, read, update, and delete data including media files, ticket templates, call signals, calendar events, and chat messages. Combined with **unrestricted file uploads** (no MIME type or size validation) and a **PAYLOAD_SECRET that falls back to an empty string**, the backend is effectively unprotected.

The frontend has moderate risk areas around unsanitized file imports, CSV parsing without input limits, and a fragile print-rendering pattern using `document.write`. No `{@html}` XSS vectors were found in Svelte templates.

**Immediate action required:** Lock down collection access control and media upload restrictions before any production deployment.

---

## Methodology

- Manual source code review of all backend collections, config, and API routes
- Manual review of all frontend API clients, stores, utilities, components, and actions
- OWASP Top 10 (2021) checklist applied to each code area
- Checked `.env` files, `.gitignore`, dependency versions, and configuration files
- Searched for dangerous patterns: `{@html}`, `innerHTML`, `document.write`, `eval`, hardcoded secrets

---

## Findings

### CRITICAL

#### C1: Unrestricted Media Upload - No MIME Type, File Size, or Authentication

| Field | Value |
|-------|-------|
| **OWASP** | A01 Broken Access Control + A04 Insecure Design |
| **File** | `test-payload/src/collections/Media.ts:3-22` |
| **Severity** | Critical |

**Description:**
The Media collection sets `upload: true` with no `mimeTypes` restriction, no `staticDir` configuration, and no file size limits. All four access control functions (`create`, `read`, `update`, `delete`) return `() => true`, granting anonymous full CRUD access.

**Proof of Concept:**
```bash
# Upload an arbitrary file (e.g., executable, HTML with embedded JS, SVG with script)
curl -X POST http://localhost:3000/api/media \
  -F "file=@malicious.html" \
  -F '_payload={"alt":"test"}'

# Upload a 500MB file to exhaust disk space
dd if=/dev/zero bs=1M count=500 | curl -X POST http://localhost:3000/api/media \
  -F "file=@-;filename=huge.bin" \
  -F '_payload={"alt":"dos"}'
```

**Impact:**
- Arbitrary file upload (executables, HTML/SVG with scripts, PHP/JSP if behind a misconfigured reverse proxy)
- Disk space exhaustion (no size limit)
- Stored XSS via uploaded HTML/SVG files served from the media endpoint
- No authentication required

**Remediation:**
```typescript
upload: {
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  staticDir: 'media',
  filesRequiredOnCreate: true,
  // Add adminThumbnail for safe preview
},
access: {
  create: ({ req }) => !!req.user,  // Authenticated only
  read: () => true,                  // Public read is fine
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
```

---

#### C2: Anonymous Full CRUD on 5 of 8 Backend Collections

| Field | Value |
|-------|-------|
| **OWASP** | A01 Broken Access Control |
| **Files** | `Media.ts:6-9`, `TicketTemplate.ts:6-9`, `CallSignal.ts:9-12`, `CalendarEvent.ts:9-12`, `Message.ts:8-10` |
| **Severity** | Critical |

**Description:**
Five collections grant anonymous users full or near-full access:

| Collection | create | read | update | delete |
|-----------|--------|------|--------|--------|
| `media` | `() => true` | `() => true` | `() => true` | `() => true` |
| `ticket-templates` | `() => true` | `() => true` | `() => true` | `() => true` |
| `call-signals` | `() => true` | `() => true` | `() => true` | `() => true` |
| `calendar-events` | `() => true` | `() => true` | `() => true` | `() => true` |
| `messages` | `() => true` | `() => true` | n/a | n/a |
| `event` | `() => true` | `() => true` | n/a | n/a |
| `posts` | n/a | `() => true` | n/a | n/a |

**Proof of Concept:**
```bash
# Delete all ticket templates
curl -X DELETE http://localhost:3000/api/ticket-templates/1

# Impersonate any user in chat
curl -X POST http://localhost:3000/api/messages \
  -H 'Content-Type: application/json' \
  -d '{"sender":"admin","content":"I am definitely the admin"}'

# Delete all calendar events
curl -X DELETE http://localhost:3000/api/calendar-events/1

# Read all call signaling data (eavesdrop)
curl http://localhost:3000/api/call-signals?limit=1000
```

**Impact:**
- Data destruction: any user can delete all templates, events, messages, media
- Data tampering: modify existing records without authentication
- Impersonation: create messages as any sender name
- Privacy violation: read all call signaling data (SDP offers with IP addresses)

**Remediation:**
Add proper access control to every collection. At minimum, require authentication for write operations:
```typescript
access: {
  create: ({ req }) => !!req.user,
  read: () => true,
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
```

---

#### C3: PAYLOAD_SECRET Falls Back to Empty String

| Field | Value |
|-------|-------|
| **OWASP** | A02 Cryptographic Failures |
| **File** | `test-payload/src/payload.config.ts:30` |
| **Severity** | Critical |

**Description:**
```typescript
secret: process.env.PAYLOAD_SECRET || '',
```
If the `PAYLOAD_SECRET` environment variable is not set (common in CI/CD, Docker without env, or fresh deployments), the secret defaults to an empty string. This completely undermines JWT signing, session tokens, and all Payload CMS authentication.

Additionally, the actual secret in `.env` is only 24 hex characters (`705ef6f858d5f7680744c83f` = 96 bits), which is below the recommended 256-bit minimum for HMAC secrets.

**Proof of Concept:**
If the env var is unset, an attacker can forge valid JWT tokens with an empty secret:
```javascript
// Forge a valid admin JWT when PAYLOAD_SECRET is empty
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, email: 'admin@example.com', collection: 'users' }, '');
// Use this token to access admin endpoints
```

**Impact:**
- Complete authentication bypass if env var is not set
- Weak secret (96 bits) even when set — vulnerable to brute force

**Remediation:**
```typescript
const secret = process.env.PAYLOAD_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('PAYLOAD_SECRET must be set and at least 32 characters long');
}
// In buildConfig:
secret,
```
Generate a strong secret: `openssl rand -hex 32` (256 bits).

---

#### C4: GraphQL Playground Exposed Without Production Guard

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `test-payload/src/app/(payload)/api/graphql-playground/route.ts:7` |
| **Severity** | Critical |

**Description:**
The GraphQL Playground is available at `/api/graphql-playground` with no environment check. Combined with the open access control on collections (C2), an attacker can interactively explore the entire schema, enumerate all data, and perform mutations.

**Proof of Concept:**
Navigate to `http://localhost:3000/api/graphql-playground` and run:
```graphql
{
  Users { docs { id email } }
  Messages { docs { id sender content } }
  CallSignals { docs { id from to type data } }
  TicketTemplates { docs { id name csvData } }
}
```

**Impact:**
- Full schema introspection reveals all collection structures
- Combined with C2, enables data exfiltration of all collections
- Enables targeted mutation attacks

**Remediation:**
Disable GraphQL playground in production. In `payload.config.ts`:
```typescript
graphQL: {
  disable: process.env.NODE_ENV === 'production',
  // Or at minimum disable playground:
  disablePlaygroundInProduction: true,
},
```

---

### HIGH

#### H1: No CSRF Protection Configured

| Field | Value |
|-------|-------|
| **OWASP** | A01 Broken Access Control |
| **File** | `test-payload/src/payload.config.ts` |
| **Severity** | High |

**Description:**
The Payload CMS config does not explicitly configure CSRF protection. While Payload 3.x has some built-in CSRF handling, the configuration does not set a `csrf` array. Combined with the open CORS policy and cookie-based sessions, cross-site requests could target state-changing endpoints.

**Attack Scenario:**
An attacker hosts a page that automatically submits a form to `http://localhost:3000/api/ticket-templates` to delete or modify templates while a logged-in admin has the Payload admin panel open.

**Remediation:**
Add explicit CSRF configuration:
```typescript
csrf: ['http://localhost:5173', 'http://localhost:4173'],
```

---

#### H2: CORS Configuration Only Allows Development Origins

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `test-payload/src/payload.config.ts:27` |
| **Severity** | High |

**Description:**
```typescript
cors: ['http://localhost:5173', 'http://localhost:4173'],
```
Only localhost development origins are configured. In production:
- If unchanged, the frontend on a real domain will fail CORS checks
- Common "quick fix" is setting `cors: '*'`, which removes all cross-origin protections
- No production domain is included, suggesting deployment hasn't been considered

**Remediation:**
Use environment-based CORS:
```typescript
cors: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
```

---

#### H3: Call Signaling Data Fully Open - Eavesdropping and Impersonation

| Field | Value |
|-------|-------|
| **OWASP** | A01 Broken Access Control + A07 Identification and Authentication Failures |
| **Files** | `test-payload/src/collections/CallSignal.ts:8-12`, `frontend/src/lib/stores/call.svelte.ts` |
| **Severity** | High |

**Description:**
The `call-signals` collection stores WebRTC signaling data (SDP offers/answers containing IP addresses and ICE candidates) with anonymous full CRUD access. The frontend call system (`call.svelte.ts`) uses simple username strings for identification with no authentication.

**Proof of Concept:**
```bash
# Eavesdrop on all calls - get SDP offers containing private IPs
curl 'http://localhost:3000/api/call-signals?limit=1000' | jq '.docs[] | {from, to, type, data}'

# Impersonate user and inject fake offer
curl -X POST http://localhost:3000/api/call-signals \
  -H 'Content-Type: application/json' \
  -d '{"callId":"fake-call","from":"alice","to":"bob","type":"offer","data":{"sdp":"v=0\r\n...","type":"offer"},"status":"pending"}'

# Inject malicious ICE candidates to redirect media streams
curl -X POST http://localhost:3000/api/call-signals \
  -H 'Content-Type: application/json' \
  -d '{"callId":"real-call-id","from":"alice","to":"bob","type":"ice-candidate","data":{"candidate":"candidate:1 1 udp 2130706431 attacker-ip 12345 typ host"}}'
```

**Impact:**
- Call eavesdropping (read SDP data with private IP addresses)
- Call hijacking (inject fake signaling)
- Man-in-the-middle via ICE candidate injection

**Remediation:**
- Require authentication for call signal operations
- Filter read access so users only see signals addressed to them
- Add `where` filters: `read: ({ req }) => ({ or: [{ from: { equals: req.user?.email } }, { to: { equals: req.user?.email } }] })`

---

#### H4: Server Error Body Leaked to Frontend Users

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `frontend/src/lib/api/client.ts:21` |
| **Severity** | High |

**Description:**
```typescript
throw new Error(`API error: ${res.status} ${res.statusText} - ${errorBody}`);
```
The full server error response body is included in the thrown error. This is caught in multiple places and displayed in toast notifications or logged to the console. Server error responses can contain stack traces, SQL errors, file paths, and other internal details.

**Attack Scenario:**
Send a malformed request to trigger a server error. The full error details (including internal paths, database schema information) are exposed in the browser console and potentially in toast messages.

**Remediation:**
```typescript
if (!res.ok) {
  const errorBody = await res.text().catch(() => '');
  console.error(`API error [${res.status}]:`, errorBody); // Log full detail for devs
  throw new Error(`Request failed (${res.status})`);       // Expose only status code
}
```

---

#### H5: Unsanitized JSON Deserialization in .veenttix Project Import

| Field | Value |
|-------|-------|
| **OWASP** | A08 Software and Data Integrity Failures |
| **File** | `frontend/src/lib/components/ticket/sidebar/ProjectActions.svelte:65` |
| **Severity** | High |

**Description:**
```typescript
const project: ProjectData = JSON.parse(ev.target?.result as string);
```
The parsed JSON from a `.veenttix` file is cast to `ProjectData` and directly applied to all application stores without any schema validation. The TypeScript type assertion provides no runtime safety.

**Attack Scenario:**
Craft a malicious `.veenttix` file:
```json
{
  "version": "1.0",
  "elements": [{"type":"text","textFormat":"<script>alert('xss')</script>","id":"x","position":{"x":0,"y":0},"size":{"width":99999,"height":99999},"rotation":0,"styles":{"fontSize":999999,"color":"#000","fontFamily":"Arial","fontBold":false,"fontItalic":false,"fontUnderline":false,"backgroundColor":"","opacity":1,"horizontalAlign":"left","verticalAlign":"top"},"allowOverflow":true,"containInBox":false,"disableNewLine":false}],
  "csvData": [{"Name":"=CMD|'/C calc'!A0"}],
  "csvHeaders": ["Name"],
  "ticketSettings": {"type":"ticket","width":99999,"height":99999,"fitMode":"cover"},
  "printSettings": {"ticketGap": -100},
  "labelSettings": {"labelColumn":"","labelColors":{},"labelBlockWidth":0,"rightBlockEnabled":false,"rightBlockWidth":0},
  "backgroundImage": null,
  "timestamp": "2026-01-01"
}
```
This could cause: extreme canvas sizes (memory DoS), negative gaps (layout corruption), formula injection payloads in CSV data, and oversized elements.

**Remediation:**
Add runtime schema validation before applying imported data:
```typescript
function validateProjectData(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'string') return false;
  if (!Array.isArray(d.elements)) return false;
  // Validate numeric ranges for width, height, fontSize, etc.
  // Validate string lengths for text content
  return true;
}
```

---

#### H6: No Input Limits on CSV Parser

| Field | Value |
|-------|-------|
| **OWASP** | A04 Insecure Design |
| **Files** | `frontend/src/lib/utils/csv-parser.ts`, `frontend/src/lib/components/ticket/sidebar/FileUploadSection.svelte:16` |
| **Severity** | High |

**Description:**
While `FileUploadSection.svelte:16` checks file size (`5 * 1024 * 1024`), the `parseCSV` function itself has no limits on:
- Number of rows (a 5MB CSV could have millions of short rows)
- Number of columns
- Length of individual cell values

Additionally, the `.veenttix` import path (`ProjectActions.svelte:65`) bypasses the file size check entirely, directly loading CSV data from the JSON file into the store.

**Attack Scenario:**
Upload a 5MB CSV with 1 million rows of 5 characters each. The parser creates 1 million objects, each with header-keyed properties, consuming hundreds of MB of memory and freezing the browser tab.

**Remediation:**
Add limits in `parseCSV`:
```typescript
const MAX_ROWS = 10000;
const MAX_COLUMNS = 100;
const MAX_CELL_LENGTH = 5000;

if (headers.length > MAX_COLUMNS) throw new Error(`Too many columns (max ${MAX_COLUMNS})`);
// In the row loop:
if (data.length >= MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS})`);
```

---

#### H7: No Size Limit or Server-Side Validation for Background Image Uploads

| Field | Value |
|-------|-------|
| **OWASP** | A04 Insecure Design |
| **File** | `frontend/src/lib/components/ticket/sidebar/FileUploadSection.svelte:33-43` |
| **Severity** | High |

**Description:**
The background image upload handler (`handleBackgroundFile`) has:
- `accept="image/*"` attribute (client-side only, easily bypassed)
- No file size limit (unlike CSV which has 5MB check)
- The file is read as a data URL and stored in memory
- The data URL is then saved to IndexedDB via autosave and potentially uploaded to Payload CMS (which has no MIME/size restrictions per C1)

**Attack Scenario:**
Upload a 200MB image file. It gets:
1. Loaded into memory as a base64 data URL (~267MB after encoding)
2. Stored in Svelte reactive state
3. Auto-saved to IndexedDB (doubling memory usage during write)
4. If saved as template, uploaded to Payload's unrestricted media endpoint

**Remediation:**
Add size validation in the file handler:
```typescript
function handleBackgroundFile(e: Event) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('error', 'File too large', 'Image must be under 10MB');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('error', 'Invalid file', 'Please upload an image file');
    return;
  }
  // ... proceed
}
```

---

### MEDIUM

#### M1: CSV Injection (Formula Injection) Not Sanitized

| Field | Value |
|-------|-------|
| **OWASP** | A03 Injection |
| **File** | `frontend/src/lib/utils/csv-parser.ts:4-33` |
| **Severity** | Medium |

**Description:**
The CSV parser does not sanitize formula injection characters. CSV cell values starting with `=`, `+`, `-`, `@`, `|`, or `\t` are preserved verbatim. While the current application renders CSV data to canvas (not Excel), the data is:
- Stored in IndexedDB
- Saved to Payload CMS backend (in `ticket-templates.csvData`)
- Exported in `.veenttix` JSON files
- Used as QR/barcode values

If this data is ever opened in a spreadsheet or re-exported as CSV, formula injection could execute arbitrary commands.

**Proof of Concept:**
Upload CSV:
```csv
Name,Email
=CMD|'/C calc'!A0,test@example.com
+cmd|'/C calc'!A0,evil@example.com
```
This data flows through the entire system unmodified.

**Remediation:**
Sanitize CSV values that start with formula-triggering characters:
```typescript
function sanitizeCsvValue(value: string): string {
  if (/^[=+\-@|\t]/.test(value)) {
    return "'" + value; // Prefix with single quote to neutralize formula
  }
  return value;
}
```

---

#### M2: Large Background Images as Base64 Data URLs Cause Memory Pressure

| Field | Value |
|-------|-------|
| **OWASP** | A04 Insecure Design |
| **Files** | `frontend/src/lib/stores/canvas.svelte.ts`, `frontend/src/lib/stores/autosave.svelte.ts:198-200` |
| **Severity** | Medium |

**Description:**
Background images are stored as base64 data URLs in reactive state and auto-saved to IndexedDB. The autosave converts data URLs to blobs for storage (`autosave.svelte.ts:198-200`), but during the conversion and write process, both the data URL and blob exist in memory simultaneously.

**Impact:** Browser tab slowdown or crash with large images. IndexedDB storage quota may be exceeded.

**Remediation:**
- Add file size validation before loading (see H7)
- Consider using `URL.createObjectURL()` instead of data URLs to avoid base64 overhead
- Set a maximum image dimension (e.g., 4096x4096px) and resize on load

---

#### M3: Template Names Not Sanitized

| Field | Value |
|-------|-------|
| **OWASP** | A03 Injection |
| **File** | `frontend/src/lib/stores/templates.svelte.ts:121-123` |
| **Severity** | Medium |

**Description:**
Template names come from user input via `prompt()` in `TemplateSection.svelte:131` and are:
- Used in case-insensitive comparisons without length limits
- Sent directly to the Payload API
- Rendered in `<option>` elements and toast messages

While Svelte's template syntax auto-escapes by default (no `{@html}` usage found), template names could contain excessively long strings or special characters that disrupt UI layout.

**Remediation:**
Validate template name before use:
```typescript
const name = prompt('Template name:', defaultName)?.trim();
if (!name || name.length > 100) return;
if (!/^[\w\s\-().]+$/.test(name)) {
  showToast('error', 'Invalid name', 'Use only letters, numbers, spaces, hyphens, and parentheses');
  return;
}
```

---

#### M4: Unvalidated Data URL in Blob Conversion

| Field | Value |
|-------|-------|
| **OWASP** | A08 Software and Data Integrity Failures |
| **File** | `frontend/src/lib/stores/autosave.svelte.ts:66-68` |
| **Severity** | Medium |

**Description:**
```typescript
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
```
The `fetch()` call on a data URL is safe for well-formed data URLs, but if IndexedDB data is tampered with (e.g., via browser DevTools or a malicious extension), the `backgroundImage` string could be replaced with an HTTP URL, causing an outbound request when the autosave runs.

**Remediation:**
Validate the protocol before fetching:
```typescript
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }
  const res = await fetch(dataUrl);
  return res.blob();
}
```

---

#### M5: No Rate Limiting on Message Creation

| Field | Value |
|-------|-------|
| **OWASP** | A04 Insecure Design |
| **File** | `test-payload/src/collections/Message.ts:8-10` |
| **Severity** | Medium |

**Description:**
The Messages collection allows anonymous creation with only `maxLength` validation on fields (sender: 50, content: 1000). No rate limiting exists, allowing an attacker to flood the database with spam messages.

**Proof of Concept:**
```bash
for i in $(seq 1 10000); do
  curl -s -X POST http://localhost:3000/api/messages \
    -H 'Content-Type: application/json' \
    -d '{"sender":"spammer","content":"spam message '$i'"}' &
done
```

**Remediation:**
- Require authentication for message creation
- Add rate limiting middleware or Payload hooks
- Add a `beforeChange` hook to throttle creation per IP/user

---

#### M6: No Rate Limiting on Call Signal Creation

| Field | Value |
|-------|-------|
| **OWASP** | A04 Insecure Design |
| **File** | `test-payload/src/collections/CallSignal.ts:8-12` |
| **Severity** | Medium |

**Description:**
Similar to M5, the CallSignal collection has no rate limiting. An attacker could flood the collection with fake signals, disrupting the polling-based signaling system used by `call.svelte.ts` (which polls every 1000ms in `startSignalingPoll`).

**Impact:** Denial of service for the call system. Legitimate signals buried under spam.

**Remediation:** Same as M5 - require auth and add rate limiting.

---

#### M7: `document.write` Used for Print Window Construction

| Field | Value |
|-------|-------|
| **OWASP** | A03 Injection |
| **File** | `frontend/src/lib/components/ticket/PreviewTab.svelte:120-169` |
| **Severity** | Medium |

**Description:**
The `doPrint` function constructs an HTML string via string concatenation and writes it to a new window using `printWindow.document.write(html)`. The HTML includes data URL images from canvas rendering.

Currently, the image `src` values are data URLs generated by `canvas.toDataURL()`, so they don't contain user-controlled HTML. However:
- The pattern of building HTML via string concatenation is fragile
- If any future change introduces user data into the HTML construction (e.g., ticket labels, names), it would create a direct XSS vector
- `document.write` is deprecated in modern standards

**Current Risk:** Low (data flows are safe today)
**Future Risk:** High (pattern is one code change away from XSS)

**Remediation:**
Use DOM APIs instead of string concatenation:
```typescript
const pageDiv = printWindow.document.createElement('div');
pageDiv.className = 'page';
const img = printWindow.document.createElement('img');
img.src = previewImages[ticketIdx]; // Safe - data URL from canvas
pageDiv.appendChild(img);
```

---

#### M8: JSON Fields in Collections Accept Arbitrary Data

| Field | Value |
|-------|-------|
| **OWASP** | A03 Injection + A04 Insecure Design |
| **Files** | `test-payload/src/collections/TicketTemplate.ts:68-70,82-84,103-109`, `test-payload/src/collections/CallSignal.ts:43-45` |
| **Severity** | Medium |

**Description:**
Four `type: 'json'` fields accept arbitrary JSON with no schema validation:
- `TicketTemplate.elements` (line 68-70) - expected to be `TicketElement[]`
- `TicketTemplate.labelColors` (line 82-84) - expected to be `Record<string, string>`
- `TicketTemplate.csvData` (line 103-104) - expected to be `Record<string, string>[]`
- `TicketTemplate.csvHeaders` (line 107-108) - expected to be `string[]`
- `CallSignal.data` (line 43-45) - expected to be SDP/ICE data

An attacker can store arbitrary JSON payloads that may cause unexpected behavior when loaded by the frontend.

**Remediation:**
Add `validate` functions to JSON fields:
```typescript
{
  name: 'elements',
  type: 'json',
  required: true,
  validate: (value) => {
    if (!Array.isArray(value)) return 'Elements must be an array';
    if (value.length > 500) return 'Too many elements (max 500)';
    return true;
  },
},
```

---

### LOW / INFORMATIONAL

#### L1: No Content Security Policy (CSP) Headers

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **Files** | `frontend/vite.config.ts`, `test-payload/src/payload.config.ts` |
| **Severity** | Low |

**Description:**
Neither the SvelteKit frontend nor the Payload CMS backend configure Content Security Policy headers. CSP would mitigate XSS attacks by restricting script sources, style sources, and image sources.

**Remediation:**
Add CSP headers in the SvelteKit hooks or Payload middleware. Example for SvelteKit `hooks.server.ts`:
```typescript
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'");
  return response;
};
```

---

#### L2: No Audit Logging for CRUD Operations

| Field | Value |
|-------|-------|
| **OWASP** | A09 Security Logging and Monitoring Failures |
| **Files** | All collections in `test-payload/src/collections/` |
| **Severity** | Low |

**Description:**
No collections have `hooks` configured for logging create, update, or delete operations. There is no way to trace who modified data, when, or what changed. This makes incident response and forensics impossible.

**Remediation:**
Add `afterChange` and `afterDelete` hooks for audit logging:
```typescript
hooks: {
  afterChange: [({ doc, operation, req }) => {
    console.log(`[AUDIT] ${operation} on ${collection.slug} by ${req.user?.email || 'anonymous'}: ${doc.id}`);
  }],
},
```

---

#### L3: External STUN Server Dependency

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `frontend/src/lib/stores/call.svelte.ts:26` |
| **Severity** | Low |

**Description:**
```typescript
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
```
The call system depends on Google's public STUN server. No TURN server is configured, meaning calls will fail behind symmetric NATs. The dependency on an external Google service creates availability risk.

**Remediation:**
- Add TURN server configuration for NAT traversal
- Consider self-hosted STUN/TURN (e.g., coturn)
- Add fallback STUN servers

---

#### L4: Silent Error Swallowing in Call System

| Field | Value |
|-------|-------|
| **OWASP** | A09 Security Logging and Monitoring Failures |
| **File** | `frontend/src/lib/stores/call.svelte.ts:73,109,169,217,279` |
| **Severity** | Low |

**Description:**
Multiple `catch` blocks silently discard errors with `// silent fail` comments:
- Line 73: `pollForIncomingCalls` - incoming call poll failures are invisible
- Line 109: `startCall` - call initiation failures are invisible
- Line 169: `declineCall` - decline failures silently ignored
- Line 217: ICE candidate send failures silently ignored
- Line 279: signal poll failures silently ignored

**Impact:** Makes debugging production issues nearly impossible. Security-relevant errors (network failures, auth failures) are hidden.

**Remediation:**
Replace silent catches with at minimum `console.warn` or a telemetry call:
```typescript
} catch (err) {
  console.warn('Failed to poll for incoming calls:', err);
}
```

---

#### L5: Vite Dev Proxy Forwards All /api Requests

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `frontend/vite.config.ts:13-19` |
| **Severity** | Low |

**Description:**
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```
All requests to `/api` are proxied to the Payload CMS backend. This is standard for development but:
- `changeOrigin: true` modifies the `Host` header, which could mask the true origin
- In production, the proxy configuration should come from a proper reverse proxy (nginx, Caddy) with proper security headers

**Remediation:** Ensure this proxy is dev-only (it is, since it's under `server`). Add a comment documenting the production proxy requirements.

---

#### L6: No HTTPS Enforcement

| Field | Value |
|-------|-------|
| **OWASP** | A02 Cryptographic Failures |
| **Files** | `frontend/.env:1`, `test-payload/src/payload.config.ts:27` |
| **Severity** | Low |

**Description:**
All URLs use `http://`:
- `PUBLIC_PAYLOAD_URL=http://localhost:3000`
- `cors: ['http://localhost:5173', 'http://localhost:4173']`

In production, all traffic must use HTTPS. Credentials, session tokens, and WebRTC signaling data would be transmitted in plaintext over HTTP.

**Remediation:**
- Use HTTPS in production environment variables
- Add HSTS headers
- Redirect HTTP to HTTPS at the reverse proxy level

---

#### L7: qrious Library Not Actively Maintained

| Field | Value |
|-------|-------|
| **OWASP** | A06 Vulnerable and Outdated Components |
| **File** | `frontend/package.json:35` |
| **Severity** | Low |

**Description:**
`qrious` (v4.0.2) has not been updated since 2018 (8 years ago). While no known CVEs exist, unmaintained libraries:
- Won't receive security patches if vulnerabilities are discovered
- May have compatibility issues with newer browsers
- May use deprecated APIs

**Remediation:**
Consider migrating to an actively maintained QR library such as `qrcode` or `@loskir/styled-qr-code`.

---

#### L8: Users Collection Relies on Implicit Payload Auth Defaults

| Field | Value |
|-------|-------|
| **OWASP** | A05 Security Misconfiguration |
| **File** | `test-payload/src/collections/Users.ts:3-14` |
| **Severity** | Low |

**Description:**
The Users collection has `auth: true` but no explicit `access` control configuration. Payload CMS auth collections have sensible defaults (only the user themselves can read/update their record, only admins can create/delete), but relying on implicit defaults is fragile:
- Defaults could change between Payload versions
- New team members may not understand the implicit behavior
- No documentation of intended access patterns

**Remediation:**
Add explicit access control:
```typescript
access: {
  create: ({ req }) => !!req.user, // Only authenticated users can create
  read: ({ req }) => !!req.user,
  update: ({ req, id }) => req.user?.id === id, // Users can only update themselves
  delete: ({ req }) => req.user?.role === 'admin', // Only admins can delete
},
```

---

## Summary Table

| ID | Severity | OWASP | Finding | Primary File |
|----|----------|-------|---------|-------------|
| C1 | Critical | A01, A04 | Unrestricted media upload | `collections/Media.ts` |
| C2 | Critical | A01 | Anonymous CRUD on 5/8 collections | Multiple collections |
| C3 | Critical | A02 | PAYLOAD_SECRET empty string fallback | `payload.config.ts:30` |
| C4 | Critical | A05 | GraphQL Playground exposed | `api/graphql-playground/route.ts` |
| H1 | High | A01 | No CSRF protection configured | `payload.config.ts` |
| H2 | High | A05 | CORS only allows localhost | `payload.config.ts:27` |
| H3 | High | A01, A07 | Call signals fully open | `collections/CallSignal.ts` |
| H4 | High | A05 | Server error body leaked | `api/client.ts:21` |
| H5 | High | A08 | Unsanitized .veenttix import | `ProjectActions.svelte:65` |
| H6 | High | A04 | No CSV parser input limits | `csv-parser.ts` |
| H7 | High | A04 | No background image size limit | `FileUploadSection.svelte:33` |
| M1 | Medium | A03 | CSV formula injection | `csv-parser.ts` |
| M2 | Medium | A04 | Base64 data URL memory pressure | `canvas.svelte.ts`, `autosave.svelte.ts` |
| M3 | Medium | A03 | Template names unsanitized | `templates.svelte.ts:121` |
| M4 | Medium | A08 | Unvalidated data URL in blob conversion | `autosave.svelte.ts:66` |
| M5 | Medium | A04 | No rate limiting on messages | `collections/Message.ts` |
| M6 | Medium | A04 | No rate limiting on call signals | `collections/CallSignal.ts` |
| M7 | Medium | A03 | document.write for print window | `PreviewTab.svelte:169` |
| M8 | Medium | A03, A04 | JSON fields accept arbitrary data | `TicketTemplate.ts`, `CallSignal.ts` |
| L1 | Low | A05 | No CSP headers | Config files |
| L2 | Low | A09 | No audit logging | All collections |
| L3 | Low | A05 | External STUN server dependency | `call.svelte.ts:26` |
| L4 | Low | A09 | Silent error swallowing in calls | `call.svelte.ts` |
| L5 | Low | A05 | Vite dev proxy forwards /api | `vite.config.ts:14` |
| L6 | Low | A02 | No HTTPS enforcement | `.env`, `payload.config.ts` |
| L7 | Low | A06 | qrious library unmaintained | `package.json:35` |
| L8 | Low | A05 | Users collection implicit defaults | `collections/Users.ts` |

---

## Priority Remediation Roadmap

### Immediate (Before any deployment)
1. **C1 + C2**: Add access control to all collections (require auth for write operations)
2. **C3**: Fail on missing/weak PAYLOAD_SECRET
3. **C1**: Add MIME type and file size restrictions to Media uploads
4. **C4**: Disable GraphQL Playground in production

### Short-term (Within 1 sprint)
5. **H4**: Sanitize error messages in API client
6. **H5**: Add schema validation for .veenttix imports
7. **H6**: Add row/column limits to CSV parser
8. **H7**: Add file size validation for background images
9. **H1**: Configure CSRF protection
10. **H2**: Use environment-based CORS origins

### Medium-term (Within 2-3 sprints)
11. **H3**: Secure call signaling with authentication
12. **M1-M8**: Address all medium findings
13. **L1**: Add CSP headers
14. **L2**: Add audit logging hooks

---

*Report generated by Security Guardian as part of the quality-assurance team audit.*

---

## Cross-Review Notes from Security Guardian

*Reviewed: `frontend/reports/test-coverage-audit.md` (Test Engineer) and `frontend/reports/bug-audit.md` (Bug Hunter)*
*Date: 2026-02-18*

---

### 1. Bugs That Are Actually Security Issues (Reclassification Recommendations)

#### BUG-C3 (Race condition in call polling) -> Security: Call Hijacking Vector

Bug Hunter's BUG-C3 identifies a race condition where an incoming call poll can overwrite an active outgoing call. Beyond the resource leak described, this has **direct security implications** that map to my finding **H3 (Call signals fully open)**:

- An attacker who can create call signals (trivial — collection is fully open per my C2) can **time a fake incoming offer** to coincide with a victim's outgoing call
- The race overwrites `callId` and `remoteUser`, effectively hijacking the signaling state
- The orphaned peer connection from the original call may still be connected, leaking the audio stream

**Recommendation:** Reclassify as Security-Critical. The fix must include both the re-check guard AND access control on the CallSignal collection.

#### BUG-C4 (Barcode fallback crash) -> Security: Denial-of-Service via Crafted Input

Bug Hunter correctly identifies the unhandled second failure in `barcode-generator.ts`. From a security perspective, this is exploitable as a **targeted denial-of-service**:

- A malicious CSV can include barcode values that fail both the primary format AND CODE128 fallback (e.g., empty strings, control characters)
- This crashes `renderTicketToCanvas()`, which aborts `exportAllAsPNG()` mid-way
- All remaining tickets in the batch are lost — the entire export fails
- This maps to my finding **H5 (Unsanitized .veenttix import)** — a malicious project file could include elements with crafted barcode placeholders

**Recommendation:** Keep as Critical bug, add a note that it's also a security-relevant DoS vector (OWASP A04 Insecure Design).

#### BUG-C2 (restoreSession Promise.all failure) -> Security: Autosave Data Integrity

Beyond the data loss Bug Hunter describes, this has a security angle related to my **M4 finding (Unvalidated data URL in blob conversion)**:

- If an attacker (via XSS or malicious browser extension) tampers with a single IndexedDB key, `Promise.all` rejects and the user loses ALL saved work
- With `Promise.allSettled`, individual corrupt keys are isolated — but this also means **tampered data in one key still gets restored** without validation
- The fix should combine `Promise.allSettled` with **per-key validation** before applying to stores

**Recommendation:** Keep as Critical, add security note about IndexedDB tampering resistance.

#### BUG-M6 (dataUrlToFile crash) -> Security: Pairs with Security M4

Bug Hunter's BUG-M6 (malformed data URL crashes `dataUrlToFile`) and my M4 (unvalidated data URL in `dataUrlToBlob`) target the **same attack surface** — corrupted data URLs flowing from IndexedDB. These should be fixed together:

- `autosave.svelte.ts:66` — `dataUrlToBlob()` needs `data:` prefix validation (my M4)
- `templates.svelte.ts:81` — `dataUrlToFile()` needs format validation (BUG-M6)
- Both functions receive data URLs from the same source (background image store)

**Recommendation:** Fix both as a single remediation task. Add `data:` prefix check and comma presence validation to both functions.

#### BUG-M1 (localStorage crash in private browsing) -> Security: Availability Impact

While Bug Hunter classifies this as Medium (app fails to load), from a security perspective this is an **availability issue** (OWASP A04):
- The crash happens at module evaluation time, so the ENTIRE app fails — not just dark mode
- Users in restricted environments (corporate iframe sandboxes, privacy-focused browsers) are completely locked out

**Recommendation:** Keep as Medium, note the availability (A04) dimension.

---

### 2. Security-Critical Test Scenarios Missing from Test Coverage Audit

The Test Engineer's priority rankings are based on **logic complexity x usage frequency x failure impact**, which is appropriate for functional testing. However, several files are under-prioritized from a security perspective:

#### 2.1 `client.ts` should be P0, not P1

**Current ranking:** P1 (High)
**Security-adjusted ranking:** P0 (Critical)

`client.ts` is the single gateway for ALL API communication. The test coverage report lists "throws on non-ok response with error text" as a scenario — but from a security perspective, the test should verify that **raw server error bodies are NOT propagated to the UI** (my finding H4). Specific security test cases needed:

| Scenario | Security Relevance |
|----------|-------------------|
| Error response body is sanitized/truncated before throwing | H4: Prevents server info leakage |
| `endpoint` parameter cannot be used for SSRF (e.g., `endpoint = 'http://evil.com'`) | The `startsWith('http')` check at line 7 actually ENABLES this — any `http://` URL bypasses `BASE_URL` |
| FormData requests do NOT include Content-Type header (browser sets boundary) | Prevents malformed multipart requests |

**Critical finding I missed in my original audit:** `client.ts:7` — `const url = endpoint.startsWith('http') ? endpoint : \`${BASE_URL}${endpoint}\`;` — if any API function passes a user-controlled value as `endpoint`, it bypasses the BASE_URL entirely. Currently all endpoints are hardcoded strings, but this is a latent SSRF-enabling pattern.

#### 2.2 `Media.ts` (backend) should be P0, not P2

**Current ranking:** P2 (Medium) — "File upload; no type/size restrictions in config"
**Security-adjusted ranking:** P0 (Critical)

The test report acknowledges "no type/size restrictions" but ranks it P2 based on code complexity (22 LOC). From a security perspective, this is the **most dangerous collection** (my C1 finding). Security test cases needed:

| Scenario | Security Relevance |
|----------|-------------------|
| Reject non-image MIME types (after fix) | C1: Prevent arbitrary file upload |
| Reject files over size limit (after fix) | C1: Prevent disk exhaustion DoS |
| Verify access control requires authentication (after fix) | C2: Prevent anonymous uploads |
| Verify uploaded filename is sanitized (no path traversal) | Prevent directory traversal |

#### 2.3 Access control tests are completely absent

The test coverage report does not include **any** test scenarios for collection access control. Not a single test verifies that anonymous users are blocked from write operations. This is the single largest security testing gap:

| Collection | Required Access Control Tests |
|-----------|------------------------------|
| All 8 collections | Verify anonymous POST returns 401/403 (after fix) |
| All 8 collections | Verify anonymous PATCH returns 401/403 (after fix) |
| All 8 collections | Verify anonymous DELETE returns 401/403 (after fix) |
| `media` | Verify upload requires authentication |
| `call-signals` | Verify read is filtered by caller/callee identity |
| `users` | Verify users cannot read other users' data |

#### 2.4 Missing security-specific test scenarios

These test scenarios are absent from the test coverage audit but are critical for security:

| File | Security Test Scenario | Related Finding |
|------|----------------------|-----------------|
| `csv-parser.ts` | Formula injection characters (`=`, `+`, `-`, `@`) are sanitized | M1 |
| `csv-parser.ts` | CSV with >10,000 rows is rejected | H6 |
| `csv-parser.ts` | CSV with >100 columns is rejected | H6 |
| `ProjectActions.svelte` | Malformed `.veenttix` JSON is rejected with user-friendly error | H5 |
| `ProjectActions.svelte` | `.veenttix` with extreme numeric values (width: 999999) is rejected | H5 |
| `FileUploadSection.svelte` | Background image >10MB is rejected | H7 |
| `FileUploadSection.svelte` | Non-image file for background is rejected | H7 |
| `autosave.svelte.ts` | `dataUrlToBlob` rejects non-data: URLs | M4 |
| `templates.svelte.ts` | `dataUrlToFile` rejects malformed data URLs | BUG-M6 |
| `templates.svelte.ts` | Template name with >100 chars is rejected | M3 |
| `png-export.ts` | Filename collision (duplicate sanitized names) uses index fallback | BUG-M10 |
| `payload.config.ts` | PAYLOAD_SECRET empty/short throws on startup | C3 |

---

### 3. Challenges to Specific Findings

#### Test Coverage Audit

**Challenge: `call.svelte.ts` ranked P3 (Low) — "very low testability"**

I disagree with the P3 ranking. While the WebRTC APIs are hard to mock, the **signaling logic** (poll intervals, state machine transitions, signal processing) can be tested by mocking the API layer. Given that call signaling has critical security vulnerabilities (my H3, plus BUG-C3), at minimum the state machine and poll guard logic should be unit tested:

- Verify `pollForIncomingCalls` returns early when `callState !== 'idle'` (the exact bug in BUG-C3)
- Verify signal processing rejects signals from unexpected callIds
- Verify `cleanup()` stops all timers and closes connections

**Recommendation:** Move to at least P1 for the non-WebRTC logic.

**Challenge: Backend collection tests focus on CRUD, not security**

The test coverage audit's backend test scenarios (Section 5.6) focus entirely on CRUD functionality — "Create template with valid name", "Delete template", etc. None of the proposed scenarios test **negative cases** that security depends on:
- What happens when a field exceeds maxLength?
- What happens when a required field is missing?
- What happens when a JSON field contains invalid schema?
- What happens when access is denied?

**Recommendation:** Add a "Security test scenarios" subsection to Section 5.6 for each collection.

#### Bug Audit

**Challenge: BUG-M7 (zero-dimension image) should be Low, not Medium**

For `img.width === 0 || img.height === 0` to occur, the browser would need to fire `onload` on an image with zero intrinsic dimensions. This only happens with:
- SVGs without `width`/`height` attributes AND no `viewBox` (extremely rare as a background image)
- Broken images typically fire `onerror`, not `onload`

The `img.onerror = () => resolve()` handler at `canvas-render.ts:200` already handles broken images by skipping them. The zero-dimension case is a theoretical edge case that's nearly impossible in practice.

**Recommendation:** Downgrade to Low.

**Challenge: BUG-M8 (autoFitFontSize zero height) should be Low, not Medium**

The `resizable.ts` action enforces minimum dimensions of 50x20 (line 44: `Math.max(20, startH + dy)`). Users cannot resize an element to height 0 through the UI. This can only happen via:
- Programmatic `setElements()` with crafted data (covered by H5)
- Corrupted autosave data

**Recommendation:** Downgrade to Low. The root cause (unvalidated input data) is already covered by H5.

**Challenge: Bug audit doesn't cover backend at all**

The bug audit scope is limited to "frontend stores and utilities." No backend bugs were identified despite several obvious ones:
- `CalendarEvent.ts` allows `end_date < start_date` (noted by Test Engineer but not by Bug Hunter)
- `Event.ts` has `create: () => true` but no `update` or `delete` — Payload defaults to requiring authentication for unspecified operations, but this is inconsistent with the explicit create/read
- `TicketTemplate.ts` JSON fields accept arbitrary payloads (my M8)

The backend is where the most critical security issues live. A bug audit focused only on frontend misses the most impactful issues.

---

### 4. Additional Findings Identified During Cross-Review

#### NEW-1: Latent SSRF Pattern in `client.ts:7`

While reviewing the test coverage audit's scenarios for `client.ts`, I identified a pattern I should have escalated more strongly in my original audit:

```typescript
const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
```

If any future API function passes user-controlled input as the `endpoint` parameter, this pattern allows arbitrary URL requests from the client. Currently all callers use hardcoded endpoint strings, but `TemplateSection.svelte:43` has:

```typescript
const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
const response = await fetch(fullUrl);
```

This `fetchImageAsDataUrl` function takes a `url` from `tmpl.backgroundImage.url` — which comes from the Payload CMS backend. If the backend data is tampered with (trivial given C2's open access control), an attacker could set `backgroundImage.url` to any URL, and the frontend would fetch it.

**Severity:** Medium (requires backend data tampering, which is trivial given C2)
**OWASP:** A10 SSRF
**Remediation:** Validate that URLs from the backend match the expected `BASE_URL` origin before fetching.

#### NEW-2: `fetchImageAsDataUrl` Enables Cross-Origin Data Exfiltration

Extending NEW-1: `TemplateSection.svelte:42-51` fetches an arbitrary URL, converts the response to a blob, then to a data URL. If an attacker sets a template's `backgroundImage.url` to an internal network URL (e.g., `http://169.254.169.254/latest/meta-data/` on AWS), the frontend will:
1. Fetch the internal URL (browser-side, so limited to what the browser can reach)
2. Convert the response to a data URL
3. Store it in the application state
4. Auto-save it to IndexedDB
5. Potentially re-upload it to the backend if the user saves the template

This is a browser-side SSRF with data exfiltration capability, limited to URLs reachable from the user's browser.

---

### 5. Summary of Cross-Review Recommendations

| Action | Source | Priority |
|--------|--------|----------|
| Reclassify BUG-C3 as Security-Critical (call hijacking) | Bug Audit | Immediate |
| Add security note to BUG-C4 (DoS via crafted barcode) | Bug Audit | High |
| Fix BUG-M6 + Security M4 together (data URL validation) | Both | High |
| Promote `client.ts` to P0 in test priorities | Test Coverage | High |
| Promote `Media.ts` to P0 in test priorities | Test Coverage | High |
| Add access control test scenarios for ALL collections | Test Coverage | Critical |
| Add security-specific test scenarios (formula injection, size limits, schema validation) | Test Coverage | High |
| Promote `call.svelte.ts` signaling logic to P1 for testing | Test Coverage | Medium |
| Downgrade BUG-M7 and BUG-M8 to Low | Bug Audit | Informational |
| Extend bug audit scope to include backend collections | Bug Audit | High |
| Add NEW-1 and NEW-2 (SSRF via template image URL) to security remediation | New finding | Medium |

---

*Cross-review completed by Security Guardian, 2026-02-18.*
