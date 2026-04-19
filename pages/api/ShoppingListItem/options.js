import ShoppingListItem from '../../../models/ShoppingListItem'
import IngredientConversion from '../../../models/IngredientConversion'
// Function to count occurrences of values for a specific key in the list of objects

function countValuesForKey(listOfObjects, key, disallowedValues) {
    const result = {};
  
    listOfObjects.forEach(obj => {
      const value = obj[key];
  
      // Skip if the value is in the disallowed values list
      if (disallowedValues.includes(value) ||  value === undefined ) {
        return;
      }
  
      if (!(value in result)) {
        result[value] = 1;
      } else {
        result[value]++;
      }
    });
  
    // Convert the result object to an array of objects for sorting
    const countsArray = Object.entries(result).map(([value, count]) => ({ value, count }));
  
    // Sort the array by count in descending order
    countsArray.sort((a, b) => b.count - a.count);
  
    return countsArray;
  }
  
  // Main function to find counts for specified keys
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
        
        let search_term = req.query.search_term
        if (search_term !== undefined) {
            search_term = search_term.toLowerCase()
        }
        
        if (req.method === "GET") {
            if (search_term !== undefined) {
                let ShoppingListItemData = await ShoppingListItem.find({ name: search_term });
                

                const keysToCheck = [
                    { name: 'category', disallowed: [] },
                    { name: 'name', disallowed: [] },
                    { name: 'quantity_type', disallowed: ['any'] },
                    { name: 'quantity', disallowed: [] },
                  ];
                const mostCommonValues = findCountsForKeys(ShoppingListItemData, keysToCheck)

                // 2. Check IngredientConversion for an explicit preference
                try {
                    const conversion = await IngredientConversion.findOne({ ingredient_name: search_term });
                    if (conversion && conversion.category) {
                        // Prepend or prioritize the saved category if it's not already the most common
                        if (!mostCommonValues.category.find(c => c.value === conversion.category)) {
                            mostCommonValues.category.unshift({ value: conversion.category, count: 999 });
                        } else {
                            // If it exists, move it to the top
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







