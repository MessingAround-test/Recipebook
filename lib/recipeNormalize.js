import { resolveUnitKey, quantity_unit_conversions, convertToStandardUnit, normalizeUnicodeFractions } from './conversion';

/**
 * Cleans AI-extracted ingredients: resolves units to canonical keys (falling
 * back to a sensible standard unit when the unit is unknown) and strips
 * unit words stuck onto amounts/names. Shared by the notes-extraction and
 * recipe-generation endpoints so both produce identical, saveable shapes.
 */
export function normalizeExtractedIngredients(ingredients) {
    if (!Array.isArray(ingredients)) return ingredients;

    return ingredients.map(ing => {
        const cleanIng = { ...ing };

        // 1. Convert the unit to a standard key, remapping unknown units
        //    (scales the Amount when the mapping requires it, e.g. dozen -> 12 each)
        const standard = convertToStandardUnit(ing.AmountType, ing.Amount);
        cleanIng.AmountType = standard.unit;
        if (standard.amount !== undefined) {
            cleanIng.Amount = standard.amount;
        }
        if (standard.note) {
            const existingNote = String(cleanIng.Note || '').trim();
            cleanIng.Note = existingNote ? `${standard.note}, ${existingNote}` : standard.note;
        }

        // 2. Clean 'Amount' if it contains the unit (e.g., "320g" -> "320")
        if (typeof cleanIng.Amount === 'string') {
            // Convert unicode fraction glyphs ("½") into ASCII fractions ("1/2")
            cleanIng.Amount = normalizeUnicodeFractions(cleanIng.Amount);

            const unitSynonyms = quantity_unit_conversions[cleanIng.AmountType]?.synonyms || [];
            const allSynonyms = [...unitSynonyms, cleanIng.AmountType];

            allSynonyms.forEach(syn => {
                if (syn && cleanIng.Amount.toLowerCase().endsWith(syn.toLowerCase())) {
                    cleanIng.Amount = cleanIng.Amount.toLowerCase().replace(syn.toLowerCase(), '').trim();
                }
            });

            // If it's still messy, try to extract just the numeric/fraction part
            // Priority: Mixed Fraction (1 1/2) -> Simple Fraction (1/2) -> Decimal (0.5) -> Integer (1)
            const numMatch = cleanIng.Amount.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)/);
            if (numMatch) {
                cleanIng.Amount = numMatch[0].trim();
            }
        }

        // 3. Clean 'Name' if it starts with the unit (e.g., "gGrilled Eggplant" -> "Grilled Eggplant")
        if (cleanIng.Name && typeof cleanIng.Name === 'string') {
            const unitSynonyms = quantity_unit_conversions[cleanIng.AmountType]?.synonyms || [];
            const allSynonyms = [...unitSynonyms, cleanIng.AmountType];

            allSynonyms.forEach(syn => {
                if (syn && cleanIng.Name.toLowerCase().startsWith(syn.toLowerCase())) {
                    // Only strip if it's followed by a space or capital letter (heuristic)
                    const potentialRemainder = cleanIng.Name.substring(syn.length);
                    if (potentialRemainder.startsWith(' ') || /^[A-Z]/.test(potentialRemainder)) {
                        cleanIng.Name = potentialRemainder.trim();
                    }
                }
            });
        }

        return cleanIng;
    });
}

// Words that describe how an ingredient is prepared or its state, not the
// ingredient itself. Stripping these into the Note keeps "mashed avocado" and
// "avocado" as the same base ingredient so nutrition lookups don't duplicate.
const PREP_WORDS = new Set([
    'mashed', 'smashed', 'chopped', 'diced', 'cubed', 'sliced', 'grated',
    'shredded', 'minced', 'crushed', 'ground', 'pounded', 'pressed',
    'cooked', 'roasted', 'grilled', 'fried', 'baked', 'steamed', 'boiled',
    'poached', 'blanched', 'wilted', 'braised', 'simmered', 'seared',
    'pan-seared', 'glazed', 'caramelized', 'caramelised', 'toasted',
    'melted', 'softened', 'whipped', 'whisked', 'beaten', 'blended',
    'pureed', 'puréed', 'broken', 'crumbled', 'flaked', 'torn', 'squeezed',
    'zested', 'peeled', 'skinned', 'pitted', 'seeded', 'deseeded',
    'trimmed', 'halved', 'quartered', 'thawed', 'frozen', 'chilled',
    'drained', 'rinsed', 'soaked', 'marinated', 'smoked', 'pickled',
    'candied', 'prepared', 'cut', 'chopped', 'tender'
]);

// Qualifiers that modify a prep word (e.g. "finely diced") — folded into the
// prep phrase but never treated as the base ingredient.
const MODIFIER_WORDS = new Set([
    'finely', 'coarsely', 'roughly', 'freshly', 'thinly', 'thickly',
    'lightly', 'evenly', 'loosely', 'tightly', 'chunky', 'soft', 'hard',
    'small', 'medium', 'large', 'rough', 'fine'
]);

export function normalizePrepWords(ingredients) {
    if (!Array.isArray(ingredients)) return ingredients;

    return ingredients.map(ing => {
        const clean = { ...ing };
        const name = String(clean.Name || '').trim();
        if (!name) return clean;

        const words = name.split(/\s+/);
        const prep = [];
        let i = 0;
        while (i < words.length) {
            const w = words[i].toLowerCase();
            if (PREP_WORDS.has(w)) {
                prep.push(words[i]);
                i += 1;
            } else if (MODIFIER_WORDS.has(w) && i + 1 < words.length && PREP_WORDS.has(words[i + 1].toLowerCase())) {
                prep.push(words[i]);
                i += 1;
            } else {
                break;
            }
        }
        if (prep.length === 0) return clean;

        const baseName = words.slice(i).join(' ');
        if (!baseName) return clean;

        clean.Name = baseName;
        const prepText = prep.join(' ');
        const existingNote = String(clean.Note || '').trim();
        if (existingNote && existingNote.toLowerCase().includes(prepText.toLowerCase())) {
            return clean;
        }
        clean.Note = existingNote ? `${prepText}, ${existingNote}` : prepText;
        return clean;
    });
}

// Matches step markers like "1." "1)" "1:" and "Step 1:" so numbered steps
// crammed into a single string can be split into individual instructions.
const STEP_MARKER_RE = /(?:^|\s)(?:step\s+)?(\d{1,2})\s*[\.\):]\s+/gi;
const LEADING_STEP_MARKER_RE = /^(?:step\s+)?\d{1,2}\s*[\.\):]\s+/i;

/**
 * Splits a block of text into individual steps on newlines and numbered
 * markers ("1.", "1)", "Step 1:"), stripping the markers themselves.
 */
function splitInstructionText(text) {
    const results = [];
    for (const rawLine of String(text).split(/\r?\n+/)) {
        const line = rawLine.trim();
        if (!line) continue;

        const markers = [...line.matchAll(STEP_MARKER_RE)];
        if (markers.length > 1) {
            // Multiple numbered steps inside one block — slice between markers,
            // keeping any text that precedes the first marker as its own step.
            const preText = line.slice(0, markers[0].index).trim();
            if (preText) results.push({ Text: preText });
            for (let i = 0; i < markers.length; i++) {
                const start = markers[i].index + markers[i][0].length;
                const end = i + 1 < markers.length ? markers[i + 1].index : line.length;
                const stepText = line.slice(start, end).trim();
                if (stepText) results.push({ Text: stepText });
            }
        } else {
            const cleaned = line.replace(LEADING_STEP_MARKER_RE, '').trim();
            results.push({ Text: cleaned || line });
        }
    }
    return results;
}

/**
 * Normalizes whatever shape the AI returned for the cooking method into a
 * clean [{ Text, Note }] instruction list. Handles a missing value, a plain
 * string, an array of strings, and arrays of objects with alternate key
 * names (text/step/instruction/description).
 */
export function normalizeExtractedInstructions(raw) {
    if (!raw) return [];

    if (typeof raw === 'string') {
        return splitInstructionText(raw);
    }

    if (!Array.isArray(raw)) return [];

    const steps = [];
    for (const item of raw) {
        if (item == null) continue;
        if (typeof item === 'string' || typeof item === 'number') {
            steps.push(...splitInstructionText(String(item)));
            continue;
        }
        if (typeof item === 'object') {
            const text = item.Text || item.text || item.step || item.instruction || item.description;
            if (!text || !String(text).trim()) continue;
            const step = { Text: String(text).trim() };
            const note = item.Note || item.note;
            if (note && String(note).trim()) {
                step.Note = String(note).trim();
            }
            steps.push(step);
        }
    }
    return steps;
}
