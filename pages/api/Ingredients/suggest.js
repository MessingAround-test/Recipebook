import Ingredients from '../../../models/Ingredients'
import IngredientConversion from '../../../models/IngredientConversion'
import SearchLog from '../../../models/SearchLog'
import ShoppingListItem from '../../../models/ShoppingListItem'
import { verifyToken } from '../../../lib/auth';
import dbConnect from '../../../lib/dbConnect';

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Thorough ingredient-name suggestion lookup.
 * Searches every name source in the database (not just the recent ~200 the client
 * keeps locally): IngredientConversion, Ingredients, ShoppingListItem names and
 * successful SearchLog terms.
 *
 * Strategy per source: first require ALL query tokens to appear (most relevant);
 * only if that yields nothing for that source, broaden to ANY token. Results are
 * de-duped, scored by relevance and capped so the payload stays small.
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' })
    }

    const decoded = await verifyToken(req, res);
    if (!decoded) return;
    await dbConnect();

    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (q.length < 2) {
            return res.status(200).json({ success: true, data: [] })
        }

        const tokenStrs = q.split(/\s+/).filter(t => t.length > 0);
        const tokenRegexes = tokenStrs.map(t => new RegExp(escapeRegex(t), 'i'));

        const LIMIT_PER_SOURCE = 8;

        // Each source: how to query it and how to pull the name out
        const sources = [
            { model: IngredientConversion, field: 'ingredient_name', select: 'ingredient_name -_id', isDistinct: false, extra: {} },
            { model: Ingredients, field: 'name', select: 'name -_id', isDistinct: false, extra: {} },
            { model: ShoppingListItem, field: 'name', select: null, isDistinct: true, extra: {} },
            { model: SearchLog, field: 'search_term', select: null, isDistinct: true, extra: { success: true } },
        ];

        async function collectFrom(source) {
            const { model, field, select, isDistinct, extra } = source;

            // Pass 1: all tokens must match
            const andCond = { ...extra, $and: tokenRegexes.map(rx => ({ [field]: rx })) };
            let names = isDistinct
                ? (await model.find(andCond).distinct(field)).slice(0, LIMIT_PER_SOURCE)
                : (await model.find(andCond).select(select).limit(LIMIT_PER_SOURCE).lean())
                    .map(doc => doc[field]);

            // Pass 2: nothing? broaden to any token
            if (names.length === 0) {
                const orCond = { ...extra, [field]: { $in: tokenRegexes } };
                names = isDistinct
                    ? (await model.find(orCond).distinct(field)).slice(0, LIMIT_PER_SOURCE)
                    : (await model.find(orCond).select(select).limit(LIMIT_PER_SOURCE).lean())
                        .map(doc => doc[field]);
            }
            return names;
        }

        const batches = await Promise.all(sources.map(collectFrom));
        const names = batches.flat();

        // De-dupe, score by relevance, cap
        const seen = new Set();
        const scored = [];
        for (const raw of names) {
            const name = String(raw || '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);

            let score = 50; // any-token baseline
            if (key === q) {
                score = 100;
            } else if (key.startsWith(q)) {
                score = 90;
            } else if (new RegExp('(^|[^a-z0-9])' + escapeRegex(q)).test(key)) {
                score = 80;
            } else if (tokenStrs.every(t => new RegExp('(^|[^a-z0-9])' + escapeRegex(t)).test(key))) {
                score = 70;
            } else if (tokenStrs.every(t => key.includes(t))) {
                score = 60;
            }

            scored.push({ name, score });
        }

        scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
        const data = scored.slice(0, 12).map(s => s.name);

        return res.status(200).json({ success: true, data })
    } catch (error) {
        console.error('Error in Ingredients/suggest:', error);
        return res.status(500).json({ success: false, data: [], message: error.message })
    }
}
