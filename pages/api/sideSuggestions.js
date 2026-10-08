import dbConnect from '../../lib/dbConnect';
import Recipe from '../../models/Recipe';
import SidePairing from '../../models/SidePairing';
import { verifyToken } from '../../lib/auth';
import { logAPI } from '../../lib/logger';
import { heuristicServeTemp } from '../../lib/serveTempServer';

/** Side-dish suggestions for Start Cooking (GET ?recipeId=<main id>).
 *  Ranked: liked pairing history for this main > usable-as-side recipes that
 *  share the main's meal types > rating/timesCooked. The first card is the
 *  sheet's "Recommended". Serving temperature is filled from the recipe, the
 *  stored AI/heuristic analysis, or a keyword fallback. */
export default async function handler(req, res) {
    logAPI(req);
    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const recipeId = typeof req.query.recipeId === 'string' ? req.query.recipeId : '';
    if (!recipeId) return res.status(400).json({ success: false, message: 'Missing recipeId' });

    try {
        await dbConnect();
        const main = await Recipe.findById(recipeId).lean();
        if (!main) return res.status(404).json({ success: false, message: 'Recipe not found' });

        const userData = await (await import('../../models/User')).default.findById(decoded.id).lean();
        if (!userData) return res.status(400).json({ success: false, message: 'user not found, please relog' });
        if (decoded.role !== 'admin' && main.creator_email !== userData.email) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this recipe' });
        }

        const [both, pairings] = await Promise.all([
            Recipe.find({
                creator_email: decoded.role !== 'admin' ? userData.email : main.creator_email,
                usableAsSide: true,
                hidden: { $ne: true },
                _id: { $ne: main._id }
            }).lean(),
            SidePairing.find({ userId: decoded.id, mainRecipeId: String(main._id) }).lean()
        ]);

        const pairingBySide = new Map();
        for (const p of pairings) pairingBySide.set(String(p.sideRecipeId), p);

        const mainMeal = new Set((main.mealTypes || []).map(t => String(t).toLowerCase()));

        const rankOf = (r) => {
            const pairing = pairingBySide.get(String(r._id)) || null;
            const mealOverlap = (r.mealTypes || []).filter(t => mainMeal.has(String(t).toLowerCase())).length;
            const fresh = pairing?.liked ? 1000 : pairing ? 0 : 200; // never-used beats disliked
            const known = (mainMeal.size > 0 || mealOverlap > 0) ? mealOverlap * 10 : 0;
            const quality = (r.rating || 0) * 2 + (r.timesCooked || 0);
            return fresh + known + quality;
        };

        const sides = both
            .map(r => {
                const pairing = pairingBySide.get(String(r._id));
                const effectiveTemp = r.serveTemp || heuristicServeTemp(r).serveTemp;
                return {
                    _id: String(r._id),
                    name: r.name,
                    time: r.time || '',
                    image: r.hasImage || r.image
                        ? `/api/Recipe/${String(r._id)}/image?q=thumb&v=${r.imageVersion ?? 0}`
                        : undefined,
                    servings: r.servings || 0,
                    sideCategory: r.sideCategory || 'other',
                    serveTemp: effectiveTemp,
                    serveTempSource: r.serveTempSource || (r.serveTemp ? undefined : 'heuristic'),
                    reheatMinutes: effectiveTemp === 'reheatable'
                        ? (r.reheatMinutes > 0 ? r.reheatMinutes : 5)
                        : 0,
                    steps: (r.instructions || []).map((i, idx) => ({
                        index: idx, Text: i.Text, time: i.time ?? null, involvement: i.involvement || undefined
                    })),
                    prepWork: (r.prepWork || []).map(p => ({
                        action: p.action, timeEstimate: p.timeEstimate ?? null, optional: !!p.optional
                    })),
                    ingredients: (r.ingredients || []).map(i => ({
                        name: i.Name, quantity: i.Amount, quantity_type: i.AmountType
                    })),
                    timers: (r.cookingTimers || []).map(t => ({
                        name: t.name, duration: t.duration, stepIndex: t.stepIndex, involvement: t.involvement
                    })),
                    rating: r.rating || 0,
                    timesCooked: r.timesCooked || 0,
                    pairing: pairing ? { liked: pairing.liked, timesUsed: pairing.timesUsed || 1 } : null
                }
            })
            .sort((a, b) => rankOf(b) - rankOf(a));

        return res.status(200).json({ success: true, data: sides });
    } catch (error) {
        console.error('sideSuggestions error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Internal error' });
    }
}
