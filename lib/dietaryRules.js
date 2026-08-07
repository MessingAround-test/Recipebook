// Shared dietary rule builders. The planner's AI features and the older
// ingredient-suggestion endpoints enforce the same constraints so a user's
// settings are respected consistently everywhere.

export const RESTRICTION_LABELS = {
    gluten_free: 'Gluten-free',
    dairy_free: 'Dairy-free',
    nut_free: 'Nut-free',
    low_fodmap: 'Low-FODMAP',
    kosher: 'Kosher',
    halal: 'Halal'
};

/**
 * Builds a human-readable sentence describing a user's dietary constraints.
 * Combine a dietary_preference (none/vegetarian/vegan/pescetarian) with any
 * additional dietary_restrictions, then feed the result into an AI prompt.
 */
export function buildDietaryConstraints(user = {}) {
    const preference = user.dietary_preference || 'none';
    const restrictions = user.dietary_restrictions || [];
    const lines = [];

    if (preference === 'vegetarian') {
        lines.push('Vegetarian: NO meat, poultry, or seafood.');
    } else if (preference === 'vegan') {
        lines.push('Vegan: NO animal products whatsoever (no meat, poultry, seafood, dairy, eggs, or honey).');
    } else if (preference === 'pescetarian') {
        lines.push('Pescetarian: NO meat or poultry. Seafood is allowed.');
    }

    (restrictions || []).forEach(r => {
        if (r === 'gluten_free') {
            lines.push('Gluten-free: NO wheat, barley, rye, or any gluten-containing grain or ingredient.');
        } else if (r === 'dairy_free') {
            lines.push('Dairy-free: NO milk, butter, cream, cheese, yoghurt, or any dairy product.');
        } else if (r === 'nut_free') {
            lines.push('Nut-free: NO peanuts, tree nuts, or any nut-derived products.');
        } else if (r === 'low_fodmap') {
            lines.push('Low-FODMAP: avoid high-FODMAP foods (onion, garlic, cauliflower, legumes in excess, wheat, etc.).');
        } else if (r === 'kosher') {
            lines.push('Kosher: follow kosher dietary laws (no pork, no shellfish, no mixing meat and dairy).');
        } else if (r === 'halal') {
            lines.push('Halal: follow halal dietary laws (no pork, no alcohol, meat must be halal).');
        }
    });

    if (lines.length === 0) lines.push('No dietary restrictions.');
    return lines.join(' ');
}

/**
 * Returns the set of IngredientConversion categories allowed for the user.
 * Used to filter DB-backed ingredient suggestions by preference + restrictions.
 */
export function allowedIngredientCategories(user = {}) {
    const preference = user.dietary_preference || 'none';
    const restrictions = user.dietary_restrictions || [];

    let allowed = ['Fresh Produce', 'Meat', 'Seafood', 'Nuts', 'Seeds', 'Dairy', 'Grains', 'Pantry'];

    if (preference === 'vegetarian') {
        allowed = allowed.filter(c => c !== 'Meat' && c !== 'Seafood');
    } else if (preference === 'vegan') {
        allowed = allowed.filter(c => c !== 'Meat' && c !== 'Seafood' && c !== 'Dairy');
    } else if (preference === 'pescetarian') {
        allowed = allowed.filter(c => c !== 'Meat');
    }

    if (restrictions.includes('dairy_free')) allowed = allowed.filter(c => c !== 'Dairy');
    if (restrictions.includes('nut_free')) allowed = allowed.filter(c => c !== 'Nuts');
    if (restrictions.includes('gluten_free')) allowed = allowed.filter(c => c !== 'Grains');

    return allowed;
}
