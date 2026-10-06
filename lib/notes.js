// Shared note-noise filtering, used by the shopping list display
// (components/IngredientCard.js) and Shop Mode (components/ShopMode.tsx).
//
// Notes that carry no useful information for the shopper:
//  - "Pantry item" — an import artefact from the weekly planner; always hidden.
//  - "From recipe: X" / "For Monday" / "For 2026-10-01" — redundant on a
//    standalone item (the recipe is implied), but useful when expanded on a
//    grouped sub-item.

export function isAlwaysNoiseNote(note) {
    return /^pantry item$/i.test(String(note || '').trim());
}

export function isGroupOnlyNote(note) {
    return /^(from recipe:|for\s+\S+$)/i.test(String(note || '').trim());
}

/** Should a note be shown? Group context shows the group-only ones too. */
export function noteForDisplay(note, { isGroup = false } = {}) {
    const text = String(note || '').trim();
    if (!text) return '';
    if (isAlwaysNoiseNote(text)) return '';
    if (isGroupOnlyNote(text) && !isGroup) return '';
    return text;
}
