
export const VALID_CATEGORIES = [
    'Fresh Produce', 'Dairy and Eggs', 'Bakery', 'Meat and Seafood',
    'Canned Goods', 'Pasta and Grains', 'Condiments and Sauces', 'Snacks',
    'Beverages', 'Frozen Foods', 'Cereal and Breakfast Foods', 'Baking Supplies',
    'Household and Cleaning', 'Personal Care', 'Health and Wellness',
    'International Foods', 'Deli and Prepared Foods', 'Home and Garden'
];

/**
 * Robustly determines the category for an ingredient.
 * Priority:
 * 1. IngredientConversion (Saved user preference)
 * 2. ShoppingListItem (Most common historical usage)
 * 3. AI (fallback)
 */
export async function determineCategory(ingredientName: string, models: any, callGroqChat: any) {
    const { IngredientConversion, ShoppingListItem } = models;

    // 1. Check IngredientConversion (Source of truth for user preferences)
    try {
        const conversion = await IngredientConversion.findOne({
            ingredient_name: { $regex: new RegExp(`^${ingredientName}$`, 'i') }
        });
        if (conversion && conversion.category) {
            return conversion.category;
        }
    } catch (e) {
        console.error('Error checking IngredientConversion for category:', e);
    }

    // 2. Check historical data from ShoppingListItem
    try {
        const existingItems = await ShoppingListItem.find({
            name: { $regex: new RegExp(`^${ingredientName}$`, 'i') }
        });

        if (existingItems.length > 0) {
            // Count categories and pick the most common
            const categoryCounts: Record<string, number> = {};
            existingItems.forEach((item: any) => {
                if (item.category && VALID_CATEGORIES.includes(item.category)) {
                    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
                }
            });

            const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                return sorted[0][0];
            }
        }
    } catch (e) {
        console.error('Error checking existing items for category:', e);
    }

    // 3. Fall back to AI
    try {
        const messages = [
            {
                role: "system",
                content: `You are a grocery organization assistant. Given an ingredient name, respond with a JSON object containing only 'category'. Valid categories: ${VALID_CATEGORIES.join(', ')}. Output MUST be a single JSON object.`
            },
            {
                role: "user",
                content: `Ingredient: "${ingredientName}"`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        const data = JSON.parse(responseText);
        if (data.category && VALID_CATEGORIES.includes(data.category)) {
            return data.category;
        }
    } catch (e) {
        console.error('AI category determination failed:', e);
    }

    return 'Fresh Produce'; // sensible default
}
