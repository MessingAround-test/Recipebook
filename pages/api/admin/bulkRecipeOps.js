import dbConnect from '../../../lib/dbConnect';
import Recipe from '../../../models/Recipe';
import User from '../../../models/User';
import { verifyToken } from '../../../lib/auth';
import { logAPI } from '../../../lib/logger';
import { callGroqChat, generatePollinationsImage, generateGeminiImage } from '../../../lib/ai';
import { saveRecipeImages } from '../../../lib/recipeImageServer';
import { normalizeExtractedIngredients, normalizePrepWords } from '../../../lib/recipeNormalize';
import { quantity_unit_conversions } from '../../../lib/conversion';
import { analyzeCarbSideForRecipe } from '../../../lib/carbSideServer';
import {
    buildPrepWorkMessages,
    buildTimerMessages,
    parsePrepWorkResult,
    parseTimerResult,
    parseAiJson,
    dedupePrepAgainstInstructions,
    formatIngredientsWithNotes,
    applyInstructionTimes,
    computePrepNotesHash
} from '../../../lib/aiRecipeOps';

const toAmount = (val) => {
    if (val == null) return 1;
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val).trim());
    return isNaN(n) ? 1 : n;
};

/** Runs one bulk operation on a single recipe. Ops:
 *  - "normalize": resolve units + move prep words from ingredient names into notes
 *  - "prep": extract prep work steps via AI (merges with custom items)
 *  - "timers": extract cooking timers via AI
 *  - "carbside": run the carb side-dish analysis (AI + timing math)
 *  - "image": generate recipe art via Pollinations anonymous tier (Gemini fallback) */
async function runOp(recipe, op) {
    if (op === 'normalize') {
        const editorShape = recipe.ingredients.map(i => ({
            Name: i.Name,
            Amount: i.Amount,
            AmountType: i.AmountType,
            Note: i.note
        }));
        const normalized = normalizePrepWords(normalizeExtractedIngredients(editorShape));
        const dbShape = normalized.map(ing => ({
            Name: ing.Name,
            Amount: toAmount(ing.Amount),
            AmountType: quantity_unit_conversions[ing.AmountType] != null ? ing.AmountType : 'each',
            note: String(ing.Note || '').trim() || undefined
        }));
        recipe.ingredients = dbShape;
        await recipe.save();
        return { message: `Normalized ${dbShape.length} ingredients` };
    }

    if (op === 'prep') {
        const ingredientsStr = formatIngredientsWithNotes(recipe.ingredients || []);
        const instructionsStr = (recipe.instructions || []).map(i => i.Text).join('; ');
        const messages = buildPrepWorkMessages(recipe.name, ingredientsStr, instructionsStr);
        const responseText = await callGroqChat(messages, true);
        const parsed = parsePrepWorkResult(parseAiJson(responseText));

        let aiItems = parsed.prepWork || [];
        aiItems = dedupePrepAgainstInstructions(aiItems, recipe.instructions || []);

        // Preserve manually added custom items
        const customItems = (recipe.prepWork || []).filter(p => p.isCustom);
        const merged = [...aiItems, ...customItems];
        for (const item of merged) {
            if (typeof item.timeEstimate !== 'number') item.timeEstimate = null;
        }

        const update = {
            prepWork: merged,
            prepWorkChecked: true,
            prepWorkNotesHash: computePrepNotesHash(recipe.ingredients || [])
        };
        if (Array.isArray(parsed.instructionTimes) && parsed.instructionTimes.length > 0) {
            update.instructions = applyInstructionTimes(recipe.instructions || [], parsed.instructionTimes);
        }
        await Recipe.updateOne({ _id: recipe._id }, { $set: update });
        return { message: `Extracted ${aiItems.length} prep steps`, prepCount: merged.length };
    }

    if (op === 'timers') {
        const ingredNames = (recipe.ingredients || []).map(i => i.Name).join(', ');
        const instrText = (recipe.instructions || []).map((i, idx) =>
            `${idx + 1}. ${i.Text}${i.time ? ` (${i.time} min)` : ''}`
        ).join('\n');
        const messages = buildTimerMessages(recipe.name, ingredNames, instrText);
        const responseText = await callGroqChat(messages, true);
        const parsed = parseTimerResult(parseAiJson(responseText));

        const newTimers = parsed.timers || [];
        const existing = recipe.cookingTimers || [];
        // Never overwrite curated timers with an empty result
        if (existing.length > 0 && newTimers.length === 0) {
            throw new Error('AI returned no timers for an existing timer plan — skipped');
        }

        const update = { cookingTimers: newTimers, timersChecked: true };
        if (Array.isArray(parsed.instructionTimes) && parsed.instructionTimes.length > 0) {
            update.instructions = applyInstructionTimes(recipe.instructions || [], parsed.instructionTimes);
        }
        await Recipe.updateOne({ _id: recipe._id }, { $set: update });
        return { message: `Saved ${newTimers.length} timers`, timerCount: newTimers.length };
    }

    if (op === 'carbside') {
        const result = await analyzeCarbSideForRecipe(recipe, { force: false });
        if (result.skipped) {
            return { message: recipe.carbSide?.analysis?.alreadyInInstructions
                ? 'Already analyzed — carb step exists in the recipe'
                : 'Already analyzed', alreadyIn: recipe.carbSide?.analysis?.alreadyInInstructions === true };
        }
        const alreadyIn = result.carbSide.analysis?.alreadyInInstructions === true;
        const needs = result.carbSide.needs === true;
        return { message: alreadyIn ? 'Analyzed — carb already in recipe steps' : needs ? 'Analyzed — needs a carb side' : 'Analyzed — no carb side needed', alreadyIn };
    }

    if (op === 'image') {
        const promptMessages = [
            {
                role: "system",
                content: `You are an expert at crafting prompts for AI image generation.
Your goal: a CLEAN, REALISTIC food photo of the dish named by the user.

Rules:
1. Output ONE short sentence (15 words or fewer) describing the finished dish, plated simply.
2. Style must be photorealistic food photography. NEVER describe illustrations, watercolour, sketches or paper textures.
3. Keep the composition simple: plain background, natural light. No props, no people, no text.
4. Only mention ingredients that would actually be visible in the finished dish.
5. Output ONLY the prompt string.`
            },
            { role: "user", content: `Create a realistic food photo prompt for: ${recipe.name}` }
        ];
        const promptText = await callGroqChat(promptMessages, false);
        const prompt = promptText.trim().replace(/^"|"$/g, '');

        let image;
        try {
            image = await generatePollinationsImage(prompt);
        } catch (pollinationsError) {
            console.error(`Pollinations image failed for ${recipe.name}, trying Gemini:`, pollinationsError);
            image = await generateGeminiImage(prompt);
        }
        await saveRecipeImages(recipe._id, image);
        return { message: 'Generated recipe image' };
    }

    throw new Error(`Unsupported op: ${op}`);
}

export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    await dbConnect();

    const userData = await User.findById(decoded.id);
    if (!userData || userData.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    try {
        if (req.method === 'GET') {
            const recipes = await Recipe.aggregate([
                { $project: {
                    name: 1,
                    ingredCount: { $size: { $ifNull: ['$ingredients', []] } },
                    prepCount: { $size: { $ifNull: ['$prepWork', []] } },
                    prepChecked: '$prepWorkChecked',
                    timerCount: { $size: { $ifNull: ['$cookingTimers', []] } },
                    timersChecked: '$timersChecked',
                    carbExists: { $gt: ['$carbSide.state', null] },
                    carbNeeds: '$carbSide.needs',
                    carbState: '$carbSide.state',
                    carbAlreadyIn: '$carbSide.analysis.alreadyInInstructions',
                    image: '$hasImage'
                } },
                { $sort: { name: 1 } }
            ]);
            return res.status(200).json({ success: true, data: recipes });
        }

        if (req.method === 'POST') {
            const { recipeId, op } = req.body || {};
            if (!recipeId || !op) {
                return res.status(400).json({ success: false, message: 'Missing recipeId or op' });
            }
            if (!['normalize', 'prep', 'timers', 'carbside', 'image'].includes(op)) {
                return res.status(400).json({ success: false, message: `Unsupported op: ${op}` });
            }

            const recipe = await Recipe.findOne({ _id: recipeId });
            if (!recipe) {
                return res.status(404).json({ success: false, message: 'Recipe not found' });
            }

            const result = await runOp(recipe, op);
            const fresh = await Recipe.findOne({ _id: recipeId }).select('prepWorkChecked cookingTimers ingredients prepWork hasImage carbSide').lean();
            return res.status(200).json({
                success: true,
                message: result.message,
                hasPrep: (fresh.prepWork || []).length > 0 || fresh.prepWorkChecked === true,
                hasTimers: (fresh.cookingTimers || []).length > 0 || fresh.timersChecked === true,
                hasCarb: fresh.carbSide?.state === 'analyzed',
                hasImage: Boolean(fresh.hasImage)
            });
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    } catch (err) {
        console.error('bulkRecipeOps error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}
