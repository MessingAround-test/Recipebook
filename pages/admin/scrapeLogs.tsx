import React, { useCallback, useEffect, useState } from 'react'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { useAdminGuard } from '../../lib/useAdminGuard'
import { FiRefreshCw, FiExternalLink } from 'react-icons/fi'

interface ScrapeLogRow {
    _id: string
    domain: string
    url: string
    extractionTier?: string
    ruleId?: string
    heuristicUsed?: boolean
    aiUsed?: boolean
    sourceFallback?: 'browser' | 'curl'
    ingredientCount: number
    instructionCount: number
    hasSourceNotes: boolean
    tookMs?: number
    success: boolean
    errorMessage?: string
    created_at: string
}

interface DomainStat {
    _id: string
    total: number
    ok: number
    jsonld: number
    storedRule: number
    heuristic: number
    aiGenerated: number
    aiUsed: number
    curlFallback: number
    avgMs: number | null
    lastAt: string
}

const TIER_STYLES: Record<string, string> = {
    'jsonld': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'stored-rule': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'heuristic': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'ai-generated': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'FAILED': 'bg-red-500/15 text-red-400 border-red-500/30',
}

const tierBadge = (row: ScrapeLogRow): { label: string; cls: string } => {
    if (!row.success) return { label: 'FAILED', cls: TIER_STYLES['FAILED'] }
    const tier = row.extractionTier || 'unknown'
    return { label: tier, cls: TIER_STYLES[tier] || TIER_STYLES['FAILED'] }
}

export default function ScrapeLogs() {
    const isAuthorized = useAdminGuard()
    const [loading, setLoading] = useState(false)
    const [logs, setLogs] = useState<ScrapeLogRow[]>([])
    const [byDomain, setByDomain] = useState<DomainStat[]>([])
    const [failures, setFailures] = useState<ScrapeLogRow[]>([])
    const [days, setDays] = useState(7)
    const [domain, setDomain] = useState('')

    const load = useCallback(async (opts?: { days?: number; domain?: string }) => {
        const d = opts?.days ?? days
        const dm = opts?.domain ?? domain
        setLoading(true)
        try {
            const token = localStorage.getItem('Token')
            const params = new URLSearchParams({ days: String(d), limit: '150' })
            if (dm) params.set('domain', dm)
            const res = await fetch(`/api/admin/scrapeLogs?${params.toString()}`, {
                headers: { 'edgetoken': token || '' }
            })
            const data = await res.json()
            if (data.success) {
                setLogs(data.data.logs)
                setByDomain(data.data.byDomain.map((s: DomainStat) => ({ ...s, storedRule: s.storedRule ?? s['stored-rule'] ?? 0, aiGenerated: s.aiGenerated ?? s['ai-generated'] ?? 0 })))
                setFailures(data.data.failures)
            } else {
                alert(data.message || 'Failed to load scrape logs')
            }
        } catch (e: any) {
            alert('Failed to load scrape logs: ' + (e.message || 'unexpected error'))
        } finally {
            setLoading(false)
        }
    }, [days, domain])

    useEffect(() => {
        if (isAuthorized) load()
    }, [isAuthorized])

    if (!isAuthorized) return null

    return (
        <Layout title="Scrape Logs">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <PageHeader title="Web Import Scrape Logs" />
                <p className="text-sm text-muted-foreground -mt-6 mb-8">
                    How every recipe-site import was extracted. <span className="text-emerald-400">jsonld</span> = schema.org
                    recipe data (no AI), <span className="text-blue-400">stored-rule</span> = a saved AI rule,{' '}
                    <span className="text-amber-400">heuristic</span> = keyword matching, <span className="text-purple-400">ai-generated</span> =
                    &nbsp;a new rule was generated this call. Entries expire after 90 days.
                </p>

                {/* Filters */}
                <div className="glass-card mb-6 flex flex-col md:flex-row gap-4 md:items-end">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Window</label>
                        <div className="flex gap-2">
                            {[1, 7, 30].map(d => (
                                <button
                                    key={d}
                                    onClick={() => { setDays(d); load({ days: d }) }}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-all ${days === d ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}`}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-grow">
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Domain filter</label>
                        <input
                            className="input-modern"
                            placeholder="e.g. bbcgoodfood.com (blank = all)"
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') load() }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => load()} disabled={loading}>
                            <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </div>

                {/* Per-domain stats */}
                <div className="glass-card mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4">Domains</h3>
                    {byDomain.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                            No scrape logs in this window.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="border-b border-white/10 text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                                        <th className="p-3">Domain</th>
                                        <th className="p-3">Total</th>
                                        <th className="p-3">jsonld</th>
                                        <th className="p-3">rule</th>
                                        <th className="p-3">heuristic</th>
                                        <th className="p-3">ai-gen</th>
                                        <th className="p-3">AI calls</th>
                                        <th className="p-3">curl UA</th>
                                        <th className="p-3">Avg time</th>
                                        <th className="p-3">Last seen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byDomain.map((s: DomainStat) => {
                                        const domainName = s._id as unknown as string
                                        return (
                                            <tr
                                                key={String(domainName)}
                                                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                                                onClick={() => { setDomain(String(domainName)); load({ domain: String(domainName) }) }}
                                                title="Click to filter to this domain"
                                            >
                                                <td className="p-3 font-bold">{String(domainName)}</td>
                                                <td className="p-3">{s.total} <span className="text-muted-foreground text-xs">({s.ok} ok)</span></td>
                                                <td className="p-3">{s.jsonld}</td>
                                                <td className="p-3">{s.storedRule}</td>
                                                <td className="p-3">{s.heuristic}</td>
                                                <td className="p-3">{s.aiGenerated}</td>
                                                <td className={`p-3 ${s.aiUsed > 0 ? 'text-purple-400 font-bold' : 'text-muted-foreground'}`}>{s.aiUsed}</td>
                                                <td className={`p-3 ${s.curlFallback > 0 ? 'text-amber-400 font-bold' : 'text-muted-foreground'}`}>{s.curlFallback}</td>
                                                <td className="p-3">{s.avgMs != null ? `${Math.round(s.avgMs)}ms` : '—'}</td>
                                                <td className="p-3 text-muted-foreground text-xs">{new Date(s.lastAt).toLocaleString()}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Failures */}
                {failures.length > 0 && (
                    <div className="glass-card mb-6">
                        <h3 className="text-sm font-black uppercase tracking-widest text-red-400 mb-4">Recent failures</h3>
                        <div className="space-y-2">
                            {failures.map(f => (
                                <div key={f._id} className="rounded-lg bg-red-500/5 border border-red-500/20 px-4 py-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-red-400">{new Date(f.created_at).toLocaleString()}</span>
                                        <span className="text-xs text-muted-foreground">{f.tookMs}ms</span>
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent hover:underline">
                                            {f.url.slice(0, 70)} <FiExternalLink className="inline" />
                                        </a>
                                    </div>
                                    <p className="text-sm text-foreground/80">{f.errorMessage}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Log detail table */}
                <div className="glass-card">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4">
                        Attempts {logs.length ? `(${logs.length} shown, newest first)` : ''}
                    </h3>
                    {logs.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                            No scrape attempts recorded in this window{domain ? ` for ${domain}` : ''}.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="border-b border-white/10 text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                                        <th className="p-3">When</th>
                                        <th className="p-3">Domain</th>
                                        <th className="p-3">Tier</th>
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Flags</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Recipe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(row => {
                                        const { label, cls } = tierBadge(row)
                                        return (
                                            <tr key={row._id} className={`border-b border-white/5 hover:bg-white/5 ${row.success ? '' : 'opacity-60'}`}>
                                                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                                                <td className="p-3 text-xs font-semibold">{row.domain}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${cls}`}>{label}</span>
                                                </td>
                                                <td className="p-3 text-xs">{row.ingredientCount} ing / {row.instructionCount} steps{row.hasSourceNotes ? ' +notes' : ''}</td>
                                                <td className="p-3 text-xs">
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {row.aiUsed && <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[10px] font-bold border border-purple-500/30">AI</span>}
                                                        {row.heuristicUsed && row.extractionTier === 'heuristic' && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">no rule</span>}
                                                        {row.ruleId && <span className="px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground text-[10px] font-mono">{row.ruleId}</span>}
                                                        {row.sourceFallback === 'curl' && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">curl UA</span>}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-xs">{row.tookMs != null ? `${row.tookMs}ms` : '—'}</td>
                                                <td className="p-3 max-w-[280px]">
                                                    {row.success ? (
                                                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline truncate block">
                                                            {row.url.replace(/^https?:\/\/(www\.)?/, '')} <FiExternalLink className="inline" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground truncate block" title={row.errorMessage}>{row.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
