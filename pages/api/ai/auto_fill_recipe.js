import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

const VALID_GENRES = [
    'Italian', 'Mexican', 'Asian', 'Indian', 'Mediterranean', 'American',
    'French', 'Middle Eastern', 'Thai', 'Japanese', 'Korean', 'Greek',
    'Chinese', 'Vietnamese', 'Other'
];

const VALID_TIMES = ['short', 'medium', 'long'];
const VALID_MEALS = ['Breakfast', 'Lunch', 'Main', 'Entree', 'Dessert', 'Snack'];

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const recipeName = req.query.recipeName;
        const ingredients = req.query.ingredients;
        const existingMealType = req.query.mealType;

        if (!recipeName) {
            return res.status(400).json({ success: false, message: "Missing recipeName" });
        }

        const messages = [
            {
                role: "system",
                content: `You are a culinary assistant. Given a recipe name and its ingredients, determine:
1. 'time': How long it takes to prepare and cook. Use exactly one of: "short" (under 30 min), "medium" (30-60 min), "long" (over 60 min).
2. 'genre': The cuisine genre. Use exactly one of: ${VALID_GENRES.join(', ')}.
3. 'mealType': The course or meal category. Use exactly one of: ${VALID_MEALS.join(', ')}.
4. 'servings': How many people this recipe typically feeds (as a number).

Output MUST be a single JSON object with keys "time", "genre", "mealType", and "servings". Nothing else.`
            },
            {
                role: "user",
                content: `Recipe: "${recipeName}"${ingredients ? `\nIngredients: ${ingredients}` : ''}${existingMealType ? `\nExisting Meal Type (reference): ${existingMealType}` : ''}`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        const data = JSON.parse(responseText);

        // Validate the returned values
        const result = {};
        if (data.time && VALID_TIMES.includes(data.time)) {
            result.time = data.time;
        }
        if (data.genre && VALID_GENRES.includes(data.genre)) {
            result.genre = data.genre;
        }
        if (data.mealType && VALID_MEALS.includes(data.mealType)) {
            result.mealType = data.mealType;
        }
        if (data.servings && !isNaN(Number(data.servings))) {
            result.servings = Number(data.servings);
        }

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error calling AI for recipe auto-fill:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
