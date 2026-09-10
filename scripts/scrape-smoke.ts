/**
 * Smoke test for the pre-parse + JSON-LD + heuristic tiers of the scrape
 * cascade. No Mongo or AI keys required — run with:
 *   npx tsx scripts/scrape-smoke.ts <url>
 */
import { fetchHtml, extractJsonLd, heuristicFromCandidates } from '../lib/recipeScrape/index'
import { preParseHtml } from '../lib/recipeScrape/preParse'

async function main() {
    const url = process.argv[2]
    if (!url) {
        console.error('Usage: npx tsx scripts/scrape-smoke.ts <recipe-url>')
        process.exit(1)
    }

    if (process.env.SMOKE_MODE === 'cache') {
        const { fetchHtml: fh, loadOrRunPreParse: lp } = await import('../lib/recipeScrape/index')
        const html2 = await fh(url)
        const t0 = Date.now()
        const first = await lp(url, html2)
        console.log(`\n=== CACHE MISS (parse+persist, ${Date.now() - t0}ms) ===`)
        console.log('domain:', first.domain, '| candidates:', JSON.stringify(first.candidates.ingredients.length + first.candidates.instructions.length + first.candidates.notes.length))
        const t1 = Date.now()
        const second = await lp(url, html2)
        console.log(`=== CACHE HIT (${Date.now() - t1}ms) ===`)
        console.log('preParseMs (should be 0):', second.preParseMs, '| fragments keys:', Object.keys(second.fragments).length)
        return
    }
    if (process.env.SMOKE_MODE === 'full') {
        const { scrapeRecipe } = await import('../lib/recipeScrape/index')
        const t0 = Date.now()
        const recipe = await scrapeRecipe(url)
        console.log(`\n=== FULL SCRAPE (${recipe.extractionTier}, ${Date.now() - t0}ms) ===`)
        console.log('name:', recipe.name)
        console.log('ingredients:', recipe.ingredients.length, '->', JSON.stringify(recipe.ingredients[0]))
        console.log('instructions:', recipe.instructions.length, '->', JSON.stringify(recipe.instructions[0]))
        console.log('sourceNotes:', recipe.sourceNotes ? recipe.sourceNotes.slice(0, 300) : '(none)')
        return
    }

    console.log(`Fetching ${url} ...`)
    const html = await fetchHtml(url)
    console.log(`Fetched ${(html.length / 1024).toFixed(0)} KB`)

    // Pre-parse diagnostics (always, so heuristics and AI tiers can be studied)
    const pre = preParseHtml(url, html)
    console.log('\n=== PRE-PARSE ===')
    console.log('domain:', pre.domain, '| took', pre.preParseMs + 'ms')
    let totalFrag = 0
    for (const cat of ['ingredients', 'instructions', 'notes'] as const) {
        console.log(`\n${cat} candidates:`)
        for (const c of pre.candidates[cat]) {
            console.log(`  - ${c.cssPath} (score ${c.score}, ${c.charCount} chars)`)
        }
    }
    for (const frag of Object.values(pre.fragments)) totalFrag += frag.length
    console.log('\ntotal fragment bytes:', totalFrag)

    if (process.env.SMOKE_MODE === 'pre' || process.env.SMOKE_MODE === 'heuristic') {
        // Tier 3 heuristics (skip JSON-LD so the heuristic tier can be studied)
        const forced = heuristicFromCandidates(html, pre)
        if (forced) {
            console.log(`\n=== HEURISTIC${process.env.SMOKE_MODE === 'heuristic' ? ' (forced)' : ''} ===`)
            console.log('name:', forced.name)
            console.log('ingredients:', forced.ingredients.length, '->', JSON.stringify(forced.ingredients[0]))
            console.log('instructions:', forced.instructions.length, '->', JSON.stringify(forced.instructions[0]))
            console.log('sourceNotes:', forced.sourceNotes ? forced.sourceNotes.slice(0, 300) : '(none)')
        } else {
            console.log(process.env.SMOKE_MODE === 'heuristic' ? '\n=== HEURISTIC FAILED ===' : '')
        }
        if (process.env.SMOKE_MODE === 'heuristic') return
    }

    // Tier 1: JSON-LD (needs no pre-parse, but run after the forced tier test)
    const jsonLd = extractJsonLd(html)
    if (jsonLd) {
        console.log('\n=== JSON-LD SUCCESS ===')
        console.log('name:', jsonLd.name)
        console.log('ingredients:', jsonLd.ingredients.length, '->', JSON.stringify(jsonLd.ingredients[0]))
        console.log('instructions:', jsonLd.instructions.length, '->', JSON.stringify(jsonLd.instructions[0]))
        console.log('sourceNotes:', jsonLd.sourceNotes ? jsonLd.sourceNotes.slice(0, 200) : '(none)')
        return
    }
    console.log('JSON-LD: no valid recipe found')

    // Tier 3: heuristics (normal order — only reached without JSON-LD)
    const heuristic = heuristicFromCandidates(html, pre)
    if (heuristic) {
        console.log('\n=== HEURISTIC SUCCESS ===')
        console.log('name:', heuristic.name)
        console.log('ingredients:', heuristic.ingredients.length, '->', JSON.stringify(heuristic.ingredients[0]))
        console.log('instructions:', heuristic.instructions.length, '->', JSON.stringify(heuristic.instructions[0]))
        console.log('sourceNotes:', heuristic.sourceNotes ? heuristic.sourceNotes.slice(0, 200) : '(none)')
    } else {
        console.log('\n=== HEURISTIC FAILED (AI rule generation would trigger) ===')
    }
}

main().catch(err => {
    console.error('Smoke test failed:', err.message)
    process.exit(1)
})
