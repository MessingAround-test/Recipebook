// Functions for converting a string containing a metric reading into a consistent value

export const quantity_unit_conversions = {
    "each": { "synonyms": ["each", "eachs", "x", "pack"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "x" },
    "gram": { "synonyms": ["gram", "grams", "g", "gs"], "type": "weight", "ratio": 1, "ratio_base": "g", "shorthand": "g" },
    "kilogram": { "synonyms": ["kilogram", "kilograms", "kg", "kgs"], "type": "weight", "ratio": 1000, "ratio_base": "g", "shorthand": "kg" },
    "cup": { "synonyms": ["cup", "cups", "c", "cups"], "type": "volume", "ratio": 284.131, "ratio_base": "ml", "shorthand": "cup" },
    "tablespoon": { "synonyms": ["tablespoon", "tablespoons", "tbsp", "tbsps"], "type": "volume", "ratio": 17.7582, "ratio_base": "ml", "shorthand": "tbsp" },
    "teaspoon": { "synonyms": ["teaspoon", "teaspoons", "tsp", "tsps"], "type": "volume", "ratio": 5.91939, "ratio_base": "ml", "shorthand": "tsp" },
    "milliliter": { "synonyms": ["milliliter", "milliliters", "ml", "mls"], "type": "volume", "ratio": 1, "ratio_base": "ml", "shorthand": "ml" },
    "liter": { "synonyms": ["liter", "liters", "l", "liters", "L"], "type": "volume", "ratio": 1000, "ratio_base": "ml", "shorthand": "L" },
    "fluid ounce": { "synonyms": ["fluid ounce", "fluid ounces", "fl oz", "fl ozs"], "type": "volume", "ratio": 28.4131, "ratio_base": "ml", "shorthand": "fl oz" },
    "pint": { "synonyms": ["pint", "pints", "pt", "pts"], "type": "volume", "ratio": 568.261, "ratio_base": "ml", "shorthand": "pt" },
    "quart": { "synonyms": ["quart", "quarts", "qt", "qts"], "type": "volume", "ratio": 1136.52, "ratio_base": "ml", "shorthand": "qt" },
    "gallon": { "synonyms": ["gallon", "gallons", "gal", "gals"], "type": "volume", "ratio": 4546.09, "ratio_base": "ml", "shorthand": "gal" },
    "ounce": { "synonyms": ["ounce", "ounces", "oz", "ozs"], "type": "weight", "ratio": 28.3495, "ratio_base": "g", "shorthand": "oz" },
    "pound": { "synonyms": ["pound", "pounds", "lb", "lbs"], "type": "weight", "ratio": 453.592, "ratio_base": "g", "shorthand": "lb" },
    "pinch": { "synonyms": ["pinch", "pinches"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "pinch" },
    "dash": { "synonyms": ["dash", "dashes"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "dash" },
    "handful": { "synonyms": ["handful", "handfuls"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "handful" },
    "sprinkle": { "synonyms": ["sprinkle", "sprinkles"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "sprinkle" },
    "piece": { "synonyms": ["piece", "pieces"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "piece" },
    "clove": { "synonyms": ["clove", "cloves"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "clove" },
    "can": { "synonyms": ["can", "cans"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "can" },
    "bottle": { "synonyms": ["bottle", "bottles"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "bottle" },
    "package": { "synonyms": ["package", "packages"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "pkg" },
    "stick": { "synonyms": ["stick", "sticks"], "type": "each", "ratio": 1, "ratio_base": "each", "shorthand": "stick" }
};

const category_conversion = {
    'Fresh Produce': 'Fresh Produce',
    'International Foods': 'Staple Food',
    'Bakery': 'Staple Food',
    'Baking Supplies': 'Staple Food',
    'Beverages': 'Staple Food',
    'Canned Goods': 'Staple Food',
    'Cereal and Breakfast Foods': 'Staple Food',
    'Condiments and Sauces': 'Staple Food',
    'Dairy and Eggs': 'Fridge',
    'Deli and Prepared Foods': 'Fridge',
    'Frozen Foods': 'Freezer',
    'Health and Wellness': 'Staple Other',
    'Home and Garden': 'Staple Other',
    'Household and Cleaning': 'Staple Other',
    'Meat and Seafood': 'Fridge',
    'Pasta and Grains': 'Staple Food',
    'Personal Care': 'Staple Other',
    'Snacks': 'Staple Food',
    'undefined': 'undefined'
}

export function getShorthandForMeasure(key) {
    const unit = quantity_unit_conversions[key];
    return unit ? unit.shorthand : key;
}



function extractQuantity(inputText, numberFound) {

    
    if (numberFound.length <= 1) {
        return [Number(numberFound[0])];
    }
    

    switch (true) {
        // 1 x 3 XXXX
        case (/(\d+)x(\d+)/g).test(inputText):
            const multipleItemsTest = (/(\d+)x(\d+)/g).exec(inputText);
            const firstDigit = multipleItemsTest[1];
            const secondDigit = multipleItemsTest[2];
            return [Number(firstDigit) * Number(secondDigit)];
        // 1 2/4 cups XXXX
        case /(\d+)\s+(\d+)\/(\d+)/.test(inputText):
            const mixedNumberTest = inputText.match(/(\d+)\s+(\d+)\/(\d+)/);
            const wholeNumber = mixedNumberTest[1];
            const mixedNumerator = mixedNumberTest[2];
            const mixedDenominator = mixedNumberTest[3];
            return [Number(wholeNumber) + Number(mixedNumerator) / Number(mixedDenominator)];

        // 1 / 3 XXXX
        case /(\d+)\s*\/\s*(\d+)/.test(inputText):
            const fractionTest = inputText.match(/(\d+)\s*\/\s*(\d+)/);
            const numerator = fractionTest[1];
            const denominator = fractionTest[2];
            return [Number(numerator) / Number(denominator)];
        // (2 cups)
        case /\((\d+(\.\d+)?|\d*\.\d+)\s*g\)/i.test(inputText):
            const parenthesesTest = inputText.match(/\((\d+(\.\d+)?|\d*\.\d+)\s*g\)/i);
            return [Number(parenthesesTest[1])];
        default:
            return [Number(numberFound[0])];
    }
}


function extractIngredientName(wordsFound) {
    let fullWord = ""
    for (const index in wordsFound) {
        console.log(wordsFound[index])
        let keyFound = findKeyFromInput(wordsFound[index].toLowerCase(), quantity_unit_conversions, "synonyms");
        if (!keyFound) {
            // No space inbetween if is first word
            fullWord += (fullWord === ""? `${wordsFound[index]}` : ` ${wordsFound[index]}`)
        }
    }
    return fullWord
}


export function convertMetricReading(inputText) {
    // remove bracketed crap
    inputText = inputText.replace(/\s*\([^)]*\)/g, '').trim();

    // Use regex to find the number and the quantity_type which is after it
    let numberFound = inputText.match(/\d+(\.\d+)?|\d*\.\d+/g);
    let wordsFound = inputText.match(/[a-zA-Z]+/g);
    let nameFound = inputText.match(/(\d+)\s*([a-zA-Z]+)?\s*(.*)/);

    if (numberFound == null) {
        console.log("No number found")
        numberFound = [1]
    }
    numberFound = extractQuantity(inputText, numberFound)
    





    // Split on , becuase they add additional descriptions after this... 
    // let ingredName = inputText.trim().split(",")[0] 

    // if (nameFound) {
    //     ingredName = nameFound[3].trim().split(",")[0];
    // }
    console.log(wordsFound)
    let ingredName = extractIngredientName(wordsFound)

    numberFound = convertToTwoDP(Number(numberFound[0]));

    for (const index in wordsFound) {
        console.log(wordsFound[index])
        let keyFound = findKeyFromInput(wordsFound[index].toLowerCase(), quantity_unit_conversions, "synonyms");
        if (keyFound) {
            return { "quantity": numberFound, "quantity_unit": keyFound, "quantity_type": quantity_unit_conversions[keyFound].type, "name": ingredName }
        }
    }

    return { "quantity": numberFound, "quantity_type": "each", "quantity_unit": "each", "name": ingredName }
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


function convertToTwoDP(number){
    return parseFloat(number.toFixed(2));
}

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

function calculateSimpleCategory(category) {
    return category_conversion[category] ? category_conversion[category] : "undefined"
}


export function addCalculatedFields(ingredients) {
    return ingredients.map((ingredient) => ({

        ...ingredient,
        "category_simple": calculateSimpleCategory(ingredient.category)

    }))
}

export function ConvertBetweenSubMeasures(actualMeasure, amount, requestedMeasure) {
    throw "UNIMPLEMENTED"
    for (const index in measureConversions) {
        if (measureConversions[index].small === measure) {
            return measureConversions[index].large;
        }
    }
    return measure;
}
export function convertKitchenMetrics(qType, quantity) {
    // Define conversion factors
    const conversions = {
        'gram': {
            'kilogram': 0.001,
            'cup': 0.00422675,
            'tablespoon': 0.067628,
            'teaspoon': 0.202884,
            'milliliter': 1,
            'liter': 0.001,
            'gram': 1
        },
        'kilogram': {
            'gram': 1000,
            'cup': 4.22675,
            'tablespoon': 67.628,
            'teaspoon': 202.884,
            'milliliter': 1000,
            'liter': 1,
            'kilogram': 1
        },

        'cup': {
            'gram': 236.588,
            'kilogram': 0.236588,
            'cup': 1,
            'tablespoon': 16,
            'teaspoon': 48,
            'milliliter': 236.588,
            'liter': 0.236588
        },
        'tablespoon': {
            'gram': 14.7868,
            'kilogram': 0.0147868,
            'cup': 0.0625,
            'teaspoon': 3,
            'milliliter': 14.7868,
            'liter': 0.0147868,
            'tablespoon': 1
        },
        'teaspoon': {
            'gram': 4.92892,
            'kilogram': 0.00492892,
            'cup': 0.0208333,
            'tablespoon': 0.333333,
            'milliliter': 4.92892,
            'liter': 0.00492892,
            'teaspoon': 1
        },
        'milliliter': {
            'gram': 1,
            'kilogram': 0.001,
            'cup': 0.00422675,
            'tablespoon': 0.067628,
            'teaspoon': 0.202884,
            'liter': 0.001,
            'milliliter': 1
        },
        'liter': {
            'gram': 1000,
            'kilogram': 1,
            'cup': 4.22675,
            'tablespoon': 67.628,
            'teaspoon': 202.884,
            'milliliter': 1000,
            'liter': 1
        }
    };

    // Convert the quantity to all possible units
    if (conversions[qType]) {
        const result = {};
        Object.keys(conversions[qType]).forEach(targetUnit => {
            const conversionFactor = conversions[qType][targetUnit];
            result[targetUnit] = quantity * conversionFactor;
        });
        return result;
    } else {
        return null;
    }
}


export function extractProduct(input) {
    // Convert the input to lowercase for case-insensitive matching
    const lowerInput = input.toLowerCase();

    // Define an extended list of common non-relevant words (stop words)
    const stopWords = [
        'frozen', 'chilled', 'peanut', 'butter', 'organic', 'fresh',
        'canned', 'cooked', 'raw', 'natural', 'gluten-free', 'sugar-free',
        'low-fat', 'high-protein', 'non-GMO', 'whole', 'extra', 'crispy',
        'homemade', 'gourmet', 'premium', 'artisan', 'spicy', 'zesty',
        'roasted', 'grilled', 'sweet', 'savory', 'spiced', 'light', 'dark',
        'free-range', 'lite', 'signature', 'classic', 'traditional', 'healthy',
        'deluxe', 'original', 'tasty', 'supreme', 'select', 'family-sized',
        'authentic', 'handcrafted', 'artisanal', 'farm-fresh', 'small-batch',
        'locally-sourced', 'award-winning', 'chef-inspired', 'seasoned',
        'oven-baked', 'microwaveable', 'convenient', 'ready-to-eat',
        'quick-cooking', 'slow-cooked', 'garden-fresh', 'oven-ready',
        'indulgent', 'decadent', 'wholesome', 'nutrient-rich', 'sustainably-sourced',
        'lightly-salted', 'ultra-premium', 'world-famous', 'mouthwatering',
        'fire-roasted', 'handpicked', 'bold-flavored', 'sizzling', 'hearty',
        'refreshing', 'creamy', 'juicy', 'crunchy', 'tender', 'succulent',
        'garden-to-table', 'superfood', 'probiotic', 'exotic', 'limited-edition',
        'timeless', 'time-tested', 'original-recipe', 'oven-safe', 'grain-free',
        'dairy-free', 'nut-free', 'plant-based', 'artisan-crafted', 'whole-grain',
        'low-carb', 'all-natural', 'farm-raised', 'trendy', 'innovative',
        'one-of-a-kind', 'sensational', 'award-winning', 'premium-quality',
        'blended', 'chopped', 'mixed', 'sliced', 'diced', 'pureed', 'crushed',
        'dried', 'thin', 'thickened', 'thick', 'large', 'small', 'medium', "leaves",
        'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white', 'brown'
    ];

    // Remove stop words from the input
    const filteredInput = lowerInput.split(' ')
        .filter(word => !stopWords.includes(word))
        .join(' ');

    // Extract the remaining words as the expected product
    const expectedProduct = filteredInput.trim();

    return expectedProduct;
}
