/**
 * Debugs stored-rule application on a page:
 *   npx tsx scripts/test-applied.ts <url> [--skip-jsonld]
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

    const { fetchHtml, extractJsonLd, heuristicFromCandidates, loadOrRunPreParse } = await import('../lib/recipeScrape/index')
    const mod = await import('../lib/recipeScrape/index') as any
    const applyCssRule = mod.applyCssRule
    const url = process.argv[2]
    const html = await fetchHtml(url)
    const domain = new URL(url).hostname.replace(/^www\./, '')

    console.log('html size:', html.length)
    console.log('jsonld valid:', !!extractJsonLd(html))

    await (await import('../lib/dbConnect')).default()
    const SiteScrapeRule = (await import('../models/SiteScrapeRule')).default
    const doc: any = await SiteScrapeRule.findOne({ domain }).lean()
    console.log('stored rules:', doc ? (doc.rules || []).length : 0)
    if (doc) {
        for (const rule of doc.rules) {
            console.log(`\nrule ${rule.id} (conf ${rule.confidence}, ok ${rule.successCount}/${rule.successCount + rule.failCount}):`)
            console.log(JSON.stringify(rule.selectors, null, 1))
            try {
                const result = applyCssRule(html, rule.selectors)
                if (result) {
                    console.log('=> VALID:', result.ingredients.length, 'ingreds,', result.instructions.length, 'steps')
                    console.log('first ingr:', JSON.stringify((result.ingredients[0] || {}).ingredient))
                    console.log('first step:', JSON.stringify((result.instructions[0] || {}).instruction))
                } else {
                    console.log('=> VALIDATION FAILED')
                }
            } catch (err: any) {
                console.log('=> threw:', err.message)
            }
        }
    }

    const pre = await loadOrRunPreParse(url, html)
    console.log('\npre-parse candidates:', JSON.stringify(pre.candidates, null, 1).slice(0, 1500))
    const h = heuristicFromCandidates(html, pre)
    console.log('heuristic:', h ? `${h.ingredients.length} ingreds, ${h.instructions.length} steps` : 'FAILED')
    if (h) console.log('first step:', JSON.stringify((h.instructions[0] || {}).instruction))
    process.exit(0)
})()
