import { CRITERIA_OPTIONS } from './dishLists/criteria';

/**
 * Canonical form of an ingredient name, used to decide whether two names are
 * actually different. Ignores case and collapsed whitespace so "firm tofu",
 * "Firm Tofu" and "FIrm Tofu" all compare equal.
 */
export const canonName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Every dietary label the app knows about, lower-cased for matching.
const DIETARY_LABELS = new Set(CRITERIA_OPTIONS.map(c => c.label.toLowerCase()));

// Removes a trailing "(...)" tag from a recipe name when that tag is made up
// solely of known dietary labels, so re-runs don't stack tags.
const stripDietaryTag = (name) => {
    const m = name.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (!m) return name;
    const inner = m[2].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (inner.length && inner.every(l => DIETARY_LABELS.has(l))) return m[1].trim();
    return name;
};

/**
 * Cleans the manual substitutions the client sends on a re-run into a predictable
 * shape. Drops entries without a target name.
 */
export const sanitizeSubstitutions = (input) => {
    if (!Array.isArray(input)) return [];
    return input
        .map(s => ({
            index: Number.isInteger(s?.index) ? s.index : null,
            from: String(s?.from || '').trim(),
            to: String(s?.to || '').trim()
        }))
        .filter(s => s.to);
};

/**
 * Appends a dietary tag to a recipe name, e.g. "Vori-vori (Pescetarian)".
 * Idempotent: a previously-appended tag made only of known dietary labels is
 * stripped first, so repeated remix passes don't stack "(Vegan) (Vegan)".
 */
export const applyDietaryNameTag = (name, labels = []) => {
    const base = String(name || '').trim();
    const clean = labels.map(l => String(l || '').trim()).filter(Boolean);
    if (clean.length === 0) return base;
    return `${stripDietaryTag(base)} (${clean.join(', ')})`;
};

/**
 * Normalises the AI's change list against the returned recipe so the client can
 * render what changed and offer substitution options.
 *
 * Entries where the ingredient wasn't actually substituted (identical names, or
 * pure case/whitespace variants) are dropped. The returned recipe is treated as
 * the source of truth for the chosen substitute's name, and alternatives are
 * de-duped case-insensitively with the chosen substitute first.
 */
export const normalizeRemixChanges = (changes, recipe) => {
    if (!Array.isArray(changes)) return [];
    const out = [];
    for (const c of changes) {
        const kind = c.kind === 'step' ? 'step' : 'ingredient';
        const index = Number(c.index);
        if (!Number.isInteger(index) || index < 0) continue;
        if (kind === 'ingredient') {
            const ing = Array.isArray(recipe?.ingredients) ? recipe.ingredients[index] : null;
            const originalName = String(c.originalName || ing?.Name || '').trim();
            // The returned recipe is the source of truth for the chosen name, so
            // display casing/whitespace always matches what actually got saved.
            const newName = String(ing?.Name || c.newName || originalName).trim();
            // Drop no-op substitutions ("firm tofu" -> "Firm Tofu", "skewers" -> "skewers").
            if (canonName(originalName) === canonName(newName)) continue;

            const rawAlts = Array.isArray(c.alternatives) ? c.alternatives : [];
            const alternatives = [];
            const seen = new Set();
            const pushAlt = (name) => {
                const n = String(name || '').trim();
                const key = canonName(n);
                if (!n || seen.has(key)) return;
                seen.add(key);
                alternatives.push(n);
            };
            pushAlt(newName);
            rawAlts.forEach(pushAlt);
            out.push({
                kind: 'ingredient',
                index,
                originalName,
                newName,
                newNote: c.newNote != null ? String(c.newNote) : '',
                reason: c.reason ? String(c.reason) : '',
                alternatives
            });
        } else {
            const step = Array.isArray(recipe?.instructions) ? recipe.instructions[index] : null;
            out.push({
                kind: 'step',
                index,
                originalText: String(c.originalText || step?.Text || '').trim(),
                newText: String(c.newText || step?.Text || '').trim()
            });
        }
    }
    return out;
};
