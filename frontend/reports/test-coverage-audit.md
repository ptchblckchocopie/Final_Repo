# Test Coverage Audit Report

**Date:** 2026-02-18
**Auditor:** Test Engineer (quality-assurance team)
**Scope:** Full codebase — frontend (`frontend/src/lib/`) and backend (`test-payload/`)

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total source files audited | 45 |
| Total source LOC (non-test) | ~2,815 (frontend) + ~328 (backend collections) |
| Files with tests | 6 frontend + 3 backend = **9** |
| Files without tests | **36** |
| Existing test cases | 36 (frontend) + ~20 (backend) |
| Overall coverage | **~20%** of files, **~15%** of logic branches |

**Key findings:**

- Only 6 of 37 frontend source files have any test coverage; the other 31 files (stores, API clients, actions, generators) are completely untested.
- The most complex file (`canvas-render.ts`, 228 LOC, main rendering pipeline) has **zero tests**.
- All 14 Svelte stores (~1,120 LOC combined) are **completely untested** — this is the single largest gap.
- Backend: only the Messages collection has meaningful test coverage; the remaining 7 collections (including the critical `TicketTemplate` at 123 LOC) have **none**.
- Existing tests are mostly happy-path; edge cases, error paths, and boundary conditions are under-represented.

---

## 2. Summary Table — Frontend

### 2.1 Utils (`frontend/src/lib/utils/`)

| File | LOC | Has Tests? | Test Cases | Quality | Notes |
|------|-----|-----------|------------|---------|-------|
| `csv-parser.ts` | 76 | Yes | 9 (4+5) | **Adequate** | Good happy-path; missing: malformed quotes, single-field CSV, unicode |
| `format.ts` | 8 | Yes | 5 | **Adequate** | Covers core behavior; missing: special chars in keys, numeric values |
| `text-fitting.ts` | 98 | Yes | 3 | **Weak** | Only `computeVerticalY` tested; `getWrappedLines` and `autoFitFontSize` **untested** |
| `label-block.ts` | 25 | Yes | 5 | **Adequate** | Null paths + fallback color covered; missing: empty string edge cases |
| `print-layout.ts` | 92 | Yes | 7 (5+2) | **Adequate** | All ticket types + cut lines; missing: zero/negative dims, fractional values |
| `canvas-render.ts` | 228 | **No** | 0 | **None** | Most complex util — 4 functions, async, rotation, opacity, clipping |
| `png-export.ts` | 45 | **No** | 0 | **None** | Async ZIP generation, progress callback, blob handling |
| `qr-generator.ts` | 68 | **No** | 0 | **None** | Canvas + async image loading (logo overlay) |
| `barcode-generator.ts` | 42 | **No** | 0 | **None** | jsbarcode wrapper with try/catch fallback |

### 2.2 Stores (`frontend/src/lib/stores/`)

| File | LOC | Has Tests? | Quality | Notes |
|------|-----|-----------|---------|-------|
| `elements.svelte.ts` | 68 | **No** | **None** | Core CRUD for ticket elements; add/update/remove/snapshot/restore |
| `autosave.svelte.ts` | 212 | **No** | **None** | IndexedDB auto-save + restore; most complex store |
| `templates.svelte.ts` | 143 | **No** | **None** | API-backed template CRUD; dataUrl-to-File conversion; upsert logic |
| `call.svelte.ts` | 310 | **No** | **None** | WebRTC signaling; very complex but low testability |
| `selection.svelte.ts` | 70 | **No** | **None** | Set operations, clipboard with position offset, deep copy |
| `labels.svelte.ts` | 59 | **No** | **None** | Label config management, clamped widths, unique value derivation |
| `history.svelte.ts` | 44 | **No** | **None** | Undo/redo stack (max 50), depends on elements store |
| `canvas.svelte.ts` | 44 | **No** | **None** | Zoom clamping [0.25, 3], background image/fit mode state |
| `ticket-settings.svelte.ts` | 43 | **No** | **None** | Ticket type presets, custom dimensions |
| `csv.svelte.ts` | 36 | **No** | **None** | CSV state wrapper around parseCSV |
| `dirty.svelte.ts` | 27 | **No** | **None** | Dirty-state tracking, timestamps; depended on by all other stores |
| `toast.svelte.ts` | 26 | **No** | **None** | Toast notifications with auto-close timer |
| `theme.svelte.ts` | 26 | **No** | **None** | Dark mode toggle; localStorage + matchMedia |
| `print-settings.svelte.ts` | 12 | **No** | **None** | Ticket gap clamped [0, 20] |

### 2.3 API Clients (`frontend/src/lib/api/`)

| File | LOC | Has Tests? | Quality | Notes |
|------|-----|-----------|---------|-------|
| `client.ts` | 25 | **No** | **None** | Generic `payloadFetch<T>` wrapper; error handling, FormData detection |
| `templates.ts` | 58 | **No** | **None** | 6 CRUD functions for template API; URLSearchParams construction |
| `calls.ts` | 69 | **No** | **None** | WebRTC signaling API; complex `where` filter queries |
| `messages.ts` | 24 | **No** | **None** | Message CRUD API |
| `posts.ts` | 18 | **No** | **None** | Posts API (read-only) |
| `media.ts` | 13 | **No** | **None** | Media listing API |

### 2.4 Actions (`frontend/src/lib/actions/`)

| File | LOC | Has Tests? | Quality | Notes |
|------|-----|-----------|---------|-------|
| `draggable.ts` | 88 | **No** | **None** | Mouse/touch drag with zoom-aware coords |
| `resizable.ts` | 72 | **No** | **None** | Resize with min constraints (50x20) |
| `keyboard-shortcuts.ts` | 67 | **No** | **None** | 10+ key combos; input field guard |
| `rotatable.ts` | 66 | **No** | **None** | atan2 angle calc, 45-degree snapping |
| `dropzone.ts` | 46 | **No** | **None** | Drag-and-drop with coordinate transform |

### 2.5 Types (`frontend/src/lib/types/`)

| File | LOC | Has Tests? | Test Cases | Quality | Notes |
|------|-----|-----------|------------|---------|-------|
| `ticket.ts` | 181 | Yes | 6 (2+2+1) | **Weak** | Factory defaults tested; missing: all override combos, preset dimension validation |
| `payload.ts` | 85 | **No** | 0 | N/A | Pure type definitions; no runtime logic to test |

---

## 3. Summary Table — Backend

### 3.1 Collections (`test-payload/src/collections/`)

| Collection | LOC | Has Tests? | Test Type | Quality | Notes |
|-----------|-----|-----------|-----------|---------|-------|
| `TicketTemplate.ts` | 123 | **No** | — | **None** | Most complex collection; grouped fields, JSON, upload relation |
| `CallSignal.ts` | 57 | **No** | — | **None** | Indexed `callId`; enum types; WebRTC data |
| `CalendarEvent.ts` | 35 | **No** | — | **None** | Date fields; no end >= start validation |
| `Event.ts` | 29 | **No** | — | **None** | Basic CRUD; open create access |
| `Message.ts` | 26 | Yes | Int + E2E | **Strong** | 10 integration + 6 E2E tests; CRUD + validation |
| `Post.ts` | 22 | **No** | — | **None** | Public read, admin write |
| `Media.ts` | 22 | **No** | — | **None** | File upload; no type/size restrictions in config |
| `Users.ts` | 14 | Minimal | Int | **Weak** | 1 generic fetch test only |

### 3.2 Backend Test Files

| Test File | LOC | Tests | Quality | Notes |
|-----------|-----|-------|---------|-------|
| `tests/int/messages.int.spec.ts` | 183 | 10 | **Strong** | CRUD + validation + boundary |
| `tests/int/api.int.spec.ts` | 20 | 1 | **Weak** | Only fetches users; placeholder |
| `tests/e2e/messages.e2e.spec.ts` | 104 | 6 | **Adequate** | Admin UI CRUD flow |
| `tests/e2e/admin.e2e.spec.ts` | 41 | 3 | **Weak** | Navigation only; no data ops |
| `tests/e2e/frontend.e2e.spec.ts` | 20 | 1 | **Weak** | Homepage smoke test only |

---

## 4. Priority Ranking by Risk

Risk = **Logic Complexity** x **Usage Frequency** x **Failure Impact**

### P0 — Critical (must test first)

| # | File | LOC | Risk Justification |
|---|------|-----|---------------------|
| 1 | `canvas-render.ts` | 228 | Core rendering pipeline; 4 functions with rotation, opacity, clipping, async code; every ticket depends on it |
| 2 | `elements.svelte.ts` | 68 | Central state store; CRUD ops used by every UI interaction; snapshot/restore for undo |
| 3 | `autosave.svelte.ts` | 212 | IndexedDB persistence; data loss if broken; async + debounce + multi-store snapshot |
| 4 | `templates.svelte.ts` | 143 | API upsert logic; dataUrl-to-File conversion; case-insensitive name matching |
| 5 | `history.svelte.ts` | 44 | Undo/redo state machine; max-stack limit; depends on elements snapshot |
| 6 | `TicketTemplate.ts` (backend) | 123 | Most complex collection; grouped fields, JSON, upload relation; template persistence |

### P1 — High

| # | File | LOC | Risk Justification |
|---|------|-----|---------------------|
| 7 | `selection.svelte.ts` | 70 | Clipboard deep-copy with ID regeneration + position offset; multi-select ops |
| 8 | `text-fitting.ts` (untested functions) | 98 | `autoFitFontSize` (binary search) and `getWrappedLines` (canvas-dependent) are untested |
| 9 | `csv.svelte.ts` | 36 | Wraps parseCSV; feeds data to all rendering; clearCSV resets state |
| 10 | `labels.svelte.ts` | 59 | Clamped widths, unique value derivation from CSV, color assignment |
| 11 | `ticket-settings.svelte.ts` | 43 | Preset lookup logic; custom size setting; feeds into layout calculation |
| 12 | `client.ts` (API) | 25 | Every API call flows through this; error text extraction logic |
| 13 | `keyboard-shortcuts.ts` | 67 | 10+ key combos; Ctrl/Cmd cross-platform; input-field guard logic |
| 14 | `CallSignal.ts` (backend) | 57 | Indexed queries; enum validation; signaling data integrity |

### P2 — Medium

| # | File | LOC | Risk Justification |
|---|------|-----|---------------------|
| 15 | `png-export.ts` | 45 | ZIP generation; progress callback; blob handling; affects user-facing export |
| 16 | `qr-generator.ts` | 68 | QR + logo overlay; async image loading; canvas manipulation |
| 17 | `barcode-generator.ts` | 42 | jsbarcode wrapper; format fallback (CODE128) |
| 18 | `draggable.ts` | 88 | Zoom-aware drag; mouse/touch polymorphism; position clamping |
| 19 | `resizable.ts` | 72 | Min size constraints; zoom-aware resize |
| 20 | `rotatable.ts` | 66 | atan2 angle math; 45-degree snapping; degree normalization |
| 21 | `dropzone.ts` | 46 | Drag-and-drop coordinates; CSS class toggling |
| 22 | `templates.ts` (API) | 58 | CRUD endpoints; URLSearchParams; FormData upload |
| 23 | `dirty.svelte.ts` | 27 | Dirty tracking; depended on by all stores |
| 24 | `canvas.svelte.ts` | 44 | Zoom clamping; background state |
| 25 | `CalendarEvent.ts` (backend) | 35 | Date validation missing (end < start allowed) |
| 26 | `Event.ts` (backend) | 29 | Open create access; basic CRUD |
| 27 | `Post.ts` (backend) | 22 | Public read / admin write access control |
| 28 | `Media.ts` (backend) | 22 | File upload; no type/size validation |

### P3 — Low

| # | File | LOC | Risk Justification |
|---|------|-----|---------------------|
| 29 | `toast.svelte.ts` | 26 | Simple array + setTimeout; low business risk |
| 30 | `theme.svelte.ts` | 26 | localStorage toggle; cosmetic only |
| 31 | `print-settings.svelte.ts` | 12 | Single clamped value; trivial logic |
| 32 | `calls.ts` (API) | 69 | Thin API wrapper; low standalone risk |
| 33 | `messages.ts` (API) | 24 | Thin API wrapper |
| 34 | `posts.ts` (API) | 18 | Thin API wrapper |
| 35 | `media.ts` (API) | 13 | Thin API wrapper |
| 36 | `call.svelte.ts` | 310 | Very high complexity but very low testability (WebRTC); better suited for E2E |
| 37 | `payload.ts` (types) | 85 | Pure type definitions; no runtime logic |

---

## 5. Missing Test Scenarios by File

### 5.1 Frontend Utils — Untested Files

#### `canvas-render.ts` (228 LOC) — 0 tests

| Scenario | Function | Priority |
|----------|----------|----------|
| Each fit mode draws correctly (cover/contain/stretch/original) | `drawBackgroundOnCanvas` | High |
| Cover mode scales up to fill canvas | `drawBackgroundOnCanvas` | High |
| Contain mode preserves aspect ratio with letterbox | `drawBackgroundOnCanvas` | Medium |
| Text rotation applies correct translate/rotate sequence | `drawTextOnCanvas` | High |
| Opacity < 1 sets globalAlpha | `drawTextOnCanvas` | Medium |
| Background color fills rect before text | `drawTextOnCanvas` | Medium |
| `containInBox` triggers autoFitFontSize | `drawTextOnCanvas` | High |
| Clipping region set when `allowOverflow` is false | `drawTextOnCanvas` | High |
| Horizontal alignment positions text X correctly (left/center/right) | `drawTextOnCanvas` | High |
| Underline renders at correct position per alignment | `drawTextOnCanvas` | Medium |
| `disableNewLine` skips wrapping | `drawTextOnCanvas` | Medium |
| QR code path calls `generateQR` with correct size | `drawCodeOnCanvas` | High |
| Logo overlay added when `customLogo` is set | `drawCodeOnCanvas` | Medium |
| Barcode path calls `generateBarcode` with format/options | `drawCodeOnCanvas` | High |
| Fallback value `'SAMPLE'` used when placeholder key is missing | `drawCodeOnCanvas` | Medium |
| `renderTicketToCanvas` produces white background by default | `renderTicketToCanvas` | High |
| Background image loaded asynchronously | `renderTicketToCanvas` | High |
| `img.onerror` resolves without crashing | `renderTicketToCanvas` | High |
| Label blocks rendered on left (and right when enabled) | `renderTicketToCanvas` | Medium |
| All element types rendered in order | `renderTicketToCanvas` | High |

#### `png-export.ts` (45 LOC) — 0 tests

| Scenario | Priority |
|----------|----------|
| Produces a valid ZIP blob with correct number of PNG entries | High |
| Progress callback invoked with correct current/total values | High |
| Filenames sanitized (special characters removed) | Medium |
| Uses row data for filename when CSV column available | Medium |
| Yields to UI every 8 iterations (i % 8 === 0) | Low |
| Handles empty CSV data array | High |
| Handles single-row CSV | Medium |

#### `qr-generator.ts` (68 LOC) — 0 tests

| Scenario | Priority |
|----------|----------|
| Generates QR code with specified foreground/background colors | High |
| Canvas sized correctly for QR | Medium |
| `addLogoToQR` draws rounded-corner logo at center | Medium |
| Logo sized to 25% of QR size with 6px padding | Medium |
| Logo image load failure handled gracefully | High |
| Empty/whitespace value still generates QR | Medium |

#### `barcode-generator.ts` (42 LOC) — 0 tests

| Scenario | Priority |
|----------|----------|
| Generates barcode with specified format/options | High |
| Falls back to CODE128 on invalid format | High |
| Error handling: try/catch logs but doesn't throw | Medium |
| Custom height/colors applied | Medium |

### 5.2 Frontend Utils — Existing Tests with Gaps

#### `text-fitting.ts` — 2 functions untested

| Scenario | Function | Priority |
|----------|----------|----------|
| Wraps long text at word boundaries | `getWrappedLines` | High |
| Single word wider than maxWidth not split | `getWrappedLines` | Medium |
| Empty string returns single empty line or empty array | `getWrappedLines` | Medium |
| Binary search converges to correct font size | `autoFitFontSize` | High |
| noWrap mode returns single-line measurement | `autoFitFontSize` | Medium |
| Bold/italic affect font measurement | `autoFitFontSize` | Medium |
| Zero dimensions edge case | `autoFitFontSize` | Low |

#### `csv-parser.ts` — missing edge cases

| Scenario | Priority |
|----------|----------|
| Field with only quotes (`""`) | Medium |
| Single-column CSV | Medium |
| Windows line endings (`\r\n`) | High |
| Tab-separated values (negative test — should fail) | Low |
| Very large CSV (performance) | Low |
| Unicode characters in values | Medium |

#### `ticket.ts` — missing override/preset tests

| Scenario | Priority |
|----------|----------|
| Style overrides (fontSize, fontBold, fontItalic, opacity, backgroundColor) | Medium |
| `createDefaultQrElement` with codeSettings overrides | Medium |
| TICKET_PRESETS dimension values are correct | Medium |
| Each preset has expected width/height/orientation | Medium |
| Factory functions generate unique IDs across multiple calls | High |

#### `print-layout.ts` — missing boundary tests

| Scenario | Priority |
|----------|----------|
| Zero ticket dimensions | Medium |
| Gap larger than page | Medium |
| Very large totalTickets (pagination stress) | Low |
| Fractional ticket dimensions | Low |
| Cut line positions verified for all ticket types | Medium |

### 5.3 Stores — All Untested

#### `elements.svelte.ts` (68 LOC)

| Scenario | Priority |
|----------|----------|
| `addTextElement` creates element with defaults and pushes to array | High |
| `addQrElement` creates QR element with defaults | High |
| `updateElement` merges partial updates by ID | High |
| `updateElement` no-ops for non-existent ID | Medium |
| `removeElement` filters by ID | High |
| `removeElements` removes multiple by Set of IDs | High |
| `clearElements` empties array | Medium |
| `setElements` replaces entire array (spread copy) | High |
| `getElementById` / `getElementByIndex` return correct element or undefined | Medium |
| `snapshotElements` returns deep copy (not reference) | High |
| `restoreElements` replaces state and calls markDirty | High |
| Every mutation calls `markDirty()` | High |

#### `history.svelte.ts` (44 LOC)

| Scenario | Priority |
|----------|----------|
| `pushState` adds snapshot to undo stack | High |
| Undo stack limited to MAX_UNDO_STATES (50) | High |
| `undo` pops from undo, pushes to redo, restores | High |
| `redo` pops from redo, pushes to undo, restores | High |
| `canUndo`/`canRedo` reflect stack state | Medium |
| Undo with empty stack is no-op | Medium |
| `clearHistory` empties both stacks | Medium |

#### `selection.svelte.ts` (70 LOC)

| Scenario | Priority |
|----------|----------|
| `select` adds ID to set, clears previous selection | High |
| `toggleSelect` adds if absent, removes if present | High |
| `clearSelection` empties set | Medium |
| `selectAll` adds all element IDs | Medium |
| `getActiveElement` returns single selected element | Medium |
| `copySelected` deep-copies elements to clipboard | High |
| `cutSelected` copies + returns IDs for removal | High |
| `getClipboard` generates new IDs and offsets position (+15, +15) | High |
| Empty clipboard returns empty array | Medium |

#### `autosave.svelte.ts` (212 LOC)

| Scenario | Priority |
|----------|----------|
| `checkForPendingSession` returns true when IndexedDB has `savedAt` | High |
| `checkForPendingSession` returns false on empty DB | High |
| `checkForPendingSession` handles IndexedDB error gracefully | Medium |
| `restoreSession` reads all 8 keys from IndexedDB | High |
| `restoreSession` converts blob back to dataUrl for background image | High |
| `restoreSession` calls markClean after restore | Medium |
| `discardSession` clears IndexedDB | High |
| `initAutoSave` debounces writes to 2 seconds | High |
| `initAutoSave` deep-clones state to strip Svelte proxies | Medium |
| Background image stored as Blob (not dataUrl) | Medium |
| IndexedDB error during write logged, does not throw | Medium |

#### `templates.svelte.ts` (143 LOC)

| Scenario | Priority |
|----------|----------|
| `fetchUserTemplates` populates list from API | High |
| `fetchUserTemplates` sets loading/hasFetched states | Medium |
| `saveTemplateToBackend` converts dataUrl to File correctly | High |
| `saveTemplateToBackend` uploads background image | High |
| `saveTemplateToBackend` creates new template when name is unique | High |
| `saveTemplateToBackend` updates (overwrites) existing template by name (case-insensitive) | High |
| `saveTemplateToBackend` returns `{ template, wasOverwrite }` | Medium |
| `deleteTemplateFromBackend` removes and refetches | High |
| `dataUrlToFile` correctly produces File from base64 dataUrl | High |
| Error in API calls handled gracefully | Medium |
| Built-in templates returned correctly | Low |

#### `dirty.svelte.ts` (27 LOC)

| Scenario | Priority |
|----------|----------|
| `markDirty` sets isDirty to true | High |
| `markClean` resets isDirty, sets lastSavedTime, stores templateName | High |
| Initial state is clean | Medium |
| Multiple markDirty calls don't corrupt state | Low |

#### `csv.svelte.ts` (36 LOC)

| Scenario | Priority |
|----------|----------|
| `loadCSV` parses text and sets headers + data | High |
| `setCsvDirect` sets data without parsing | Medium |
| `clearCSV` resets to empty state | Medium |
| `getCsvRowCount` returns correct count | Medium |
| `loadCSV` calls markDirty | Medium |

#### Other stores (canvas, ticket-settings, labels, toast, theme, print-settings)

| Store | Key Scenarios | Priority |
|-------|--------------|----------|
| `canvas.svelte.ts` | Zoom clamp [0.25, 3]; zoomIn/zoomOut step; background image get/set | Medium |
| `ticket-settings.svelte.ts` | `setTicketType` applies preset dims; 'others' skips preset; `setCustomSize` | Medium |
| `labels.svelte.ts` | Width clamping [5, 80]; `setLabelColumn` resets colors; `getUniqueLabelValues` deduplication | Medium |
| `toast.svelte.ts` | `showToast` adds to array with UUID; auto-close after duration; `closeToast` removes by id | Low |
| `theme.svelte.ts` | Toggle flips isDark; reads localStorage on init; respects prefers-color-scheme | Low |
| `print-settings.svelte.ts` | Gap clamped [0, 20]; markDirty on set | Low |

### 5.4 API Clients — All Untested

| File | Key Scenarios | Priority |
|------|--------------|----------|
| `client.ts` | Constructs correct URL; sets JSON content-type (skips for FormData); throws on non-ok response with error text; parses JSON response | High |
| `templates.ts` | Passes limit/page/sort as query params; CRUD methods use correct HTTP verbs; `uploadBackgroundImage` sends FormData | Medium |
| `calls.ts` | Complex `where` filter queries constructed correctly; all signal types handled | Medium |
| `messages.ts` | Query params passed; `sendMessage` sends correct body | Low |
| `posts.ts` | `getPost` constructs correct URL with ID | Low |
| `media.ts` | Query params passed | Low |

### 5.5 Actions — All Untested

| File | Key Scenarios | Priority |
|------|--------------|----------|
| `keyboard-shortcuts.ts` | Ctrl+Z triggers undo; Ctrl+Shift+Z triggers redo; Delete removes selection; Ctrl+C/V/X for clipboard; skips shortcuts in INPUT/TEXTAREA/SELECT elements | High |
| `draggable.ts` | Mouse down starts drag; move updates position; zoom factor applied to delta; position clamped to >= 0; touch events work same as mouse | Medium |
| `resizable.ts` | Resize respects min 50x20; zoom factor applied; update callback fires on move | Medium |
| `rotatable.ts` | atan2 angle calculation correct; shift key snaps to 45-degree increments; degree normalization ((d%360+360)%360) | Medium |
| `dropzone.ts` | CSS class added on dragover, removed on dragleave/drop; coordinates adjusted for zoom + bounding rect | Low |

### 5.6 Backend — Missing Tests

#### `TicketTemplate.ts` (123 LOC) — CRITICAL

| Scenario | Priority |
|----------|----------|
| Create template with valid name + elements | High |
| Create template with background image upload (media relation) | High |
| Ticket settings group saved correctly (type, width, height, fitMode) | High |
| Label config group saved (colors JSON, block widths, rightBlockEnabled) | High |
| CSV data + headers stored as JSON | Medium |
| Print settings group saved (ticketGap) | Medium |
| Update template fields | High |
| Delete template | Medium |
| Field defaults applied correctly | Medium |
| Access control: all operations open (verify) | Low |

#### `CallSignal.ts` (57 LOC)

| Scenario | Priority |
|----------|----------|
| Create signal with each type (offer/answer/ice-candidate/hangup) | High |
| Query by indexed callId | High |
| Status transitions (pending → active → ended) | Medium |
| JSON data field stores WebRTC SDP correctly | Medium |

#### `CalendarEvent.ts` (35 LOC)

| Scenario | Priority |
|----------|----------|
| Create event with valid dates | High |
| Read/list events | Medium |
| end_date before start_date (currently allowed — should flag as bug?) | Medium |
| Delete event | Low |

#### Other collections (Event, Post, Media, Users)

| Collection | Key Gaps | Priority |
|-----------|----------|----------|
| `Event.ts` | CRUD tests; access control (open create) | Medium |
| `Post.ts` | Public read vs admin write access verification | Medium |
| `Media.ts` | File upload flow; alt text validation | Medium |
| `Users.ts` | Auth flow (login/register); password handling; email uniqueness | Medium |

---

## 6. Test Infrastructure Assessment

### 6.1 Frontend (`frontend/`)

**Current setup:**
- **Framework:** Vitest with jsdom environment
- **Config:** `vite.config.ts` — `test.environment: 'jsdom'`, `test.globals: true`, `setupFiles: ['src/test-setup.ts']`
- **Setup file:** `src/test-setup.ts` — only imports `@testing-library/jest-dom/vitest` (1 line)
- **Pattern:** `src/**/*.test.ts`
- **Dependencies:** vitest 4.0.18, @testing-library/svelte 5.3.1, @testing-library/jest-dom 6.9.1, jsdom 28.1.0

**Recommendations:**

1. **Add Canvas mock to test-setup.ts** — Required for testing `canvas-render.ts`, `text-fitting.ts` (autoFitFontSize), `qr-generator.ts`, `barcode-generator.ts`. jsdom's canvas support is minimal; consider adding `jest-canvas-mock` or a custom `HTMLCanvasElement.getContext` stub.

2. **Add IndexedDB mock** — Required for `autosave.svelte.ts`. Use `fake-indexeddb` package (install as devDependency).

3. **Add fetch mock utility** — Required for all API client tests and `templates.svelte.ts`. Use `vi.stubGlobal('fetch', ...)` or `msw` (Mock Service Worker).

4. **Add Svelte 5 store test helpers** — Stores use `$state` runes which need Svelte compiler context. Create a helper that wraps store function calls in a test-friendly context, or test stores as plain modules since they export functions (not components).

5. **Add `crypto.randomUUID` mock** — Used by `selection.svelte.ts` and type factories. jsdom may not provide it; add to setup: `vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-...' })`.

6. **Add timer control utilities** — Required for `autosave.svelte.ts` (debounce), `toast.svelte.ts` (auto-close). Use `vi.useFakeTimers()`.

7. **Add coverage thresholds** — Currently no minimum coverage enforced. Add to config:
   ```
   coverage: { thresholds: { statements: 60, branches: 50, functions: 60, lines: 60 } }
   ```

8. **Add coverage reporter** — Enable `vitest --coverage` in CI pipeline with `@vitest/coverage-v8`.

### 6.2 Backend (`test-payload/`)

**Current setup:**
- **Integration:** Vitest 4.0.18 with jsdom; pattern `tests/int/**/*.int.spec.ts`
- **E2E:** Playwright 1.56.1 with Chromium; pattern `tests/e2e/`
- **Setup:** `vitest.setup.ts` only loads `dotenv/config`
- **Helpers:** `login.ts` (admin auth), `seedUser.ts` (test data seeding)

**Recommendations:**

1. **Add Payload test instance helper** — Create a shared setup that initializes Payload with a test database for integration tests. Currently `messages.int.spec.ts` does this inline; extract to reusable helper.

2. **Add test data factories** — Create factories for each collection to generate valid test data (template, event, post, etc.).

3. **Add cleanup/reset between tests** — Ensure test isolation; currently only `messages.int.spec.ts` tracks created IDs for cleanup.

4. **Move hardcoded credentials to .env.test** — `seedUser.ts` has `email: 'dev@payloadcms.com'` and `password: 'test'` inline.

5. **Add API test coverage for all collections** — Copy `messages.int.spec.ts` pattern for Posts, Events, TicketTemplates, CallSignals, CalendarEvents, Media.

6. **Expand E2E beyond Messages** — Add Playwright tests for the ticket generator page, calendar, and other frontend features.

---

## 7. Effort Estimates

**Scale:** S (< 1hr), M (1-3hr), L (3-8hr), XL (8+ hr)

### Frontend

| File | Effort | Mock Requirements | Notes |
|------|--------|-------------------|-------|
| `dirty.svelte.ts` | **S** | None | Simple state; 4-5 tests |
| `print-settings.svelte.ts` | **S** | Mock markDirty | 2-3 tests |
| `format.ts` (expand) | **S** | None | 3-4 more edge cases |
| `toast.svelte.ts` | **S** | Fake timers, crypto | 4-5 tests |
| `canvas.svelte.ts` | **S** | Mock markDirty | 6-8 tests |
| `csv.svelte.ts` | **S** | Mock markDirty, parseCSV | 5-6 tests |
| `ticket.ts` (expand) | **S** | None | 5-6 more tests |
| `ticket-settings.svelte.ts` | **S** | Mock markDirty | 5-6 tests |
| `elements.svelte.ts` | **M** | Mock markDirty, crypto | 12+ tests |
| `history.svelte.ts` | **M** | Mock elements store | 7-8 tests |
| `selection.svelte.ts` | **M** | Mock elements store, crypto | 10+ tests |
| `labels.svelte.ts` | **M** | Mock markDirty | 8-10 tests |
| `csv-parser.ts` (expand) | **S** | None | 4-5 more edge cases |
| `print-layout.ts` (expand) | **S** | None | 4-5 boundary tests |
| `text-fitting.ts` (expand) | **M** | Canvas mock | 6-8 tests for untested functions |
| `client.ts` | **M** | Fetch mock | 5-6 tests |
| `templates.ts` (API) | **M** | payloadFetch mock | 6-7 tests |
| `calls.ts` (API) | **S** | payloadFetch mock | 5 tests |
| `messages.ts` (API) | **S** | payloadFetch mock | 3-4 tests |
| `posts.ts` (API) | **S** | payloadFetch mock | 3 tests |
| `media.ts` (API) | **S** | payloadFetch mock | 2 tests |
| `keyboard-shortcuts.ts` | **M** | DOM event simulation | 10+ tests |
| `draggable.ts` | **M** | DOM event simulation | 6-8 tests |
| `resizable.ts` | **M** | DOM event simulation | 5-6 tests |
| `rotatable.ts` | **M** | DOM event simulation | 5-6 tests (math testable pure) |
| `dropzone.ts` | **S** | DOM event simulation | 4 tests |
| `canvas-render.ts` | **L** | Canvas mock, Image mock, all sub-util mocks | 20+ tests |
| `png-export.ts` | **L** | JSZip mock, canvas mock, renderTicketToCanvas mock | 7+ tests |
| `qr-generator.ts` | **M** | qrious mock, canvas mock, Image mock | 6 tests |
| `barcode-generator.ts` | **M** | jsbarcode mock, canvas mock | 4-5 tests |
| `templates.svelte.ts` (store) | **L** | API mocks, fetch mock, multiple store mocks | 10+ tests |
| `autosave.svelte.ts` | **XL** | fake-indexeddb, fetch mock, FileReader mock, timer mock, all store mocks | 12+ tests |
| `call.svelte.ts` | **XL** | WebRTC mocks, API mocks, media stream mock, timers | 15+ tests (or skip for E2E) |

### Backend

| Target | Effort | Notes |
|--------|--------|-------|
| `TicketTemplate` integration tests | **L** | CRUD + JSON fields + media upload |
| `CallSignal` integration tests | **M** | CRUD + enum validation + indexed queries |
| `CalendarEvent` integration tests | **M** | CRUD + date validation |
| `Event` integration tests | **S** | Basic CRUD |
| `Post` integration tests | **S** | CRUD + access control |
| `Media` integration tests | **M** | File upload flow |
| `Users` integration tests (expand) | **M** | Auth flow; password; email uniqueness |
| Ticket generator E2E | **XL** | Full feature flow |

---

## 8. Recommended Test Execution Order

Based on dependency chains and risk, write tests in this order:

```
Phase A — Foundation (no mocks needed, highest ROI):
  1. dirty.svelte.ts          [S]
  2. print-settings.svelte.ts  [S]
  3. ticket.ts (expand)        [S]
  4. csv-parser.ts (expand)    [S]
  5. format.ts (expand)        [S]
  6. print-layout.ts (expand)  [S]

Phase B — Core stores (mock markDirty):
  7. canvas.svelte.ts          [S]
  8. csv.svelte.ts             [S]
  9. ticket-settings.svelte.ts [S]
  10. elements.svelte.ts       [M]
  11. labels.svelte.ts         [M]
  12. toast.svelte.ts          [S]

Phase C — Dependent stores (mock elements + other stores):
  13. history.svelte.ts        [M]
  14. selection.svelte.ts      [M]

Phase D — API layer (mock fetch):
  15. client.ts                [M]
  16. templates.ts (API)       [M]
  17. calls.ts (API)           [S]
  18. messages.ts (API)        [S]
  19. posts.ts (API)           [S]
  20. media.ts (API)           [S]

Phase E — Canvas/rendering (requires canvas mock setup):
  21. text-fitting.ts (expand) [M]
  22. barcode-generator.ts     [M]
  23. qr-generator.ts          [M]
  24. canvas-render.ts         [L]
  25. png-export.ts            [L]

Phase F — DOM actions (requires event simulation):
  26. keyboard-shortcuts.ts    [M]
  27. rotatable.ts             [M]
  28. draggable.ts             [M]
  29. resizable.ts             [M]
  30. dropzone.ts              [S]

Phase G — Complex stores (requires extensive mocking):
  31. templates.svelte.ts      [L]
  32. autosave.svelte.ts       [XL]

Phase H — Backend (requires Payload test instance):
  33. TicketTemplate int tests [L]
  34. CallSignal int tests     [M]
  35. CalendarEvent int tests  [M]
  36. Remaining collection int tests [M]
```

**Estimated total effort:** ~80-100 hours for comprehensive coverage

---

## 9. Dependency Map

```
ticket.ts (types/factories) ← elements.svelte.ts ← history.svelte.ts
                             ← elements.svelte.ts ← selection.svelte.ts
                             ← elements.svelte.ts ← autosave.svelte.ts

dirty.svelte.ts ← ALL stores (canvas, csv, elements, labels,
                               print-settings, ticket-settings)

csv-parser.ts ← csv.svelte.ts ← autosave.svelte.ts
format.ts ← canvas-render.ts ← png-export.ts
text-fitting.ts ← canvas-render.ts
label-block.ts ← canvas-render.ts
qr-generator.ts ← canvas-render.ts
barcode-generator.ts ← canvas-render.ts

client.ts (payloadFetch) ← templates.ts (API) ← templates.svelte.ts (store)
                         ← calls.ts (API)     ← call.svelte.ts
                         ← messages.ts (API)
                         ← posts.ts (API)
                         ← media.ts (API)
```

---

---

## 10. Cross-Review Notes from Test Engineer

**Reviewed reports:**
- `frontend/reports/bug-audit.md` (Bug Hunter)
- `frontend/reports/security-audit.md` (Security Guardian)

---

### 10.1 Bug Audit Review — Challenges and Confirmations

#### Confirmed Critical Bugs

**BUG-C1 ($effect.root() cleanup never captured)** — **Confirmed, severity accurate.** Verified at `autosave.svelte.ts:159`: `$effect.root()` returns a cleanup function that is discarded. While SvelteKit page remounts would reset module state on full navigation, the scenario of calling `initAutoSave()` after restore (within the same mount) is valid. **Test implication:** Add test for `initAutoSave()` idempotency — calling it twice should not create duplicate effects.

**BUG-C2 (restoreSession Promise.all failure)** — **Confirmed, but practical likelihood is LOW.** Verified at `autosave.svelte.ts:109-118`. `Promise.all()` does reject on any single failure. However, IndexedDB reads from the same object store in the same open database almost never fail independently — they'd all fail together (e.g., DB open failure). The corruption scenario requires manual DevTools tampering. **Suggestion:** Keep as Critical for correctness, but note that `Promise.allSettled` adds complexity for a low-probability case. **Test implication:** Add test with `Promise.allSettled` to verify partial restore behavior.

**BUG-C4 (Barcode fallback catch)** — **Confirmed, clearly real.** Verified at `barcode-generator.ts:30-41`: the fallback `JsBarcode()` call at line 32 is NOT wrapped in try-catch. An empty string or control characters would crash the entire render pipeline. **Test implication:** This is the highest-priority test for `barcode-generator.ts` — test with empty string, control chars, and invalid format.

#### Challenged Severity Ratings

**BUG-C3 (Race condition in call polling)** — **Real bug, but should be Medium, not Critical.** The race window is narrow: the poll fires every 3s (`call.svelte.ts:51`), and the API call typically completes in <500ms. The user would need to click "Call" in that exact ~200ms window. Furthermore, the call system is not a core feature (it's secondary to the ticket generator). The fix is trivial (re-check `callState` after await), but the severity should reflect the low probability and limited blast radius.

**BUG-M1 (localStorage in private browsing)** — **Challenge: SSR guard already exists.** Verified at `theme.svelte.ts:3`: the code has `if (typeof window !== 'undefined')` which handles SSR. However, the `localStorage.getItem` on line 4 is NOT wrapped in try-catch, so the SecurityError in restricted iframe sandboxes IS still valid. Modern Safari (15+) no longer throws on `localStorage` in private browsing, so the "Safari private browsing" scenario in the reproduction steps is outdated. **Revised assessment:** Still Medium, but the reproduction should cite "restricted iframe sandbox" not "Safari private mode."

**BUG-M2 (Excessive IndexedDB connections)** — **Challenge: should be LOW, not Medium.** Each `openDB()` call creates a connection and each `dbPut`/`dbGet` closes it after the transaction completes (`db.close()` in oncomplete/onerror). While 9 concurrent connections sounds high, IndexedDB connections are lightweight — they're in-process, not network connections. The browser handles connection pooling internally. The `onupgradeneeded` concern is moot since `DB_VERSION = 1` never changes. **Test implication:** No specific test needed for connection count; test that concurrent writes don't corrupt data.

**BUG-M4 (History stack stale after restore)** — **Challenge: should be LOW, not Medium.** The report itself acknowledges (line 161-164) that this is mitigated on page reload because module state reinitializes. `restoreSession()` is currently ONLY called from `onMount` in `+page.svelte`, where the history stacks are already empty. This is a theoretical future concern, not a current bug. **Test implication:** If/when `restoreSession()` is callable without page reload, add test that `clearHistory()` is called first.

**BUG-M7 (Zero-dimension image Infinity scale)** — **Challenge: should be LOW.** Browser `img.onload` only fires for successfully decoded images, which always have positive dimensions. The only realistic scenario is an SVG with no `viewBox`/`width`/`height`, which is extremely rare in a ticket generator context. The guard is trivial to add, so worth fixing, but the risk is near-zero.

#### Confirmed Medium/Low Bugs (agreements)

- **BUG-M3 (Clipboard persists)** — Confirmed. Verified no `clearClipboard()` exists in `selection.svelte.ts`. Real UX issue on template load.
- **BUG-M5 (hasFetched=true on error)** — Confirmed at `templates.svelte.ts:74`. Prevents retry. Good catch.
- **BUG-M6 (dataUrlToFile crash on malformed URL)** — Confirmed at `templates.svelte.ts:81`. `atob()` will throw on non-base64 input.
- **BUG-M8 (autoFitFontSize zero height)** — Confirmed. Binary search returns `best = 6` for 0-height box. UI min height of 20 (`resizable.ts`) mitigates but doesn't eliminate.
- **BUG-M9 (Print layout NaN)** — Confirmed. Zero-dimension + zero-gap = Infinity. Connected to BUG-L5.
- **BUG-M10 (PNG export non-Latin filenames)** — Confirmed and important for internationalization. ZIP overwrite from duplicate sanitized names is a real data-loss scenario.
- **BUG-M11 (toBlob null assertion)** — Confirmed at `png-export.ts:31`. `b!` is unsafe; tainted canvas passes `null`.
- **BUG-M12 (dirty.markClean misleading)** — Confirmed at `dirty.svelte.ts:24`. `lastSavedTemplateName` persists incorrectly after autosave.
- **BUG-T1 (TicketTemplate vs LabelConfig mismatch)** — Confirmed. `labelBlock: { width: number } | null` is incompatible with `LabelConfig`. Built-in templates use the old shape.
- **BUG-L1 through BUG-L8** — All confirmed as Low severity, ratings appropriate.

#### Missing Bugs Not Identified

1. **Missing: `pushState()` clears redo stack unconditionally** — `history.svelte.ts:14` sets `redoStack = []` on every `pushState()`. This is standard undo behavior, but if a user does undo → edit → expects redo to work → it's gone. Not a bug per se, but worth a test to document the intended behavior.

2. **Missing: `selectAll()` depends on `getElements()` reactivity timing** — `selection.svelte.ts:34` reads `getElements()` at call time. If called during a batch update where elements haven't been flushed, it could miss elements. Low probability but worth testing.

3. **Missing: `deleteTemplateFromBackend` doesn't handle API failure** — `templates.svelte.ts:141` calls `deleteTemplateById` and optimistically removes from `userTemplates`. If the API call fails, the local list is already modified. No rollback logic.

---

### 10.2 Security Audit Review — Challenges and Confirmations

#### Confirmed Critical Findings

**SEC-C1 (Unrestricted media upload)** — **Confirmed Critical.** Verified at `Media.ts`: no `mimeTypes`, no file size limit, all access `() => true`. This is the single most urgent fix. **Test implication:** Backend integration tests MUST verify MIME restrictions and size limits after remediation.

**SEC-C2 (Anonymous CRUD on 5/8 collections)** — **Confirmed Critical.** Verified all collection files. This directly overlaps with my coverage finding that 7 of 8 collections have zero test coverage. **Test implication:** Every backend integration test should verify access control — test both authenticated and unauthenticated requests.

**SEC-C3 (PAYLOAD_SECRET empty string fallback)** — **Confirmed Critical.** Verified at `payload.config.ts:30`: `secret: process.env.PAYLOAD_SECRET || ''`. The empty string fallback completely undermines JWT security. **Test implication:** Add a startup validation test (or hook) that rejects empty/short secrets.

**SEC-C4 (GraphQL Playground exposed)** — **Confirmed, but nuance needed.** The route file at `api/graphql-playground/route.ts` is auto-generated by Payload CMS (marked "DO NOT MODIFY"). The fix belongs in `payload.config.ts`, not the route file. Combined with C2, this is Critical. Standalone (if C2 is fixed), it's Medium.

#### Challenged Findings

**SEC-H1 (No CSRF protection)** — **Challenge: CSRF is irrelevant until C2 is fixed.** CSRF protection only matters when operations require authentication. Since ALL collections currently accept unauthenticated requests (`() => true`), CSRF adds no security value — an attacker doesn't need a victim's session cookie because they can make direct API calls without any auth. **Revised assessment:** Downgrade to Medium. Fix C2 first (add auth), THEN configure CSRF. The report should note this dependency.

**SEC-H5 (Unsanitized .veenttix import — XSS claim)** — **Challenge: the XSS example is NOT exploitable.** The malicious `textFormat: "<script>alert('xss')</script>"` in the PoC is rendered via `ctx.fillText()` on a canvas — the Canvas 2D API treats all strings as literal text, never as HTML. There is no `{@html}` usage in the rendering path, and the report itself confirms "No {@html} XSS vectors were found." The REAL risks from this finding are:
  - Memory DoS via extreme dimensions (`width: 99999, height: 99999`)
  - Negative values in `printSettings.ticketGap: -100` causing layout corruption
  - These are **data integrity/DoS issues**, not XSS.
  **Revised severity:** Medium (DoS/data corruption), not High (XSS).

**SEC-M1 (CSV formula injection)** — **Challenge: should be LOW, not Medium.** The application renders CSV data exclusively to HTML5 Canvas via `ctx.fillText()`. There is NO CSV export feature that would produce a downloadable `.csv` file. The data stored in JSON format (IndexedDB, Payload CMS) cannot trigger formula execution. The only path to Excel execution would be: user exports `.veenttix` JSON → opens in text editor → manually copies to Excel. This is far-fetched. **Test implication:** No test needed for formula sanitization unless a CSV export feature is added.

**SEC-M4 (Unvalidated data URL in blob conversion)** — **Challenge: should be LOW/Informational.** The attack requires tampering with IndexedDB via DevTools. If an attacker has DevTools access in the victim's browser, they already have full control (can modify any JS, read any state, make any request). Defending against DevTools tampering is not a realistic threat model. The `dataUrl.startsWith('data:')` guard is a nice defense-in-depth but doesn't change the actual risk.

**SEC-M7 (document.write for print)** — **Challenge: severity is overstated.** The report correctly states "Current Risk: Low" and "Future Risk: High." For a current audit, the current risk should determine severity. The `document.write` receives `canvas.toDataURL()` output which is a deterministic `data:image/png;base64,...` string — zero user-controlled content enters the HTML construction. **Revised assessment:** Low, with a note to refactor if user-controlled strings are ever added.

#### Confirmed High/Medium Findings (agreements)

- **SEC-H3 (Call signals fully open)** — Confirmed. SDP data contains IP addresses; anonymous read enables eavesdropping. Overlaps with my coverage gap for CallSignal (zero tests).
- **SEC-H4 (Server error body leaked)** — Confirmed at `client.ts:21`. Stack traces in error messages are a real information disclosure risk.
- **SEC-H6 (No CSV parser input limits)** — Confirmed. The parser has no row/column limits. 1M rows of 5-char values = ~100MB in-memory objects. **Test implication:** Add boundary tests for row count and column count limits after remediation.
- **SEC-H7 (No background image size limit)** — Confirmed. Unlike CSV (5MB check), images have no size check. **Test implication:** Test file size validation after the guard is added.
- **SEC-M8 (JSON fields accept arbitrary data)** — Confirmed. `TicketTemplate.elements` has no schema validation. **Test implication:** Backend tests should verify that invalid element structures are rejected after validation is added.

#### Overlaps with Coverage Audit

| Security Finding | Related Coverage Gap | Test Action |
|-----------------|---------------------|-------------|
| SEC-C1 (Media upload) | Media.ts has 0 tests | Add MIME + size validation tests |
| SEC-C2 (Open access) | 7/8 collections untested | Add auth-required tests for all collections |
| SEC-H3 (Call signals) | CallSignal.ts has 0 tests | Add access control + data filtering tests |
| SEC-H4 (Error leak) | client.ts has 0 tests | Test that error messages don't expose internals |
| SEC-H5 (Import validation) | No component tests | Add tests for `.veenttix` import validation |
| SEC-H6 (CSV limits) | csv-parser.ts edge cases missing | Add row/column limit boundary tests |
| SEC-M8 (JSON validation) | TicketTemplate.ts has 0 tests | Add JSON field schema validation tests |

---

### 10.3 Additional Test Scenarios Implied by Bug and Security Findings

These scenarios should be added to my Section 5 (Missing Test Scenarios) for the next test-writing phase:

#### High Priority — Bug-Driven Test Scenarios

| Source | Test Scenario | Target File |
|--------|--------------|-------------|
| BUG-C4 | Barcode with empty string value → should not throw | `barcode-generator.test.ts` |
| BUG-C4 | Barcode with invalid format AND invalid value → fallback handles gracefully | `barcode-generator.test.ts` |
| BUG-M5 | `fetchUserTemplates` on API failure → `hasFetched` should remain false | `templates.svelte.test.ts` |
| BUG-M6 | `dataUrlToFile` with malformed data URL → throws clear error | `templates.svelte.test.ts` |
| BUG-M9 | `calculateLayout` with zero dimensions → returns safe defaults, not NaN/Infinity | `print-layout.test.ts` |
| BUG-M10 | `exportAllAsPNG` with non-Latin CSV values → filenames don't collide | `png-export.test.ts` |
| BUG-M11 | `exportAllAsPNG` with tainted canvas → handles null blob gracefully | `png-export.test.ts` |
| BUG-M12 | `markClean()` without args → clears `lastSavedTemplateName` | `dirty.svelte.test.ts` |
| BUG-T1 | Loading built-in template → `labelBlock: null` handled without crash | Integration test |
| BUG-M3 | After template load → clipboard is cleared | `selection.svelte.test.ts` |

#### Medium Priority — Security-Driven Test Scenarios

| Source | Test Scenario | Target File |
|--------|--------------|-------------|
| SEC-H4 | `payloadFetch` error response → error message does not include server body | `client.test.ts` |
| SEC-H6 | `parseCSV` with 100,000+ rows → throws row limit error | `csv-parser.test.ts` |
| SEC-H6 | `parseCSV` with 500+ columns → throws column limit error | `csv-parser.test.ts` |
| SEC-M4 | `dataUrlToBlob` with `http://` URL → rejects (only `data:` allowed) | `autosave.svelte.test.ts` |
| SEC-C2 | Backend: unauthenticated DELETE to ticket-templates → should be rejected (post-fix) | `api.int.spec.ts` |
| SEC-C1 | Backend: upload non-image file → should be rejected (post-fix) | `media.int.spec.ts` |
| SEC-M8 | Backend: create template with non-array `elements` → should be rejected | `templates.int.spec.ts` |

---

### 10.4 Findings I Think Are Missing from Both Reports

1. **Missing from Bug Audit: `templates.svelte.ts` save race condition** — `saveTemplateToBackend` checks for existing template by name at line 121, then creates/updates at line 126/133. If two users (or two browser tabs) save with the same name concurrently, both check, both find no existing, both create — resulting in duplicate templates. The case-insensitive comparison mitigates but doesn't prevent this.

2. **Missing from Bug Audit: `history.svelte.ts` memory accumulation** — Each `pushState()` deep-copies the entire elements array via `snapshotElements()` (`JSON.parse(JSON.stringify(elements))`). With MAX_UNDO_STATES = 50 and complex elements (many text/QR elements with styles), this could consume significant memory. No memory pressure handling exists.

3. **Missing from Security Audit: `templates.svelte.ts:113` JSON.parse(JSON.stringify(elements))** — This deep clone pattern strips prototype methods but preserves all properties. If `elements` contains extremely deeply nested objects (e.g., crafted via `.veenttix` import), this could trigger stack overflow in `JSON.stringify()`. This connects to SEC-H5 but wasn't explicitly called out.

4. **Missing from both: `png-export.ts` has no cancellation mechanism** — If exporting 10,000 tickets, there's no way to abort the operation. The progress callback is one-way (report only). The browser tab will be unresponsive until completion or crash.

5. **Missing from Security Audit: IndexedDB data is not encrypted** — Auto-saved project data (including background images, CSV data, and all element content) is stored in plaintext IndexedDB. Any browser extension or local malware can read all auto-saved data. Relevant for the CLAUDE.md mention of "Auth can be added later."

---

*Cross-review completed 2026-02-18 by Test Engineer, quality-assurance team.*
