import ShoppingListItem from '../../../models/ShoppingListItem'
import IngredientConversion from '../../../models/IngredientConversion'

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countValuesForKey(listOfObjects, key, disallowedValues) {
    const result = {};

    listOfObjects.forEach(obj => {
        const value = obj[key];

        if (disallowedValues.includes(value) || value === undefined) {
            return;
        }

        if (!(value in result)) {
            result[value] = 1;
        } else {
            result[value]++;
        }
    });

    const countsArray = Object.entries(result).map(([value, count]) => ({ value, count }));
    countsArray.sort((a, b) => b.count - a.count);

    return countsArray;
}

function findCountsForKeys(listOfObjects, keys) {
    const result = {};

    keys.forEach(({ name: key, disallowed }) => {
        const countsArray = countValuesForKey(listOfObjects, key, disallowed);
        result[key] = countsArray;
    });

    return result;
}

export default async function handler(req, res) {
    try {
        let search_term = req.query.search_term;
        if (search_term !== undefined) {
            search_term = search_term.trim().toLowerCase();
        }

        if (req.method === "GET") {
            if (search_term !== undefined && search_term !== "") {
                const escaped = escapeRegex(search_term);

                let ShoppingListItemData = await ShoppingListItem.find({
                    name: { $regex: new RegExp('^' + escaped + '$', 'i') }
                });

                const keysToCheck = [
                    { name: 'category', disallowed: [] },
                    { name: 'name', disallowed: [] },
                    { name: 'quantity_type', disallowed: ['any'] },
                    { name: 'quantity', disallowed: [] },
                ];
                const mostCommonValues = findCountsForKeys(ShoppingListItemData, keysToCheck)

                try {
                    const conversion = await IngredientConversion.findOne({
                        ingredient_name: { $regex: new RegExp('^' + escaped + '$', 'i') }
                    });
                    if (conversion && conversion.category) {
                        if (!mostCommonValues.category.find(c => c.value === conversion.category)) {
                            mostCommonValues.category.unshift({ value: conversion.category, count: 999 });
                        } else {
                            mostCommonValues.category = [
                                { value: conversion.category, count: 999 },
                                ...mostCommonValues.category.filter(c => c.value !== conversion.category)
                            ];
                        }
                    }
                } catch (e) {
                    console.error('Error checking IngredientConversion in options API:', e);
                }

                res.status(200).json({ success: true, data: mostCommonValues })
            } else {
                res.status(400).json({ success: false, data: [], message: "No Search Term" })
            }
        } else {
            res.status(400).json({ success: false, data: [], message: "Not supported request" })
        }
    } catch (e) {
        console.log(e)
        res.status(400).json({ success: false, data: [], message: "Not supported request" })
    }
}






