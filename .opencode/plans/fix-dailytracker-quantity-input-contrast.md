# Plan: Fix unreadable quantity input on /dailyTracker

## Symptom
On `/dailyTracker`, when logging a recipe/ingredient and typing a quantity, the typed text is unreadable (text colour matches the input background).

## Root Cause
Two issues, both in the quantity inputs of the "Log Food" form:

### 1. Ingredient Quantity / Unit inputs (primary fix — `styles/globals.css`)
The quantity input (`components/AddShoppingItem.tsx:493-508`, `id="ingredAmount"`) and unit `<select>` use the shared `.input-modern` class.
`styles/globals.css:313-323` contains a duplicate `.input-modern` definition that references **undefined CSS variables**:
- `background: var(--bg-secondary)` → undefined → resolves to transparent (invisible/ambiguous background)
- `color: var(--text-primary)` → undefined → resolves to inherited body colour

These variables (`--bg-secondary`, `--text-primary`) are never defined anywhere (verified via grep — only usage sites exist at globals.css lines 267/315/318). The earlier valid definition at lines 246-262 uses the properly defined tokens `var(--secondary)` / `var(--foreground)`.

### 2. Recipe "Servings to Log" input (hardening — `pages/dailyTracker.tsx:624`)
The number input has **no explicit text colour class** (inherits `--foreground`), and a near-invisible background (`bg-foreground/[0.05]`), leaving it fragile to any inherited colour shift. User asked to change the background so text is readable.

## Changes

### Change 1 — `styles/globals.css` (lines 314-323, the later duplicate `.input-modern`)
Replace the undefined variables with the defined theme tokens (same tokens as the original definition at lines 246-262):
```css
.input-modern {
  background: var(--secondary);
  border: 1px solid var(--glass-border);
  border-radius: 0.5rem;
  color: var(--foreground);
  padding: 0.75rem 1rem;
  width: 100%;
  outline: none;
  transition: all 0.2s ease;
}
```
- Background becomes the solid, theme-aware `--secondary` (dark: oklch 0.27 warm / light: oklch 0.87) so cream/dark text always contrasts.
- Note: Tailwind overrides (`bg-background/40` in non-overlay mode, `bg-input`/glass utilities in overlay mode) still take precedence where applied, but they are translucent over a now-solid readable base colour.
- Update the duplicate `:focus` rule (line 260) to match: `background: var(--secondary)` (already correct there; no change needed).

### Change 2 — `pages/dailyTracker.tsx:624` (Servings to Log number input)
Give the input an explicit theme-aware background token instead of the hand-tuned `bg-foreground/[0.05]`:
```
className="w-24 bg-input border border-border rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-olive/50"
```
`bg-input` maps to `--input` (dark: `oklch(0.97 0.015 85 / 9%)`, light: `oklch(0.5 0.04 60 / 20%)`) — the project's designated input-surface token, guaranteeing contrast with inherited `--foreground` text in both themes.

## Verification
- `npm run dev` → navigate to `/dailyTracker`
- Log a recipe: confirm typed servings text is visible in both dark and light themes
- Log an ingredient via search prefill: confirm Quantity (`#ingredAmount`) and Unit fields show readable text on solid background in both themes
- Check the mobile overlay variant of the same form

## Out of Scope
- `SearchableDropdown.module.css` hard-coded dark glass (readable by design; separate concern)
- Removing the duplicate `.input-modern` definitions entirely (larger cleanup, riskier)
