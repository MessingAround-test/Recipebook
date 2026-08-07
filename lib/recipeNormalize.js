import { resolveUnitKey, quantity_unit_conversions } from './conversion';

/**
 * Cleans AI-extracted ingredients: resolves units to canonical keys and strips
 * unit words stuck onto amounts/names. Shared by the notes-extraction and
 * recipe-generation endpoints so both produce identical, saveable shapes.
 */
export function normalizeExtractedIngredients(ingredients) {
    if (!Array.isArray(ingredients)) return ingredients;

    return ingredients.map(ing => {
        const cleanIng = { ...ing };

        // 1. Resolve unit to canonical key
        cleanIng.AmountType = resolveUnitKey(ing.AmountType);

        // 2. Clean 'Amount' if it contains the unit (e.g., "320g" -> "320")
        if (typeof cleanIng.Amount === 'string') {
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
