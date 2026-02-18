# Bug Audit Report

**Auditor:** Bug Hunter
**Date:** 2026-02-18
**Scope:** All frontend stores (`frontend/src/lib/stores/`) and utilities (`frontend/src/lib/utils/`), plus types, API layer, and page component
**Files Audited:** 26 files, ~2,200 LOC

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| Medium   | 12 |
| Low      | 8 |
| Data Flow / Type Issues | 2 |
| **Total** | **26** |

---

## Critical Bugs

### BUG-C1: `$effect.root()` cleanup never captured — effects accumulate on repeat calls

- **File:** `frontend/src/lib/stores/autosave.svelte.ts`, lines 156-212
- **Description:** `initAutoSave()` creates an `$effect.root()` (line 159) that returns a cleanup function, but the return value is never captured or called. If `initAutoSave()` is called more than once, multiple independent reactive effects accumulate, each writing to IndexedDB on every state change.
- **Reproduction:**
  1. Open the ticket generator page
  2. A pending session exists in IndexedDB — the restore modal appears
  3. User clicks "Restore" — `handleRestore()` calls `restoreSession()` then `initAutoSave()` (page line 45)
  4. The effect root from step 3 is never cleaned up
  5. If the user navigates away and back, `onMount` fires again, potentially calling `initAutoSave()` a second time (though SvelteKit would remount fresh)
- **Impact:** Redundant IndexedDB writes on every state change. In extreme cases, multiple debounce timers fire independently, causing write contention.
- **Suggested Fix:** Capture the cleanup function returned by `$effect.root()` and store it in a module-level variable. On subsequent calls, invoke the previous cleanup before creating a new effect. Or add a guard: `let initialized = false; if (initialized) return; initialized = true;`

### BUG-C2: `restoreSession()` fails entirely if any single IndexedDB read fails

- **File:** `frontend/src/lib/stores/autosave.svelte.ts`, lines 108-118
- **Description:** `restoreSession()` uses `Promise.all()` to read 8 keys from IndexedDB simultaneously (lines 109-118). If ANY single read fails (corrupt data, schema mismatch, quota exceeded), the entire `Promise.all()` rejects and the catch block at line 136 fires. None of the successfully-read values are applied to stores.
- **Reproduction:**
  1. Auto-save writes all 8 keys to IndexedDB
  2. Manually corrupt one key in IndexedDB (e.g., via DevTools > Application > IndexedDB)
  3. Reload page and click "Restore"
  4. All store data is lost — elements, CSV, settings, background image — even though 7 of 8 reads succeeded
- **Impact:** Complete data loss on restore if any single key is corrupt. User expects partial recovery but gets nothing.
- **Suggested Fix:** Replace `Promise.all()` with `Promise.allSettled()` and apply each successful result individually:
  ```typescript
  const results = await Promise.allSettled([...]);
  const getValue = <T>(r: PromiseSettledResult<T | undefined>) =>
    r.status === 'fulfilled' ? r.value : undefined;
  const elements = getValue(results[0]);
  // ... apply each individually
  ```

### BUG-C3: Race condition in call polling — incoming call overwrites active outgoing call

- **File:** `frontend/src/lib/stores/call.svelte.ts`, lines 62-76
- **Description:** `pollForIncomingCalls()` runs on a 3-second interval (line 51). It checks `if (callState !== 'idle') return` at line 63, then makes an async API call at line 65. Between the check and the API response, the user could have initiated an outgoing call via `startCall()`, changing `callState` to `'calling'`. When the poll's API response arrives, it unconditionally overwrites `callState` to `'incoming'` (line 71), `callId` (line 69), and `remoteUser` (line 70) — stomping on the active outgoing call.
- **Reproduction:**
  1. User is idle, polling runs every 3s
  2. Poll fires, checks state = 'idle', starts API request
  3. While API request is in-flight (~200ms network), user clicks "Call Bob"
  4. `startCall('Bob')` sets `callState = 'calling'`, `callId = <new UUID>`, `remoteUser = 'Bob'`
  5. Poll response arrives with an incoming call from Alice
  6. Poll sets `callState = 'incoming'`, `callId = Alice's callId`, `remoteUser = 'Alice'`
  7. User's outgoing call to Bob is silently abandoned — no hangup signal sent, peer connection leaked
- **Impact:** Orphaned WebRTC peer connection and media stream (memory/resource leak), lost outgoing call, confusing UI state.
- **Suggested Fix:** Re-check `callState` after the await:
  ```typescript
  const res = await getIncomingCalls(localUsername);
  if (callState !== 'idle') return; // Re-check after async gap
  if (res.docs.length > 0) { ... }
  ```

### BUG-C4: Barcode fallback catch doesn't catch second failure — crashes render pipeline

- **File:** `frontend/src/lib/utils/barcode-generator.ts`, lines 20-41
- **Description:** The first `JsBarcode()` call (line 21) is wrapped in try-catch. On failure, the catch block (line 30) retries with `format: 'CODE128'` (line 32). But this second call is NOT wrapped in its own try-catch. If the value is invalid for CODE128 as well (e.g., empty string, control characters), the second `JsBarcode()` throws an uncaught exception.
- **Reproduction:**
  1. Add a barcode element with format `EAN13`
  2. CSV row has an empty value for the barcode placeholder
  3. First `JsBarcode()` fails (EAN13 requires 13 digits)
  4. Fallback tries `CODE128` with empty string
  5. `CODE128` also fails — uncaught error propagates up to `renderTicketToCanvas()`
  6. The entire ticket rendering fails — PNG export aborts mid-way
- **Impact:** Single invalid barcode value crashes the entire export for ALL remaining tickets.
- **Suggested Fix:** Wrap the fallback in its own try-catch:
  ```typescript
  } catch {
    try {
      JsBarcode(canvas, value || 'N/A', { format: 'CODE128', ... });
    } catch {
      // Draw error placeholder on canvas instead of crashing
    }
  }
  ```

---

## Medium Bugs

### BUG-M1: `localStorage` access crashes in private browsing / restricted environments

- **File:** `frontend/src/lib/stores/theme.svelte.ts`, lines 3-9
- **Description:** Module-level code at line 4 calls `localStorage.getItem('theme-dark')` without try-catch. In some browsers (older Safari private mode, restricted iframe sandboxes), accessing `localStorage` throws a `SecurityError`. Since this runs at module evaluation time, it crashes the entire app before any component mounts.
- **Reproduction:**
  1. Open the app in Safari private browsing mode (older versions)
  2. Or embed the app in an iframe with `sandbox` attribute (no `allow-same-origin`)
  3. App fails to load with `SecurityError: The operation is insecure`
- **Impact:** App completely fails to load for affected users.
- **Suggested Fix:** Wrap in try-catch:
  ```typescript
  let saved: string | null = null;
  if (typeof window !== 'undefined') {
    try { saved = localStorage.getItem('theme-dark'); } catch { /* fallback */ }
  }
  ```

### BUG-M2: Auto-save opens excessive IndexedDB connections under load

- **File:** `frontend/src/lib/stores/autosave.svelte.ts`, lines 34-62
- **Description:** Each `dbPut()` / `dbGet()` / `dbClear()` call opens a fresh IndexedDB connection via `openDB()`. In `initAutoSave()` (lines 187-205), `Promise.all(writes)` fires 8-9 simultaneous `dbPut()` calls, each opening its own connection. While connections are closed on `oncomplete`/`onerror`, this creates burst traffic of ~9 concurrent connections per save cycle.
- **Reproduction:**
  1. Make rapid changes to multiple stores within the 2s debounce window
  2. Debounce fires, `Promise.all()` opens 9 connections simultaneously
  3. On slow devices or when IndexedDB is under contention, connections queue up
- **Impact:** Performance degradation on low-end devices. Potential `InvalidStateError` if connection limit is reached.
- **Suggested Fix:** Create a single persistent connection (or connection pool) and reuse it across operations:
  ```typescript
  let dbInstance: IDBDatabase | null = null;
  async function getDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;
    dbInstance = await openDB();
    return dbInstance;
  }
  ```

### BUG-M3: Clipboard persists across project loads — can paste stale elements

- **File:** `frontend/src/lib/stores/selection.svelte.ts`, lines 5, 45-65
- **Description:** The `clipboard` state (line 5) is never cleared when loading a new template or importing a project. There is no exported `clearClipboard()` function. If a user copies elements from Project A, then loads Project B, they can paste Project A's elements into Project B.
- **Reproduction:**
  1. Open a template with text elements, select all, Ctrl+C
  2. Load a different template (built-in or from backend)
  3. Ctrl+V — old elements from the previous template appear
- **Impact:** Confusing UX; potentially corrupted ticket designs if pasted elements reference non-existent CSV columns.
- **Suggested Fix:** Export a `clearClipboard()` function and call it in every template-load path:
  ```typescript
  export function clearClipboard() { clipboard = []; }
  ```

### BUG-M4: History stack becomes stale after session restore

- **File:** `frontend/src/lib/stores/history.svelte.ts`, lines 6-7 (stacks), and `autosave.svelte.ts` line 120
- **Description:** When `restoreSession()` calls `setElements()` (autosave line 120), the history stacks are NOT cleared. The undo stack still contains snapshots from the previous session (or is empty). Pressing Ctrl+Z after restore could undo to an empty state or a completely different element set.
- **Reproduction:**
  1. Create several elements, make edits (building up undo history)
  2. Refresh page — auto-save kicks in before refresh
  3. On reload, click "Restore" to restore session
  4. Elements are restored, but undo stack is empty (fresh page = fresh module state)
  5. Actually this is safe on fresh page load (stacks initialize empty)
  6. BUT: if `restoreSession()` is called without a page reload (e.g., future "Load from IndexedDB" button), stale history remains
- **Impact:** Undo after restore leads to unexpected state. Currently mitigated by page reload clearing module state, but fragile.
- **Suggested Fix:** Call `clearHistory()` at the start of `restoreSession()`.

### BUG-M5: `hasFetched = true` set on error — prevents retry

- **File:** `frontend/src/lib/stores/templates.svelte.ts`, lines 72-74
- **Description:** In `fetchUserTemplates()`, the catch block (line 72-74) sets `hasFetched = true` even when the API call fails. If any UI code checks `hasFetched` to decide whether to show templates or a loading state, it will incorrectly show an empty list instead of allowing retry.
- **Reproduction:**
  1. Start the app with backend server offline
  2. `fetchUserTemplates()` fails, catch block runs
  3. `hasFetched = true`, `userTemplates = []` (unchanged from initial)
  4. Start the backend server
  5. UI shows "No templates" — no way to retry without page reload
- **Impact:** User sees empty template list with no indication of error or ability to retry.
- **Suggested Fix:** Only set `hasFetched = true` on success, or add a separate `hasError` state:
  ```typescript
  } catch (err) {
    console.error('Failed to fetch templates:', err);
    // Don't set hasFetched = true on error
  }
  ```

### BUG-M6: `dataUrlToFile()` crashes on malformed data URL

- **File:** `frontend/src/lib/stores/templates.svelte.ts`, lines 80-89
- **Description:** `dataUrl.split(',')` at line 81 assumes a valid `data:...;base64,...` format. If the background image data URL is malformed (e.g., missing comma, not base64), `atob(base64)` at line 83 throws `InvalidCharacterError`. This error propagates up from `saveTemplateToBackend()` with no user-friendly message.
- **Reproduction:**
  1. Set a background image via some code path that produces a malformed data URL
  2. Click "Save Template"
  3. `dataUrlToFile()` throws `InvalidCharacterError`
  4. Save fails with cryptic console error
- **Impact:** Template save fails with no user feedback. Unlikely in normal flow but possible with corrupted autosave data.
- **Suggested Fix:** Validate data URL format before parsing:
  ```typescript
  if (!dataUrl.startsWith('data:')) throw new Error('Invalid background image format');
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Invalid data URL');
  ```

### BUG-M7: Zero-dimension image causes Infinity scale in background rendering

- **File:** `frontend/src/lib/utils/canvas-render.ts`, lines 20, 27
- **Description:** `drawBackgroundOnCanvas()` calculates `scale = Math.max(canvasWidth / img.width, canvasHeight / img.height)` (line 20) and `Math.min(...)` (line 27). If `img.width` or `img.height` is 0 (e.g., broken image that triggers `onload` with 0 dimensions), the division produces `Infinity`. The subsequent `ctx.drawImage()` with Infinity dimensions silently fails or causes rendering artifacts.
- **Reproduction:**
  1. Upload a corrupted/empty image file as background
  2. If the browser fires `onload` with 0x0 dimensions (edge case)
  3. Scale becomes Infinity, drawImage draws nothing or crashes
- **Impact:** Rendering fails silently. Extremely unlikely with normal images since `onload` fires only for valid images, but possible with SVGs that have no intrinsic dimensions.
- **Suggested Fix:** Guard against zero dimensions:
  ```typescript
  if (img.width === 0 || img.height === 0) return;
  ```

### BUG-M8: `autoFitFontSize()` returns oversized font for zero/negative height boxes

- **File:** `frontend/src/lib/utils/text-fitting.ts`, lines 47-48
- **Description:** `hi = Math.min(300, Math.floor(maxHeight / 1.2))`. If `maxHeight = 0`, `hi = 0` and `lo = 6`. The while loop condition `lo <= hi` (6 <= 0) is false, so the loop never executes and `best = lo = 6` is returned. A font size of 6 is returned for a box with 0 height, meaning text will always overflow.
- **Reproduction:**
  1. Create a text element
  2. Resize its height to 0 (or very small)
  3. Enable "Contain in box"
  4. `autoFitFontSize()` returns 6, text renders outside the zero-height box
- **Impact:** Text overflows its bounding box when height is very small. Not a crash but violates the "contain in box" contract.
- **Suggested Fix:** Add early return for invalid dimensions:
  ```typescript
  if (maxWidth <= 0 || maxHeight <= 0) return 0;
  ```

### BUG-M9: Print layout produces NaN for zero-dimension custom tickets

- **File:** `frontend/src/lib/utils/print-layout.ts`, lines 46-47
- **Description:** For `ticketType: 'others'`, the layout is dynamically calculated. `Math.floor((availW + gap) / (ticketWidth + gap))` at line 46 — if `ticketWidth = 0` and `gap = 0`, this is `availW / 0 = Infinity`. `Math.max(1, Infinity) = Infinity`. Then `ticketsPerPage = Infinity * Infinity = Infinity`. `Math.ceil(totalTickets / Infinity) = 0` pages. The layout result contains `Infinity` values, causing downstream rendering to break.
- **Reproduction:**
  1. Set ticket type to "others"
  2. Set custom width and height both to 0
  3. Attempt to print or calculate layout
  4. Layout returns `ticketsPerRow: Infinity`, `ticketsPerCol: Infinity`
- **Impact:** Print preview breaks; potential infinite loop if code iterates `ticketsPerPage` times.
- **Suggested Fix:** Validate inputs at the start:
  ```typescript
  if (ticketWidth <= 0 || ticketHeight <= 0) {
    return { ticketsPerRow: 0, ticketsPerCol: 0, ticketsPerPage: 0, totalPages: 0, ... };
  }
  ```

### BUG-M10: PNG export produces `.png` file with empty name for non-Latin data

- **File:** `frontend/src/lib/utils/png-export.ts`, lines 34-36
- **Description:** `safeName = firstValue.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)` at line 35 strips all non-ASCII characters. If CSV data contains only non-Latin characters (Chinese, Japanese, Arabic, etc.), `safeName` becomes a string of underscores or even empty (if `firstValue` is empty after `Object.values()` fallback). `zip.file('.png', blob)` creates a file named just ".png" or "_____.png".
- **Reproduction:**
  1. Upload a CSV with non-Latin names (e.g., column values in Chinese characters)
  2. Export all as PNG
  3. ZIP contains files named "_.png", "__.png", etc.
  4. If multiple rows produce the same sanitized name, later files overwrite earlier ones in the ZIP
- **Impact:** Confusing filenames; potential data loss if duplicate sanitized names cause ZIP overwrites.
- **Suggested Fix:** Fall back to index-based naming:
  ```typescript
  let safeName = firstValue.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  if (!safeName) safeName = `ticket_${i + 1}`;
  ```

### BUG-M11: `png-export` `toBlob()` null assertion can crash on canvas failure

- **File:** `frontend/src/lib/utils/png-export.ts`, line 31
- **Description:** `canvas.toBlob((b) => resolve(b!), 'image/png')` uses non-null assertion on `b`. The `toBlob()` callback can pass `null` if the canvas is tainted (CORS image drawn without `crossOrigin`), the canvas dimensions are 0, or memory is exhausted. The `b!` assertion passes `null` to `resolve()`, and the subsequent `zip.file(name, null)` would add a corrupt entry.
- **Reproduction:**
  1. Use a background image from a cross-origin URL without CORS headers
  2. Canvas becomes tainted
  3. `toBlob()` calls callback with `null`
  4. `b!` resolves as `null`, ZIP entry is corrupt
- **Impact:** Corrupt ZIP file that fails to extract or contains 0-byte PNGs.
- **Suggested Fix:**
  ```typescript
  canvas.toBlob((b) => {
    if (b) resolve(b);
    else reject(new Error('Failed to export ticket as PNG'));
  }, 'image/png');
  ```

### BUG-M12: `dirty.markClean()` doesn't clear `lastSavedTemplateName` on auto-save

- **File:** `frontend/src/lib/stores/dirty.svelte.ts`, lines 21-27
- **Description:** `markClean(source?)` only updates `lastSavedTemplateName` if `source?.templateName !== undefined` (line 24). When auto-save calls `markClean()` without arguments (autosave.svelte.ts line 135), the template name from a previous manual save persists. The UI may show "Last saved as: MyTemplate" even though the most recent save was an auto-save, not a template save.
- **Reproduction:**
  1. Save project as template "MyTemplate"
  2. `markClean({ templateName: 'MyTemplate' })` is called
  3. Make more edits, auto-save triggers
  4. Auto-save calls `markClean()` (no args)
  5. `lastSavedTemplateName` still shows "MyTemplate"
  6. UI displays "Saved as: MyTemplate" even though changes were only auto-saved locally
- **Impact:** Misleading save indicator — user thinks changes are saved to backend when they're only in IndexedDB.
- **Suggested Fix:** Clear the template name when source is not provided:
  ```typescript
  export function markClean(source?: { templateName?: string }) {
    isDirty = false;
    lastSavedTime = new Date().toISOString();
    lastSavedTemplateName = source?.templateName ?? null;
  }
  ```

---

## Low Bugs

### BUG-L1: Toast `setTimeout` fires after manual close — wasteful but harmless

- **File:** `frontend/src/lib/stores/toast.svelte.ts`, lines 19-21
- **Description:** When `showToast()` is called, a `setTimeout` is registered (line 20) to auto-close the toast. If the user manually closes the toast via `closeToast()` (line 24) before the timeout fires, the timeout still executes. It calls `closeToast(id)` on an already-removed toast, which harmlessly filters an empty result.
- **Impact:** No functional bug — just a minor inefficiency. Multiple stale timeouts accumulate if many toasts are shown and closed rapidly.
- **Suggested Fix:** Track timer IDs and clear on manual close:
  ```typescript
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  // In showToast: timers.set(toast.id, setTimeout(...));
  // In closeToast: clearTimeout(timers.get(id)); timers.delete(id);
  ```

### BUG-L2: Clipboard paste offset can push elements outside canvas bounds

- **File:** `frontend/src/lib/stores/selection.svelte.ts`, lines 58-64
- **Description:** `getClipboard()` offsets each pasted element by `(+15, +15)` (lines 62-63). If the source element is near the canvas edge (e.g., position 220 on a 226mm-wide ticket), the pasted element appears at 235, which is outside the canvas.
- **Impact:** Pasted elements are invisible (outside visible area). User must manually drag them back.
- **Suggested Fix:** Clamp positions to canvas bounds after offset.

### BUG-L3: Label colors cleared without warning on column change

- **File:** `frontend/src/lib/stores/labels.svelte.ts`, lines 16-19
- **Description:** `setLabelColumn()` unconditionally clears `config.labelColors = {}` (line 18). If a user carefully assigned colors to 20+ label values, then accidentally changes the column dropdown and changes it back, all colors are lost.
- **Impact:** Lost user work (color assignments). Not a crash but frustrating UX.
- **Suggested Fix:** Store color mappings per column in a `Map<string, Record<string, string>>`, or show a confirmation dialog before clearing.

### BUG-L4: `setLabelBlockWidth` / `setRightBlockWidth` don't guard against NaN

- **File:** `frontend/src/lib/stores/labels.svelte.ts`, lines 27-29, 37-39
- **Description:** `Math.max(5, Math.min(80, NaN))` evaluates to `NaN`. If somehow a NaN value reaches these setters (e.g., from a parsed input field that returns NaN), the width becomes NaN, causing rendering to silently produce no label block.
- **Impact:** Label block disappears with no error message.
- **Suggested Fix:** Add `if (isNaN(width)) return;` guard.

### BUG-L5: `setCustomSize` accepts zero or negative dimensions

- **File:** `frontend/src/lib/stores/ticket-settings.svelte.ts`, lines 26-30
- **Description:** `setCustomSize(width, height)` directly assigns values without validation. Zero or negative dimensions cause downstream issues in canvas rendering (`canvas.width = 0` produces no output) and print layout (division by zero, see BUG-M9).
- **Impact:** Cascading issues in rendering and layout. Usually prevented by UI input constraints, but the store API is unguarded.
- **Suggested Fix:** `settings.width = Math.max(1, width);`

### BUG-L6: Zoom changes don't mark dirty — not persisted by auto-save

- **File:** `frontend/src/lib/stores/canvas.svelte.ts`, lines 12-14
- **Description:** `setZoom()` modifies the `zoom` state but doesn't call `markDirty()`. Zoom is not included in the auto-save snapshot (autosave.svelte.ts doesn't read zoom). This is likely intentional (zoom is viewport state, not project state), but inconsistent — if a user zooms in to work on details, refreshing resets zoom to 1.0.
- **Impact:** Minor UX annoyance. Not a data-loss issue.
- **Suggested Fix:** Either include zoom in auto-save or document it as intentionally transient.

### BUG-L7: Unused `_lineCount` parameter in `computeVerticalY`

- **File:** `frontend/src/lib/utils/text-fitting.ts`, line 85
- **Description:** The `_lineCount` parameter is prefixed with underscore and never used in the function body. It exists only in the function signature.
- **Impact:** No functional impact. Minor code cleanliness issue.
- **Suggested Fix:** Remove the parameter if no callers depend on it positionally. (Callers at canvas-render.ts line 100 pass `lines.length` — removing would require updating call sites.)

### BUG-L8: Cut-line positions in print layout can be negative

- **File:** `frontend/src/lib/utils/print-layout.ts`, lines 83-89
- **Description:** `getCutLinePositions()` calculates positions as `MARGIN + col * (ticketWidth + gap) - gap / 2`. When `col = 0` and `gap > 2 * MARGIN` (i.e., gap > 20mm), the position becomes negative: `10 + 0 - gap/2 < 0`. Negative positions on a print layout have no physical meaning.
- **Impact:** Cut lines render outside the printable area. Very unlikely with reasonable gap values (max gap is 20mm per `print-settings.svelte.ts` line 10).
- **Suggested Fix:** Clamp to 0: `Math.max(0, MARGIN + col * (ticketWidth + gap) - gap / 2)`.

---

## Data Flow / Type Issues

### BUG-T1: `TicketTemplate.labelBlock` vs `LabelConfig` type mismatch

- **File:** `frontend/src/lib/types/ticket.ts`, line 97
- **Related:** `frontend/src/lib/stores/templates.svelte.ts`, lines 11-38
- **Description:** The `TicketTemplate` interface has `labelBlock: { width: number } | null` (line 97), which is a completely different shape from `LabelConfig` (lines 73-79, with 5 fields). Built-in templates in `templates.svelte.ts` use `labelBlock: null`. When loading a built-in template, any code that tries to use `labelBlock` as a `LabelConfig` will fail or produce incorrect results.
- **Impact:** Built-in templates don't carry label configuration. Loading a built-in template after a custom one may leave stale label config in the store (if the loader doesn't explicitly clear it).
- **Suggested Fix:** Align the type — either change `TicketTemplate.labelBlock` to `labelConfig: LabelConfig | null`, or ensure loading code handles both shapes.

### BUG-T2: `ProjectData.labelSettings` naming inconsistency with store's `labelConfig`

- **File:** `frontend/src/lib/types/ticket.ts`, line 108
- **Description:** `ProjectData` uses the field name `labelSettings: LabelConfig` (line 108), but every store and component refers to label configuration as `labelConfig`. The export/import code in `ProjectActions.svelte` correctly maps between these names, so this is not a functional bug. However, the naming inconsistency makes the code harder to reason about and increases risk of future bugs when developers assume field names match.
- **Impact:** No current functional impact. Maintenance/readability concern.
- **Suggested Fix:** Rename to `labelConfig` in `ProjectData` for consistency. Update `ProjectActions.svelte` export/import accordingly.

---

## Cross-Cutting Concerns

### Concern 1: No transactional semantics in template save

- **File:** `frontend/src/lib/stores/templates.svelte.ts`, lines 91-137
- **Description:** `saveTemplateToBackend()` first uploads the background image (line 104-106), then creates/updates the template (line 126 or 133). If the image upload succeeds but the template create/update fails, the uploaded image is orphaned in Payload CMS media with no reference.
- **Impact:** Media storage bloat over time. No data loss for the user (they can retry), but orphaned files accumulate.

### Concern 2: No state reset coordination on template load

- **Files:** Multiple stores
- **Description:** When loading a new template, the caller must manually reset each store (elements, CSV, labels, settings, history, selection, etc.). There is no single "reset all stores" function. If a future code path forgets to clear one store (e.g., clipboard, history), stale state leaks into the new template.
- **Impact:** Fragile integration pattern. Currently works because `TemplateSection.svelte` carefully resets each store, but any new template-loading code path must remember to do the same.

---

## Files Audited (Complete List)

### Stores (14 files)
| File | Lines | Issues Found |
|------|-------|-------------|
| `autosave.svelte.ts` | 213 | C1, C2, M2 |
| `call.svelte.ts` | 311 | C3 |
| `templates.svelte.ts` | 144 | M5, M6 |
| `selection.svelte.ts` | 71 | M3, L2 |
| `history.svelte.ts` | 45 | M4 |
| `elements.svelte.ts` | 69 | (clean) |
| `csv.svelte.ts` | 37 | (clean) |
| `canvas.svelte.ts` | 45 | L6 |
| `ticket-settings.svelte.ts` | 44 | L5 |
| `labels.svelte.ts` | 60 | L3, L4 |
| `dirty.svelte.ts` | 28 | M12 |
| `toast.svelte.ts` | 27 | L1 |
| `theme.svelte.ts` | 27 | M1 |
| `print-settings.svelte.ts` | 13 | (clean) |

### Utilities (9 files)
| File | Lines | Issues Found |
|------|-------|-------------|
| `canvas-render.ts` | 229 | M7 |
| `text-fitting.ts` | 99 | M8, L7 |
| `print-layout.ts` | 93 | M9, L8 |
| `csv-parser.ts` | 77 | (clean) |
| `qr-generator.ts` | 69 | (clean) |
| `barcode-generator.ts` | 42 | C4 |
| `png-export.ts` | 45 | M10, M11 |
| `label-block.ts` | 26 | (clean) |
| `format.ts` | 8 | (clean) |

### Types & API (3 files)
| File | Lines | Issues Found |
|------|-------|-------------|
| `types/ticket.ts` | 182 | T1, T2 |
| `routes/ticket-generator/+page.svelte` | 69 | (related to C1) |
| `stores/canvas.svelte.ts` | 45 | L6 |

---

## Cross-Review Notes from Bug Hunter

*Reviewed: `frontend/reports/test-coverage-audit.md` (Test Engineer) and `frontend/reports/security-audit.md` (Security Guardian)*

### 1. Challenges to Test Coverage Report Priority Rankings

#### Challenge TC-1: `barcode-generator.ts` should be P1, not P2

The test report ranks `barcode-generator.ts` as P2 (Medium). However, my BUG-C4 shows the fallback catch block is **itself uncaught** — if the CODE128 retry fails, the uncaught exception crashes `renderTicketToCanvas()`, which crashes `exportAllAsPNG()`, aborting the entire export for ALL remaining tickets. A single bad barcode value breaks the whole batch. This is P1 risk at minimum. The test scenario "Error handling: try/catch logs but doesn't throw" (test report section 5.1) should explicitly cover the **double-failure** case where both the initial format AND the CODE128 fallback throw.

#### Challenge TC-2: `theme.svelte.ts` should be P2, not P3

Ranked P3 ("cosmetic only"). My BUG-M1 shows that `localStorage.getItem()` at module evaluation time (line 4) throws `SecurityError` in restricted environments (Safari private browsing on older versions, sandboxed iframes). Since this is module-level code, it **prevents the entire app from loading** — not cosmetic at all. The test should verify that the module initializes gracefully when `localStorage` throws.

#### Challenge TC-3: `call.svelte.ts` has unit-testable race conditions

Ranked P3 ("very low testability, better suited for E2E"). While WebRTC APIs need mocking, my BUG-C3 (race condition in `pollForIncomingCalls`) is a pure state-management issue testable with simple mocks: mock `getIncomingCalls()` to return after a delay, call `startCall()` during that delay, assert that the poll doesn't overwrite the outgoing call state. The poll logic, state transitions, and cleanup function are all testable without real WebRTC. Recommend splitting test effort: P2 for state/signal logic (unit tests with mocks), P3 for actual WebRTC integration (E2E).

#### Challenge TC-4: `autoFitFontSize` zero-dimension scenario should be Medium, not Low

The test report lists "Zero dimensions edge case" for `autoFitFontSize` as LOW priority. My BUG-M8 shows this returns font size 6 for a zero-height box, violating the "contain in box" contract. This should be MEDIUM — it's a functional correctness issue, not just an edge case. The binary search returns `best = lo = 6` (the minimum) without ever executing, meaning any box with height < 7.2px (`6 * 1.2`) gets text that overflows.

#### Challenge TC-5: Missing test scenarios for bugs I found

The test report's `autosave.svelte.ts` scenarios are missing:
- **Idempotency of `initAutoSave()`** (my BUG-C1): Test that calling `initAutoSave()` twice doesn't create duplicate effects. This is a high-priority scenario since the page component can call it from both the `onMount` and the restore/discard handlers.
- **Partial restore on IndexedDB failure** (my BUG-C2): Test that a single corrupt key doesn't block recovery of all other keys.

The test report's `selection.svelte.ts` scenarios are missing:
- **Clipboard persistence after template load** (my BUG-M3): Test that clipboard from project A can't be pasted into project B after loading a template.

The test report's `dirty.svelte.ts` scenarios should include:
- **`markClean()` without args preserves stale `lastSavedTemplateName`** (my BUG-M12): Test that calling `markClean()` after `markClean({ templateName: 'X' })` still shows "X".

#### Agreement TC-6: Effort estimates are reasonable

The overall estimates look realistic. I agree `autosave.svelte.ts` is XL and `canvas-render.ts` is L. One note: `canvas-render.ts` could push into XL territory depending on how painful canvas mocking is with jsdom — the `Image` constructor, `onload/onerror` callbacks, and `canvas.getContext('2d')` all need careful stubbing. The recommended `jest-canvas-mock` setup is critical infrastructure.

### 2. Challenges to Security Report Findings

#### Challenge SEC-1: Security M2 (base64 memory pressure) should be Low, not Medium

This finding describes a user uploading a large image and experiencing memory pressure. The user must voluntarily upload a large file to trigger this. This is a **performance/UX concern**, not a security vulnerability. An attacker cannot exploit this remotely — they'd need physical access or social engineering. The security report's own H7 (background image size limit) already covers the actionable remediation. Recommend downgrading M2 to Low.

#### Challenge SEC-2: Security M7 (document.write for print) overstated at Medium

The report itself acknowledges "Current Risk: Low" and "data flows are safe today." The `document.write` HTML contains only `canvas.toDataURL()` output (base64 PNG data) — there is no code path where user-controlled text enters the HTML string. The "one code change away" argument applies to any concatenation pattern anywhere. Recommend downgrading to Low/Informational as a code quality recommendation, not a security finding.

#### Challenge SEC-3: Security M1 (CSV formula injection) remediation is risky

The proposed fix — prepending `'` to values starting with `=+@-|\t` — would **corrupt legitimate data** in a ticket generator context:
- Email addresses: `+user@example.com` becomes `'+user@example.com` on tickets
- Mathematical notation: `=A` in a field becomes `'=A`
- Negative numbers: `-5` becomes `'-5` (though the regex `/^[=+\-@|\t]/` would catch this)

The ticket generator renders CSV data to **canvas** (not Excel). Formula injection is only a risk if data is re-exported as CSV and opened in a spreadsheet. The current app never re-exports CSV. Recommend: don't sanitize on import (it corrupts rendering). Instead, sanitize on any future CSV export path, if one is ever added. Keep as advisory, not a code change.

#### Challenge SEC-4: Security C1+C2 (access control) remediation will break the frontend

The security report proposes `({ req }) => !!req.user` for all write operations. This is correct in principle but the remediation complexity is significantly understated. The **entire frontend operates without authentication**. Adding auth checks to collections means:
1. Every `payloadFetch()` call needs to send an auth token
2. A login/register UI flow must be built
3. Token storage and refresh logic must be added
4. The `call.svelte.ts` username-based system must be replaced with authenticated user IDs
5. `templates.svelte.ts` save/fetch must include credentials

This is not a config change — it's a feature epic. The remediation roadmap should acknowledge this dependency chain. Recommend: the security fix should be done as a phased approach, not a "before any deployment" immediate fix, unless deployment is far away.

#### Challenge SEC-5: Security H6 (CSV parser limits) — existing partial mitigation not mentioned

The report says there are no limits on CSV parsing, but `FileUploadSection.svelte:16` already has a **5MB file size check** for CSV uploads. This limits the attack surface significantly. The real gap is the `.veenttix` import path (noted in the report), which bypasses the size check. The finding is valid but should note the existing mitigation for the direct CSV upload path.

### 3. Bug/Security Overlap Analysis

| My Bug | Security Finding | Overlap | Notes |
|--------|-----------------|---------|-------|
| BUG-M6 (malformed data URL crash) | SEC-M4 (unvalidated data URL) | **Same root cause** | My finding focuses on the crash; security focuses on the outbound request risk. Both fixed by the same `data:` prefix check. |
| BUG-C3 (call polling race condition) | SEC-H3 (call signals fully open) | **Related** | My race condition is exploitable by an attacker who can inject signals (which is trivial given SEC-H3's open access). An attacker could time signal injection to exploit the async gap in `pollForIncomingCalls()`. **Security impact of my bug is higher than I originally rated.** |
| BUG-C4 (barcode fallback crash) | SEC-H5 (unsanitized .veenttix import) | **Related** | A malicious `.veenttix` file could include barcode elements with values designed to crash both the initial format AND the CODE128 fallback, causing a targeted DoS of the export feature. |
| BUG-M5 (hasFetched on error) | SEC-C2 (anonymous CRUD) | **Amplified by** | If the backend is locked down (SEC-C2 remediated) and the frontend doesn't yet send auth tokens, every `fetchUserTemplates()` call will fail. BUG-M5 means the user gets ONE failed attempt with no retry — the broken `hasFetched = true` on error becomes much more impactful. |
| BUG-C1 (effect accumulation) | SEC-M2 (memory pressure) | **Amplified by** | If multiple autosave effects run concurrently (BUG-C1), each one reads the background image data URL and converts to blob. This multiplies the memory pressure described in SEC-M2. |
| BUG-M1 (localStorage crash) | — | **No overlap** | Pure logic bug, no security angle. |
| BUG-M10 (empty filename in PNG) | — | **No overlap** | Could arguably cause ZIP filename collisions but not exploitable. |

### 4. Risk Assessment of Proposed Security Remediations

| Security Fix | Risk to Existing Functionality | Mitigation |
|-------------|-------------------------------|------------|
| **C1+C2: Lock down collections** | **HIGH** — Frontend has no auth flow. All API calls will fail with 403. Template loading, saving, call signaling, and messaging will all break. | Phase the rollout: (1) Add auth system first, (2) Update frontend API client, (3) Then lock down collections. Or add a feature flag. |
| **C3: PAYLOAD_SECRET validation** | **LOW** — Will fail on startup if .env is missing. This is desired behavior but might surprise developers doing fresh setup. | Add clear error message: "Set PAYLOAD_SECRET in .env — see .env.example". |
| **C4: Disable GraphQL Playground** | **LOW** — Only affects production. Dev experience unchanged. | Simple environment check, no risk. |
| **H4: Sanitize error messages** | **LOW** — Only changes error message format. No functional impact on success paths. | Ensure console still logs full error for debugging. |
| **H5: Schema validation on import** | **LOW** — Additive check before existing logic. If validation rejects a valid file, user can still use the old file format. | Make validation permissive (check structure, not exact values). Add version field for future format changes. |
| **H6: CSV parser limits** | **MEDIUM** — `MAX_ROWS = 10000` could reject legitimate large datasets. `parseCSV` throws on limit exceeded, but `loadCSV` in `csv.svelte.ts:15-19` calls `parseCSV` without try-catch — the error would be uncaught. | Add try-catch in `loadCSV()`. Choose limit carefully (10k is probably fine for a ticket generator). Show user-friendly error message. |
| **H7: Background image size limit** | **LOW** — Additive validation. Rejected files show toast. | Choose reasonable limit (10-15MB). |
| **M1: CSV formula sanitization** | **HIGH** — Prepending `'` to values corrupts legitimate data on rendered tickets. See Challenge SEC-3 above. | Don't sanitize on import. Only sanitize if/when CSV re-export is added. |
| **M4: Data URL prefix validation** | **LOW** — Only rejects non-`data:` URLs. Transparent to normal use. | Simple guard, no risk. |
| **M8: JSON field validation on backend** | **MEDIUM** — Strict validation could reject existing templates saved before validation was added. Templates with unusual but valid data might fail to update. | Use permissive validation (type checks, not value range checks). Test against existing saved data before deploying. |

### 5. Findings I Think Are Missing from Other Reports

#### Missing from Security Report

1. **`autosave.svelte.ts:66-68` — `fetch(dataUrl)` could be exploited more broadly than noted.** SEC-M4 mentions replacing the data URL with an HTTP URL via DevTools. But `dataUrlToBlob()` is also called in `initAutoSave()` (line 199), which runs every 2 seconds after debounce. If an attacker tampers the reactive `backgroundImage` state (e.g., via a browser extension or prototype pollution), `fetch()` is called repeatedly on every auto-save cycle — this creates a persistent exfiltration channel, not just a one-time request.

2. **`call.svelte.ts` polling race (BUG-C3) has security implications.** An attacker who can write to `call-signals` (trivial given SEC-C2) can time a fake "incoming call" signal to arrive during the async gap in `pollForIncomingCalls()`, hijacking the user's call state and potentially redirecting media streams. This should be noted as a secondary impact of SEC-H3.

#### Missing from Test Coverage Report

1. **No scenario for testing `loadCSV()` error propagation.** `csv.svelte.ts:15-19` calls `parseCSV()` which can throw (empty CSV, no headers, no data rows). The store doesn't catch these errors. If tests only test the happy path, this gap will remain hidden until a user uploads a malformed CSV and gets an uncaught exception.

2. **No scenario for testing `exportProject()` with Svelte 5 proxy objects.** `ProjectActions.svelte:41` does `JSON.parse(JSON.stringify(getElements()))` to strip Svelte 5 proxies. If `getElements()` returns a proxy that doesn't serialize cleanly (e.g., contains circular references from a bug), `JSON.stringify` throws. This should be tested.

### 6. Recommendations for Fix Prioritization

Based on cross-referencing all three reports, here's my recommended fix order considering both bug severity and security impact:

1. **BUG-C3 + SEC-H3** (call race condition + open signals) — Fix together. The race condition becomes a security vulnerability when signals are publicly writable.
2. **BUG-C4** (barcode fallback crash) — Quick fix, high impact. Wrap second `JsBarcode()` in try-catch.
3. **BUG-C1** (autosave effect accumulation) — Add idempotency guard to `initAutoSave()`.
4. **BUG-C2 + SEC-M4** (restore partial failure + data URL validation) — Fix both in `autosave.svelte.ts`. Use `Promise.allSettled()` and add `data:` prefix check.
5. **BUG-M1** (theme localStorage crash) — Quick fix, prevents app load failure in restricted environments.
6. **SEC-C3** (PAYLOAD_SECRET) — Quick config fix, critical for any deployment.
7. **BUG-M5** (hasFetched on error) — Becomes critical once SEC-C2 auth is added.
8. **SEC-C1+C2** (access control) — Large effort, plan as epic with auth system.

*End of cross-review notes.*
