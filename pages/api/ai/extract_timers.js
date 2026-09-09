import { verifyToken } from "../../../lib/auth";
import { logAPI } from '../../../lib/logger'
import { callGroqChat } from '../../../lib/ai';

export default async function handler(req, res) {
    logAPI(req)
    const decoded = await verifyToken(req, res);
    if (!decoded) return;

    try {
        const recipeName = req.query.recipeName;
        const ingredients = req.query.ingredients;
        const instructions = req.query.instructions;

        if (!recipeName) {
            return res.status(400).json({ success: false, message: "Missing recipeName" });
        }

        const messages = [
            {
                role: "system",
                content: `You are a culinary timer assistant. Given a recipe name, its ingredients, and the cooking instructions (with time estimates), analyze and create a cooking timer plan.

Your job is to create a minimal, high-signal timer plan: only steps where a timer genuinely helps the cook stay on track. Timers that restate what the cook is already watching are noise.

RULES:
1. Create a timer (type: "timer") ONLY for steps with a passive, unattended waiting period (baking, roasting, boiling, simmering, resting, marinating, proofing, chilling, steeping) whose duration is explicitly stated in the instruction text (e.g., "bake for 40 min", "simmer 20 minutes") AND is about 5 minutes or longer. Stated durations under about 5 minutes never get timers (e.g., "steam milk for 3 min", "sizzle for 30 seconds").
2. Exception to requiring a stated duration: if a passive wait has NO stated duration but is clearly long (about 15 minutes or more, e.g., "chill until set", "proof until doubled", "marinate overnight"), create a timer using your best estimate. Otherwise, never invent a duration to justify a timer.
3. Hands-on/attended steps NEVER get timers, even when a time is stated (e.g., "stir-fry for 2 minutes", "sauté for 5 min, stirring") - the cook is already watching them.
4. Steps with no meaningful duration (e.g., "heat the oil", "season to taste", "garnish") and steps driven by equipment that signals its own completion (espresso machine, steam wand, kettle, rice cooker, blender) never get timers.
5. Use "start" as the timerId for timers that begin at the start of cooking.
6. For sequential steps (e.g., "then roast cauliflower"), the later timer depends on the previous timer with offset 0.
7. For overlapping steps (e.g., "when potatoes have 15 min remaining, start rice"), the later timer depends on the earlier timer with a NEGATIVE offset (e.g., -15).
8. For multi-stage steps (e.g., "bake for 40 min, check at 20 min"), create a checkpoint (type: "checkpoint") that depends on the parent timer with offset equal to the checkpoint minute. The checkpoint has duration: 0 and parentTimerId set to the parent timer's ID.
9. For steps that depend on multiple conditions being met (e.g., "when both X and Y are done"), create a sync timer (duration: 0) with multiple dependencies.
10. Each timer/checkpoint gets a unique ID: "timer-1", "timer-2", etc. for timers, "ckpt-1", "ckpt-2", etc. for checkpoints.
11. Link each timer to its instruction step via stepIndex (1-indexed matching instruction order).
12. Calculate dependencies based on the CUMULATIVE time of preceding steps. If step 1 takes 10 min and step 2 takes 15 min, step 3 starts at offset 25 from start.

OUTPUT FORMAT:
Return a JSON object with:
- "timers": array of timer/checkpoint objects
- "instructionTimes": array of { step, timeEstimate } for updating step times

Each timer object:
{
  "id": "timer-1",
  "type": "timer",
  "name": "Bake Potatoes",
  "duration": 40,
  "dependencies": [{"timerId": "start", "offset": 0}],
  "stepIndex": 1,
  "notes": ""
}

Each checkpoint object:
{
  "id": "ckpt-1",
  "type": "checkpoint",
  "name": "Check potatoes",
  "duration": 0,
  "dependencies": [{"timerId": "timer-1", "offset": 20}],
  "parentTimerId": "timer-1",
  "stepIndex": 1,
  "notes": ""
}

EXAMPLES:

Example 1 - Simple sequential:
Instructions: "1. Bake potatoes for 40 min. 2. While potatoes bake, cook rice for 15 min."
→ timer-1: bake potatoes, duration 40, deps: [{timerId: "start", offset: 0}]
→ timer-2: cook rice, duration 15, deps: [{timerId: "start", offset: 0}] (parallel, both start at beginning)

Example 2 - Dependency with offset:
Instructions: "1. Cook potatoes for 60 min. 2. When 15 min remaining, start cooking rice for 15 min."
→ timer-1: cook potatoes, duration 60, deps: [{timerId: "start", offset: 0}]
→ timer-2: cook rice, duration 15, deps: [{timerId: "timer-1", offset: -15}]

Example 3 - Queue:
Instructions: "1. Roast potatoes for 60 min. 2. Then roast cauliflower for 30 min. 3. Then roast garlic for 20 min."
→ timer-1: roast potatoes, duration 60, deps: [{timerId: "start", offset: 0}]
→ timer-2: roast cauliflower, duration 30, deps: [{timerId: "timer-1", offset: 0}]
→ timer-3: roast garlic, duration 20, deps: [{timerId: "timer-2", offset: 0}]

Example 4 - Multi-stage with checkpoint:
Instructions: "Bake for 40 min, checking at 20 min."
→ timer-1: bake, duration 40, deps: [{timerId: "start", offset: 0}]
→ ckpt-1: check, type checkpoint, duration 0, deps: [{timerId: "timer-1", offset: 20}], parentTimerId: "timer-1"

Example 5 - Depend on checkpoint:
Instructions: "1. Bake potatoes for 40 min, checking at 20 min. 2. When you check the potatoes, start the rice."
→ timer-1: bake potatoes, duration 40, deps: [{timerId: "start", offset: 0}]
→ ckpt-1: check potatoes, type checkpoint, duration 0, deps: [{timerId: "timer-1", offset: 20}], parentTimerId: "timer-1"
→ timer-2: cook rice, duration 15, deps: [{timerId: "ckpt-1", offset: 0}]

Example 6 - When NOT to create timers:
Instructions: "1. Heat oil in a skillet. 2. Season the steak. 3. Rest the steak for 5 min."
→ timer-1: rest steak, duration 5, deps: [{timerId: "start", offset: 0}] (step 3 qualifies: passive, stated duration at the 5-min floor; steps 1-2 have no meaningful duration - no timers)

Example 7 - Short/hands-on/equipment-driven steps:
Instructions: "1. Pull espresso (2 min). 2. Steam oat milk (3 min). 3. Combine and serve."
→ (no timers - steps 1-2 are short, hands-on, equipment-driven; step 3 has no duration)

Be selective. A short plan of timers that matter is better than a noisy one. When in doubt, omit the timer. Never invent durations for timer purposes. A recipe with zero timers is a valid result. Use negative offsets for "start X min before Y completes". Use offset 0 for "start when Y completes".`
            },
            {
                role: "user",
                content: `Recipe: "${recipeName}"${ingredients ? `\nIngredients: ${ingredients}` : ''}${instructions ? `\nInstructions: ${instructions}` : ''}`
            }
        ];

        const responseText = await callGroqChat(messages, true);
        const data = JSON.parse(responseText);

        const result = {};

        if (Array.isArray(data.timers)) {
            result.timers = data.timers
                .filter(item => item && item.name && typeof item.name === 'string')
                .map(item => ({
                    id: item.id || `timer-${Math.random().toString(36).slice(2, 8)}`,
                    type: item.type === 'checkpoint' ? 'checkpoint' : 'timer',
                    name: item.name,
                    duration: typeof item.duration === 'number' ? Math.max(0, Math.round(item.duration)) : 0,
                    dependencies: Array.isArray(item.dependencies)
                        ? item.dependencies.map(d => ({
                            timerId: d.timerId || 'start',
                            offset: typeof d.offset === 'number' ? d.offset : 0
                        }))
                        : [{ timerId: 'start', offset: 0 }],
                    parentTimerId: item.parentTimerId || undefined,
                    order: typeof item.order === 'number' ? item.order : 0,
                    stepIndex: typeof item.stepIndex === 'number' ? Math.max(0, item.stepIndex - 1) : undefined,
                    notes: item.notes || ''
                }));
        }

        if (Array.isArray(data.instructionTimes)) {
            result.instructionTimes = data.instructionTimes
                .filter(item => item && typeof item.step === 'number' && typeof item.timeEstimate === 'number')
                .map(item => ({
                    step: item.step,
                    timeEstimate: Math.max(1, Math.round(item.timeEstimate))
                }));
        }

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("Error calling AI for timer extraction:", error);
        return res.status(500).json({ success: false, message: "Error processing request" });
    }
}
