/**
 * Verifies a persisted AI rule generalizes across DIFFERENT recipes on the
 * same domain (the real "no second AI call" requirement):
 *   npx tsx scripts/test-second-recipe.ts
 */
import fs from 'fs'
import path from 'path'

(async () => {
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
        }
    }

    const { scrapeRecipe } = await import('../lib/recipeScrape/index')

    // Different recipe from a domain whose rule (or heuristics) were seeded
    // by the earlier runs
    const cases: Array<[string, string, any]> = [
        ['alisoneroman.com rule (stress: jsonld disabled)', 'https://www.alisoneroman.com/recipes/stovetop-jam/', { skipJsonLd: true }],
        ['alisoneroman.com paywalled recipe (real flow)', 'https://www.alisoneroman.com/recipes/sour-orange-chicken/', {}],
        ['pinchofyum.com heuristics (stress)', 'https://pinchofyum.com/general-tsos-cauliflower', { skipJsonLd: true }],
        ['justonecookbook.com heuristics (stress)', 'https://www.justonecookbook.com/teriyaki-chicken/', { skipJsonLd: true }],
    ]

    let allOk = true
    for (const [label, url, opts] of cases as any) {
        try {
            const t0 = Date.now()
            const r = await scrapeRecipe(url, opts)
            const noAi = r.extractionTier !== 'ai-generated'
            console.log(`\n### ${label} (${Date.now() - t0}ms)`)
            console.log('tier:', r.extractionTier, '| name:', r.name)
            console.log(`ingreds: ${r.ingredients.length}`, JSON.stringify(r.ingredients[0]))
            console.log(`steps: ${r.instructions.length}`, JSON.stringify(r.instructions[0]))
            console.log('notes:', r.sourceNotes ? r.sourceNotes.slice(0, 100).replace(/\n/g, ' ') : '(none)')
            if (!noAi) allOk = false
        } catch (err: any) {
            console.error(`\n### ${label}\nFAILED: ${err.message}`)
            allOk = false
        }
    }
    console.log('\nSECOND-RECIPE VERDICT:', allOk ? 'PASS' : 'FAIL')
    process.exit(allOk ? 0 : 1)
})()
