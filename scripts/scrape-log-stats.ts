/**
 * Scrape log summary — how did imports get extracted?
 *   npx tsx scripts/scrape-log-stats.ts            # last 7 days
 *   npx tsx scripts/scrape-log-stats.ts 30         # last 30 days
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

    const days = Number(process.argv[2]) || 7
    const since = new Date(Date.now() - days * 86400_000)

    await (await import('../lib/dbConnect')).default()
    const ScrapeLog = (await import('../models/ScrapeLog')).default

    const logs: any[] = await (ScrapeLog as any).find({ created_at: { $gte: since } })
        .sort({ created_at: -1 })
        .limit(500)
        .lean()

    if (logs.length === 0) {
        console.log(`No scrape logs in the last ${days} day(s).`)
        process.exit(0)
    }

    const byDomain: Record<string, any[]> = {}
    for (const log of logs) {
        (byDomain[log.domain] ||= []).push(log)
    }

    console.log(`\n=== SCRAPE LOGS — last ${days} day(s), ${logs.length} attempt(s) ===`)
    for (const [domain, entries] of Object.entries(byDomain)) {
        const tiers: Record<string, number> = {}
        let ai = 0, heuristic = 0, ok = 0, fail = 0, curl = 0
        let totalMs = 0
        for (const e of entries) {
            const tier = e.success ? (e.extractionTier || '?') : 'FAILED'
            tiers[tier] = (tiers[tier] || 0) + 1
            if (e.aiUsed) ai++
            if (e.heuristicUsed) heuristic++
            if (e.success) { ok++; totalMs += e.tookMs || 0 } else fail++
            if (e.sourceFallback === 'curl') curl++
        }
        const tiersStr = Object.entries(tiers).map(([t, n]) => `${n}x${t}`).join(' | ')
        const avg = ok ? `${Math.round(totalMs / ok)}ms avg` : 'n/a'
        const flags = [
            ai ? `${ai} AI-CALL(S)` : '',
            heuristic ? `${heuristic} heuristic-only` : '',
            curl ? `${curl} curl-ua` : '',
        ].filter(Boolean).join(', ')
        console.log(`\n${domain} — ${ok} ok / ${fail} failed (${avg})`)
        console.log(`   ${tiersStr}${flags ? `\n   notes: ${flags}` : ''}`)
        // show failures + most recent entry detail
        for (const e of entries.filter(e => !e.success).slice(0, 3)) {
            console.log(`   FAIL ${new Date(e.created_at).toISOString().slice(0, 16)}: ${e.errorMessage?.slice(0, 120)} (${(e.url || '').slice(0, 60)})`)
        }
        const last = entries[0]
        console.log(`   last: ${new Date(last.created_at).toISOString().slice(0, 16)} ${last.success ? `${last.extractionTier} ${(last.ingredientCount || 0)}i/${(last.instructionCount || 0)}s` : 'FAIL'} ${(last.url || '').slice(0, 60)}`)
    }
    process.exit(0)
})()
