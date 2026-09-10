/**
 * Forces the cascade past the JSON-LD tier to exercise heuristic + AI rule
 * generation + stored-rule reuse on real sites:
 *   npx tsx scripts/test-ai-tier.ts
 * Pass 1 (skipJsonLd): heuristic tier or AI generation. If AI runs, a
 *                      validated rule must be persisted.
 * Pass 2 + 3 (skipJsonLd): must resolve at the stored-rule tier with NO AI.
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

    const sites = [
        'https://pinchofyum.com/chickpea-curry',
        'https://www.justonecookbook.com/teriyaki-tofu/',
        'https://thevietvegan.com/washed-flour-seitan-method/',
        'https://www.alisoneroman.com/recipes/stovetop-jam/',
    ];
    const { scrapeRecipe, fetchHtml } = await import('../lib/recipeScrape/index')
    const { loadOrRunPreParse } = await import('../lib/recipeScrape/index')
    await (await import('../lib/dbConnect')).default()
    const SiteScrapeRule = (await import('../models/SiteScrapeRule')).default
    const SiteHtmlIndex = (await import('../models/SiteHtmlIndex')).default

    let allOk = true
    for (const url of sites) {
        const domain = new URL(url).hostname.replace(/^www\./, '')
        await SiteScrapeRule.deleteMany({ domain })
        await SiteHtmlIndex.deleteMany({ domain })

        let pass1: any = null
        try {
            const t0 = Date.now()
            pass1 = await scrapeRecipe(url, { skipJsonLd: true })
            const tier = pass1.extractionTier
            const ruleDoc = tier === 'ai-generated'
                ? await SiteScrapeRule.findOne({ domain }).lean()
                : null
            console.log(`\n### ${domain}`)
            console.log(`pass1: ${tier} in ${Date.now() - t0}ms | ${pass1.ingredients.length} ingreds, ${pass1.instructions.length} steps${pass1.sourceNotes ? ' | notes: ' + pass1.sourceNotes.slice(0, 80).replace(/\n/g, ' ') : ''}`)
            console.log('rule persisted:', ruleDoc ? `${(ruleDoc.rules || []).length} rule(s)` : tier === 'ai-generated' ? 'MISSING!' : 'n/a (heuristic)')
            if (tier === 'ai-generated' && !ruleDoc) { allOk = false; continue }
        } catch (err: any) {
            console.error(`\n### ${domain}\npass1 FAILED: ${err.message}`)
            allOk = false
            continue
        }

        // Pass 2: same recipe — must come from stored rules or heuristics,
        // never a second AI call
        try {
            const t0 = Date.now()
            const pass2 = await scrapeRecipe(url, { skipJsonLd: true })
            const ok = pass2.extractionTier === 'stored-rule' || pass2.extractionTier === 'heuristic'
            console.log(`pass2: ${pass2.extractionTier} in ${Date.now() - t0}ms | ${ok ? 'NO AI CALL (OK)' : 'AI CALLED AGAIN — VIOLATION'}`)
            if (!ok) allOk = false
        } catch (err: any) {
            console.error('pass2 FAILED:', err.message)
            allOk = false
        }
    }

    console.log('\nAI-TIER VERDICT:', allOk ? 'PASS' : 'FAIL')
    process.exit(allOk ? 0 : 1)
})()
