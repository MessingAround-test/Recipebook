// Functions for converting a string containing a metric reading into a consistent value
export function convertMetricReading(inputText) {
    // Use regex to find the number and the quantity_type which is after it
    let numberFound = inputText.match(/\d+/g);
    let wordsFound = inputText.match(/[a-zA-Z]+/g);

    const quantity_type_conversions = {
        "teaspoon": ["teaspoon", "teaspoons", "tsp", "tsps"],
        "tablespoon": ["tablespoon", "tablespoons", "tbsp", "tbsps"],
        "fluid ounce": ["fluid ounce", "fluid ounces", "fl oz", "fl ozs"],
        "cup": ["cup", "cups", "c", "cups"],
        "pint": ["pint", "pints", "pt", "pts"],
        "quart": ["quart", "quarts", "qt", "qts"],
        "gallon": ["gallon", "gallons", "gal", "gals"],
        "milliliter": ["milliliter", "milliliters", "ml", "mls"],
        "liter": ["liter", "liters", "l", "liters"],
        "ounce": ["ounce", "ounces", "oz", "ozs"],
        "pound": ["pound", "pounds", "lb", "lbs"],
        "gram": ["gram", "grams", "g", "gs"],
        "kilogram": ["kilogram", "kilograms", "kg", "kgs"],
        "pinch": ["pinch", "pinches"],
        "dash": ["dash", "dashes"],
        "handful": ["handful", "handfuls"],
        "sprinkle": ["sprinkle", "sprinkles"],
        "slice": ["slice", "slices"],
        "piece": ["piece", "pieces"],
        "clove": ["clove", "cloves"],
        "can": ["can", "cans"],
        "bottle": ["bottle", "bottles"],
        "package": ["package", "packages"],
        "stick": ["stick", "sticks"]
    }

    if (numberFound == null) {
        console.log("No number found")
        numberFound = [1]
    }

    if (numberFound.length > 1) {
        let multipleItemsTest = (/(\d+)x(\d+)/g).exec(inputText);
        // If we get something in the format 4x400ml drink, itll extract correctly
        if (multipleItemsTest.length > 0) {
            const firstDigit = multipleItemsTest[1];
            const secondDigit = multipleItemsTest[2];
            numberFound = [Number(firstDigit) * Number(secondDigit)]
        } else {

            numberFound = [numberFound[0]]
        }


    }


    numberFound = Number(numberFound[0]);

    for (const index in wordsFound) {
        console.log(wordsFound[index])
        let keyFound = findKeyFromInput(wordsFound[index].toLowerCase(), quantity_type_conversions);
        if (keyFound) {
            return { "quantity": numberFound, "quantity_type": keyFound }
        }
    }

    return { "quantity": numberFound, "quantity_type": "each" }
}

function findKeyFromInput(input, dictionary) {
    for (const key in dictionary) {
        if (dictionary[key].includes(input)) {
            return key;
        }
    }
    return null;
}
// console.log(convertMetricReading("Brushed Potato Prepack 2kg"))