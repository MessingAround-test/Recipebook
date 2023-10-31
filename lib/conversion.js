// Functions for converting a string containing a metric reading into a consistent value

export const quantity_unit_conversions = {
    "each": { "synonyms": ["each", "eachs", "x"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "teaspoon": { "synonyms": ["teaspoon", "teaspoons", "tsp", "tsps"], "type": "volume", "ratio": 5.91939, "ratio_base": "ml" },
    "tablespoon": { "synonyms": ["tablespoon", "tablespoons", "tbsp", "tbsps"], "type": "volume", "ratio": 17.7582, "ratio_base": "ml" },
    "fluid ounce": { "synonyms": ["fluid ounce", "fluid ounces", "fl oz", "fl ozs"], "type": "volume", "ratio": 28.4131, "ratio_base": "ml" },
    "cup": { "synonyms": ["cup", "cups", "c", "cups"], "type": "volume", "ratio": 284.131, "ratio_base": "ml" },
    "pint": { "synonyms": ["pint", "pints", "pt", "pts"], "type": "volume", "ratio": 568.261, "ratio_base": "ml" },
    "quart": { "synonyms": ["quart", "quarts", "qt", "qts"], "type": "volume", "ratio": 1136.52, "ratio_base": "ml" },
    "gallon": { "synonyms": ["gallon", "gallons", "gal", "gals"], "type": "volume", "ratio": 4546.09, "ratio_base": "ml" },
    "milliliter": { "synonyms": ["milliliter", "milliliters", "ml", "mls"], "type": "volume", "ratio": 1, "ratio_base": "ml" },
    "liter": { "synonyms": ["liter", "liters", "l", "liters", "L"], "type": "volume", "ratio": 1000, "ratio_base": "ml" },
    "ounce": { "synonyms": ["ounce", "ounces", "oz", "ozs"], "type": "weight", "ratio": 28.3495, "ratio_base": "g" },
    "pound": { "synonyms": ["pound", "pounds", "lb", "lbs"], "type": "weight", "ratio": 453.592, "ratio_base": "g" },
    "gram": { "synonyms": ["gram", "grams", "g", "gs"], "type": "weight", "ratio": 1, "ratio_base": "g" },
    "kilogram": { "synonyms": ["kilogram", "kilograms", "kg", "kgs"], "type": "weight", "ratio": 1000, "ratio_base": "g" },
    "pinch": { "synonyms": ["pinch", "pinches"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "dash": { "synonyms": ["dash", "dashes"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "handful": { "synonyms": ["handful", "handfuls"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "sprinkle": { "synonyms": ["sprinkle", "sprinkles"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "slice": { "synonyms": ["slice", "slices"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "piece": { "synonyms": ["piece", "pieces"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "clove": { "synonyms": ["clove", "cloves"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "can": { "synonyms": ["can", "cans"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "bottle": { "synonyms": ["bottle", "bottles"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "package": { "synonyms": ["package", "packages"], "type": "each", "ratio": 1, "ratio_base": "each" },
    "stick": { "synonyms": ["stick", "sticks"], "type": "each", "ratio": 1, "ratio_base": "each" }
}



export function convertMetricReading(inputText) {
    // Use regex to find the number and the quantity_type which is after it
    let numberFound = inputText.match(/\d+/g);
    let wordsFound = inputText.match(/[a-zA-Z]+/g);
    let nameFound = inputText.match(/(\d+)\s*([a-zA-Z]+)?\s*(.*)/);


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

    // Split on , becuase they add additional descriptions after this... 
    let ingredName = inputText.trim().split(",")[0]
    if (nameFound){
        ingredName = nameFound[3].trim().split(",")[0];
    }

    numberFound = Number(numberFound[0]);

    for (const index in wordsFound) {
        console.log(wordsFound[index])
        let keyFound = findKeyFromInput(wordsFound[index].toLowerCase(), quantity_unit_conversions, "synonyms");
        if (keyFound) {
            return { "quantity": numberFound, "quantity_unit": keyFound, "quantity_type": quantity_unit_conversions[keyFound].type, "name": ingredName }
        }
    }

    return { "quantity": numberFound, "quantity_type": "each", "quantity_unit": "each", "name": ingredName}
}

function findKeyFromInput(input, dictionary, dictKey) {
    for (const key in dictionary) {
        if (dictionary[key][dictKey].includes(input)) {
            return key;
        }
    }
    return null;
}
// console.log(convertMetricReading("Brushed Potato Prepack 2kg"))


const measureConversions = [
    {
        "small": "g",
        "large": "kg",
        "multiplier": 1000
    },
    {
        "small": "ml",
        "large": "l",
        "multiplier": 1000
    }
]



export function ConvertBetweenSubMeasures(actualMeasure, amount, requestedMeasure) {
    throw "UNIMPLEMENTED"
    for (const index in measureConversions) {
        if (measureConversions[index].small === measure) {
            return measureConversions[index].large;
        }
    }
    return measure;
}