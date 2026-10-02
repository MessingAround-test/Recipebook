jest.mock('../lib/dbConnect', () => jest.fn(() => Promise.resolve()));
jest.mock('../models/SiteHtmlIndex', () => ({ findOne: jest.fn(), deleteMany: jest.fn(), create: jest.fn() }));
jest.mock('../models/SiteScrapeRule', () => ({ findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/ScrapeLog', () => ({ create: jest.fn() }));

const { extractJsonLd } = require('../lib/recipeScrape/index.ts');
const { findGiantInstructionIndexes, applyStepSplits, buildSplitGiantStepsMessages, parseSplitGiantStepsResult, parseSplitInstructionsResult, parseAiJson } = require('../lib/aiRecipeOps');

const ldHtml = (recipe) => `<html><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>`;

describe('extractJsonLd HowToSection flattening', () => {
    const recipe = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Croissants',
        recipeIngredient: ['500 g flour', '250 ml milk'],
        recipeInstructions: [
            {
                '@type': 'HowToSection',
                name: 'Detrempe (click here to see the image)',
                itemListElement: [
                    { '@type': 'HowToStep', text: 'Dissolve the honey in the milk.' },
                    { '@type': 'HowToStep', text: 'Add the rest of the ingredients and mix.' }
                ]
            },
            {
                '@type': 'HowToSection',
                name: 'Tourrage (butter block)',
                itemListElement: [
                    { '@type': 'HowToStep', text: 'Shape the butter into a square.' }
                ]
            },
            { '@type': 'HowToStep', text: 'Bake until golden.' },
            'Whisk the egg and brush on top.'
        ]
    };

    it('splits HowToSection steps into individual instructions', () => {
        const result = extractJsonLd(ldHtml(recipe));
        expect(result).not.toBeNull();
        expect(result.instructions).toHaveLength(5);
        expect(result.instructions.map(i => i.instruction)).toEqual([
            'Dissolve the honey in the milk.',
            'Add the rest of the ingredients and mix.',
            'Shape the butter into a square.',
            'Bake until golden.',
            'Whisk the egg and brush on top.'
        ]);
        expect(result.instructions.map(i => i.stepNumber)).toEqual([1, 2, 3, 4, 5]);
    });

    it('attaches cleaned section names to section steps only', () => {
        const result = extractJsonLd(ldHtml(recipe));
        expect(result.instructions[0].sectionName).toBe('Detrempe');
        expect(result.instructions[1].sectionName).toBe('Detrempe');
        expect(result.instructions[2].sectionName).toBe('Tourrage (butter block)');
        expect(result.instructions[3].sectionName).toBeUndefined();
        expect(result.instructions[4].sectionName).toBeUndefined();
    });

    it('keeps plain string instructions working', () => {
        const result = extractJsonLd(ldHtml({
            '@type': 'Recipe',
            name: 'Toast',
            recipeIngredient: ['bread'],
            recipeInstructions: ['Toast the bread.', 'Eat it.']
        }));
        expect(result.instructions).toHaveLength(2);
        expect(result.instructions[0].sectionName).toBeUndefined();
    });

    it('joins nested itemListElement of a plain step, but splits section steps', () => {
        // A HowToSection whose steps are plain strings
        const result = extractJsonLd(ldHtml({
            '@type': 'Recipe',
            name: 'X',
            recipeIngredient: ['apple'],
            recipeInstructions: [
                { '@type': 'HowToSection', name: 'Phase', itemListElement: ['do one thing carefully', 'do two things quickly'] }
            ]
        }));
        expect(result.instructions.map(i => i.instruction)).toEqual(['do one thing carefully', 'do two things quickly']);
    });
});

describe('findGiantInstructionIndexes', () => {
    it('flags only true monster blocks (600+ chars, 5+ sentences)', () => {
        const giant = 'Shape the dough into a rough rectangle and cover it loosely with plastic wrap before proceeding with the next stage. '
            + 'Chill the dough for twenty minutes before opening up the folds and giving the lamination another gentle press. '
            + 'Turn the dough out onto a well-floured surface and knock back the air firmly with the heel of your hand. '
            + 'Cut the dough in half and return one half to the fridge until you are ready to work with it again. '
            + 'Roll the remaining half out to a large, thin rectangle on the sheet of parchment paper you prepared earlier. '
            + 'Transfer the parchment with the dough onto a baking tray and place it directly in the freezer. '
            + 'Freeze the shaped dough completely and completely solid before you use it for the lamination process later.';
        expect(giant.length).toBeGreaterThanOrEqual(600);
        const instructions = [
            { instruction: 'Stir the pot.' },
            { Text: giant },
            { instruction: 'Short but. Three sentences. Here.' }
        ];
        expect(findGiantInstructionIndexes(instructions)).toEqual([1]);
    });

    it('leaves source-native multi-sentence steps below the threshold alone', () => {
        // The croissant page's own 455-char step — author segmentation, keep it
        const native = 'After the first proof, turn the dough out onto a lightly floured surface and flatten it to knock out the air. Transfer the dough onto the second (larger) parchment paper and shape it into a rectangle. Fold the other half of the parchment paper over the dough, forming a 7 x 10 inch case. Use a rolling pin to roll out the dough to fit the 7 x 10 inch rectangle. (It doesn\'t have to fill the 7 x 10 inch rectangle perfectly, just as closely as possible).';
        expect(findGiantInstructionIndexes([{ instruction: native }])).toEqual([]);
    });

    it('ignores short or few-sentence steps', () => {
        const instructions = [
            { instruction: 'Preheat the oven to 200C and line a tray with parchment.' },
            { instruction: 'Mix everything together really well and then bake it for a very long time indeed.' }
        ];
        expect(findGiantInstructionIndexes(instructions)).toEqual([]);
    });

    it('handles non-arrays and nullish entries', () => {
        expect(findGiantInstructionIndexes(null)).toEqual([]);
        expect(findGiantInstructionIndexes([null, {}])).toEqual([]);
    });
});

describe('applyStepSplits / parser', () => {
    const instructions = [
        { stepNumber: 1, instruction: 'Mix the dough.', sectionName: 'Detrempe' },
        { stepNumber: 2, instruction: 'Patient multi sentence block. It packs distinct actions. Rest the dough. Chill it. Turn it out. Flatten it. Chill again.', sectionName: 'Detrempe' },
        { stepNumber: 3, instruction: 'Shape the butter block.', sectionName: 'Tourrage' }
    ];
    const flagData = [null, instructions[1], null];
    const splits = [
        { sourceStep: 2, instructions: [{ instruction: 'You are now starting the detrempe — rest the dough.' }, { instruction: 'Chill it.' }, { instruction: 'Turn it out and flatten.' }] }
    ];

    it('replaces only flagged steps verbatim elsewhere', () => {
        const merged = applyStepSplits(instructions, splits, flagData);
        expect(merged).toHaveLength(5);
        expect(merged[0]).toEqual(instructions[0]);
        expect(merged[4]).toEqual(instructions[2]);
        expect(merged.map(m => m.instruction)).toEqual([
            'Mix the dough.',
            'You are now starting the detrempe — rest the dough.',
            'Chill it.',
            'Turn it out and flatten.',
            'Shape the butter block.'
        ]);
    });

    it('inherits sectionName onto replacement steps', () => {
        const merged = applyStepSplits(instructions, splits, flagData);
        expect(merged[1].sectionName).toBe('Detrempe');
        expect(merged[2].sectionName).toBe('Detrempe');
        expect(merged[3].sectionName).toBe('Detrempe');
    });

    it('returns original list for empty/invalid splits', () => {
        expect(applyStepSplits(instructions, [])).toEqual(instructions);
        expect(applyStepSplits(instructions, [{ sourceStep: 2, instructions: [] }])).toEqual(instructions);
        expect(applyStepSplits(null, splits)).toBeNull();
    });

    it('renumbers global step numbers downstream', () => {
        const merged = applyStepSplits(instructions, splits, flagData).map((s, i) => ({ ...s, stepNumber: i + 1 }));
        expect(merged.map(m => m.stepNumber)).toEqual([1, 2, 3, 4, 5]);
    });
});

describe('parseSplitGiantStepsResult', () => {
    it('returns splits arrays', () => {
        expect(parseSplitGiantStepsResult({ splits: [{ sourceStep: 1, instructions: [{ instruction: 'a' }] }] })).toHaveLength(1);
    });
    it('rejects missing splits', () => {
        expect(parseSplitGiantStepsResult({})).toBeNull();
        expect(parseSplitGiantStepsResult({ splits: [] })).toBeNull();
        expect(parseSplitGiantStepsResult({ splits: [{ sourceStep: 1 }] })).toBeNull();
    });
    it('caps runaway split counts', () => {
        const runaway = Array.from({ length: 12 }, (_, i) => ({ sourceStep: i % 3 + 1, instructions: [{ instruction: 'x' + i }] }));
        expect(parseSplitGiantStepsResult({ splits: runaway }, 1)).toHaveLength(3);
    });
});

describe('buildSplitGiantStepsMessages (numbered blocks)', () => {
    it('numbers the giant blocks, not the whole recipe', () => {
        const msgs = buildSplitGiantStepsMessages(['Block one. Very. Long. Many. Sentences. Indeed.', 'Second block']);
        expect(msgs[1].content).toContain('1. Block one.');
        expect(msgs[1].content).toContain('2. Second block');
    });
});

describe('parseSplitInstructionsResult', () => {
    it('returns trimmed instruction list', () => {
        const out = parseSplitInstructionsResult({ instructions: [{ instruction: '  Mix.  ' }, { instruction: 'Bake.' }] });
        expect(out).toEqual([{ instruction: 'Mix.' }, { instruction: 'Bake.' }]);
    });

    it('returns null for missing/empty arrays', () => {
        expect(parseSplitInstructionsResult({})).toBeNull();
        expect(parseSplitInstructionsResult({ instructions: [] })).toBeNull();
        expect(parseSplitInstructionsResult({ instructions: [{ instruction: '   ' }] })).toBeNull();
    });
});

describe('parseAiJson leniency (fenced JSON)', () => {
    it('parses fenced output used by the splitter', () => {
        const data = parseAiJson('```json\n{"instructions":[{"instruction":"A"}]}\n```');
        expect(parseSplitInstructionsResult(data)).toEqual([{ instruction: 'A' }]);
    });
});
