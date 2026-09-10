/**
 * Tests the full scrape cascade on real sites:
 *   npx tsx scripts/test-sites.ts            # all 5 sites, two passes each
 * Pass 1: first-ever scrape (JSON-LD / heuristics / AI rule generation).
 * Pass 2: same recipe again — must NOT use the AI tier (stored rule).
 * Prints per-site pass info and a final verdict table.
 */
import fs from 'fs'
import path from 'path'

const sites = [
    'https://www.alisoneroman.com/recipes/stovetop-jam/',
    'https://thevietvegan.com/washed-flour-seitan-method/',
    'https://itdoesnttastelikechicken.com/the-quickest-and-easiest-seitan-recipe-vegan-chicken/',
    'https://pinchofyum.com/chickpea-curry',
    'https://www.justonecookbook.com/teriyaki-tofu/',
];

// Load .env.local for Mongo + Groq keys (tsx doesn't read Next env files)
(async () => {
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
        }
    }

    const { scrapeRecipe } = await import('../lib/recipeScrape/index')

    const results: string[] = []
    let allOk = true

    for (const url of sites) {
        let first: any = null
        let firstMs = 0
        try {
            const t0 = Date.now()
            first = await scrapeRecipe(url)
            firstMs = Date.now() - t0
        } catch (err: any) {
            console.error(`\n### ${url}\nPASS 1 FAILED: ${err.message}`)
            results.push(`${url}\n    FAIL: first scrape failed: ${err.message}`)
            allOk = false
            continue
        }

        let second: any = null
        let secondMs = 0
        try {
            const t0 = Date.now()
            second = await scrapeRecipe(url)
            secondMs = Date.now() - t0
        } catch (err: any) {
            console.error(`\n### ${url}\nPASS 2 FAILED: ${err.message}`)
            results.push(`${url}\n    FAIL (recipe valid on pass 1): second scrape failed: ${err.message}`)
            allOk = false
            continue
        }

        const noAiOnSecond = second.extractionTier !== 'ai-generated'
        const sameData =
            second.ingredients.length === first.ingredients.length &&
            second.instructions.length === first.instructions.length
        if (!noAiOnSecond || !sameData) allOk = false

        results.push(
            [
                url,
                `    pass1: ${first.extractionTier} in ${firstMs}ms | ${first.ingredients.length} ingreds, ${first.instructions.length} steps${first.sourceNotes ? ', notes: ' + first.sourceNotes.slice(0, 60).replace(/\n/g, ' ') + '...' : ', no notes'}`,
                `    pass2: ${second.extractionTier} in ${secondMs}ms | no-AI: ${noAiOnSecond ? 'OK' : 'VIOLATION'} | data-stable: ${sameData ? 'OK' : 'DIFFERENT'}`,
            ].join('\n')
        )
    }

    console.log('\n================ RESULTS ================')
    for (const r of results) console.log(r)
    console.log('\nVERDICT:', allOk ? 'ALL SITES PASS' : 'SOME SITES FAILED')
    process.exit(allOk ? 0 : 1)
})()
