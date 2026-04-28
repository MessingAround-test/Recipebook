import dbConnect from '../../../lib/dbConnect'
import ShoppingListItem from '../../../models/ShoppingListItem'
import IngredientConversion from '../../../models/IngredientConversion'
import { verifyToken } from "../../../lib/auth.ts";
import { logAPI } from '../../../lib/logger.ts';
import { normalizeToGrams, getShorthandForMeasure, resolveUnitKey, addCalculatedFields } from '../../../lib/conversion'

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    const { shoppingListId } = req.query;
    if (!shoppingListId) {
        return res.status(400).json({ success: false, message: "shoppingListId is required" });
    }

    try {
        await dbConnect();

        // 1. Fetch all items for this shopping list
        const items = await ShoppingListItem.find({ shoppingListId, deleted: { $ne: true } }).lean();

        if (items.length === 0) {
            return res.status(200).json({ success: true, res: [] });
        }

        // 2. Get unique names to fetch conversions in bulk
        const uniqueNames = [...new Set(items.map(item => item.name.toLowerCase()))];
        const conversions = await IngredientConversion.find({
            ingredient_name: { $in: uniqueNames }
        }).lean();

        const conversionMap = conversions.reduce((acc, curr) => {
            acc[curr.ingredient_name] = curr.grams_per_each;
            return acc;
        }, {});

        // 3. Group and sum
        const groups = {};

        for (const item of items) {
            const nameKey = item.name.toLowerCase().trim();
            if (!groups[nameKey]) {
                groups[nameKey] = {
                    name: item.name, // Keep original casing of first item found
                    totalGrams: 0,
                    totalEach: 0,
                    items: [],
                    gramsPerEach: conversionMap[nameKey] || 0,
                    category: item.category
                };
            } else if (!groups[nameKey].category && item.category) {
                groups[nameKey].category = item.category;
            }

            const gramsPerEach = groups[nameKey].gramsPerEach;
            const unit = item.quantity_unit || item.quantity_type || 'each';
            const normalized = normalizeToGrams(unit, item.quantity, gramsPerEach);

            if (normalized.value !== null) {
                groups[nameKey].totalGrams += normalized.value;
                if (gramsPerEach > 0) {
                    groups[nameKey].totalEach += normalized.value / gramsPerEach;
                } else {
                    const canonical = resolveUnitKey(unit);
                    if (canonical === 'each') {
                        groups[nameKey].totalEach += item.quantity;
                    }
                }
            } else {
                // Fallback if normalization to grams fails (e.g., standard conversion unavailable and no factor)
                const canonical = resolveUnitKey(unit);
                if (canonical === 'each') {
                    groups[nameKey].totalEach += item.quantity;
                    if (gramsPerEach > 0) {
                        groups[nameKey].totalGrams += item.quantity * gramsPerEach;
                    }
                }
            }

            groups[nameKey].items.push({
                ...item,
                quantity_type_shorthand: getShorthandForMeasure(unit)
            });
        }

        // 4. Finalize group summaries
        const result = Object.values(groups).map(group => {
            // Calculate percentage for each item using normalized weight
            group.items = group.items.map(item => {
                const unit = item.quantity_unit || item.quantity_type || 'each';
                const normalized = normalizeToGrams(unit, item.quantity, group.gramsPerEach);
                let percentage = 0;

                if (group.totalGrams > 0) {
                    const itemWeight = normalized.value || (resolveUnitKey(unit) === 'each' ? item.quantity * group.gramsPerEach : 0);
                    percentage = (itemWeight / group.totalGrams) * 100;
                } else if (group.totalEach > 0) {
                    const canonical = resolveUnitKey(unit);
                    if (canonical === 'each') {
                        percentage = (item.quantity / group.totalEach) * 100;
                    }
                }

                if (group.items.length === 1) percentage = 100;

                return {
                    ...item,
                    compositionPercentage: percentage.toFixed(1)
                };
            });

            let totalString = "";
            let quantity = 0;
            let quantity_type = "each";
            let quantity_unit = "each";

            if (group.totalGrams > 0) {
                totalString = `${group.totalGrams.toFixed(0)}${getShorthandForMeasure('gram')}`;
                quantity = group.totalGrams;
                quantity_type = "gram";
                quantity_unit = "gram";

                if (group.totalEach > 0 && group.gramsPerEach > 0) {
                    totalString += ` or ${group.totalEach.toFixed(1)} ${group.name}${group.totalEach > 1 ? 's' : ''}`;
                }
            } else if (group.totalEach > 0) {
                totalString = `${group.totalEach.toFixed(1)} ${group.name}${group.totalEach > 1 ? 's' : ''}`;
                quantity = group.totalEach;
                quantity_type = "each";
                quantity_unit = "each";
            }

            if (group.items.length === 1) {
                const singleItem = group.items[0];
                return {
                    ...singleItem,
                    isGroup: false
                };
            }

            return {
                ...group,
                totalString,
                quantity,
                quantity_type,
                quantity_unit,
                isGroup: true,
                _id: `group-${group.name.replace(/\s+/g, '-')}`, // Synthetic ID for the group
                complete: group.items.every(i => i.complete) // Logic: Group is complete only if ALL items are complete
            };
        });

        const finalizedResult = addCalculatedFields(result);

        return res.status(200).json({ success: true, res: finalizedResult });
    } catch (error) {
        console.error("GroupedIngredients API failed:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
