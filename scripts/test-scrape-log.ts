/**
 * Live-check of scrape logging: scrapes a few URLs (success + one failure)
 * then prints the log entries written.
 */
import fs from 'fs'
import path from 'path'
declare const require: any

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/)
            if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
        }
    }
}

async function main() {
    loadEnv()
    const { scrapeRecipe } = await import('../lib/recipeScrape/index')
    const urls = [
        'https://www.bbcgoodfood.com/recipes/burnt-aubergine-veggie-chilli',
        'https://example.com/not-a-recipe',
        'https://this-domain-does-not-exist-abcxyz.com/recipe'
    ]
    for (const u of urls) {
        try {
            const r = await scrapeRecipe(u)
            console.log('OK  ', r.extractionTier, r.ingredients.length + 'i/' + r.instructions.length + 's', u)
        } catch (e: any) {
            console.log('ERR ', e.message.slice(0, 70), u)
        }
    }
    // Dump fresh logs (give fire-and-forget log writes time to land before exit)
    await new Promise(r => setTimeout(r, 1000))
    await (await import('../lib/dbConnect')).default()
    const ScrapeLog = (await import('../models/ScrapeLog')).default
    const logs: any[] = await (ScrapeLog as any).find({}).sort({ created_at: -1 }).limit(6).lean()
    console.log('\n=== latest scrapeLogs ===')
    for (const l of logs) {
        console.log([
            new Date(l.created_at).toISOString().slice(0, 19),
            l.domain,
            l.success ? (l.extractionTier || '?') : 'FAILED',
            `${l.ingredientCount}i/${l.instructionCount}s${l.hasSourceNotes ? '+notes' : ''}`,
            l.sourceFallback,
            l.tookMs + 'ms',
            l.ruleId,
            l.errorMessage ? 'err: ' + l.errorMessage.slice(0, 40) : '',
            l.url.slice(0, 55)
        ].join(' | '))
    }
    process.exit(0)
}

main()
