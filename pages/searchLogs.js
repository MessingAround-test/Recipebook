import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAdminGuard } from '../lib/useAdminGuard'
import Router from 'next/router'

export default function SearchLogs() {
    const isAuthorized = useAdminGuard()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (isAuthorized) {
            fetchLogs()
        }
    }, [isAuthorized])

    async function fetchLogs() {
        const token = localStorage.getItem('Token')
        if (!token) return

        try {
            const res = await fetch("/api/Ingredients/SearchLogEntries", {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()
            if (data.success) {
                setLogs(data.res)
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error)
        } finally {
            setLoading(false)
        }
    }

    async function reRunSearch(searchTerm, source) {
        const token = localStorage.getItem('Token')
        if (!token) return

        try {
            // Call the base API with force=true and specific supplier
            const endpoint = `/api/Ingredients/?name=${encodeURIComponent(searchTerm)}&supplier=${source}&force=true`
            const res = await fetch(endpoint, {
                headers: { 'edgetoken': token }
            })
            const data = await res.json()

            if (data.success) {
                alert(`Search for "${searchTerm}" on ${source} re-run successfully.`)
                fetchLogs() // Refresh the list
            } else {
                alert(`Search failed: ${data.message}`)
            }
        } catch (error) {
            console.error("Retry failed:", error)
            alert("An unexpected error occurred during retry.")
        }
    }

    if (!isAuthorized) return null

    return (
        <Layout title="Search Logs">
            <div className="max-w-6xl mx-auto mt-8 p-4">
                <div className="glass-card overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-primary">System Search Logs</h1>
                        <button
                            onClick={fetchLogs}
                            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors"
                        >
                            Refresh List
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-center text-muted-foreground py-10">Loading logs...</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-muted-foreground text-sm uppercase">
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Search Term</th>
                                        <th className="p-4">Source</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Records</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {logs.map((log) => (
                                        <tr key={log._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                {new Date(log.last_fetched).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-medium">{log.search_term}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.source === 'WW' ? 'bg-green-500/20 text-green-400' :
                                                    log.source === 'Aldi' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    {log.source}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {log.success ? (
                                                    <span className="text-green-500">✓ Success</span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-destructive font-bold">⚠ Fail</span>
                                                        <span className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={log.error_message}>
                                                            {log.error_message}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 font-mono font-bold">
                                                {log.records_count !== undefined && log.records_count !== null ? log.records_count : '?'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => reRunSearch(log.search_term, log.source)}
                                                    className="text-xs bg-primary/20 hover:bg-primary/40 text-primary px-3 py-1 rounded transition-colors font-bold"
                                                >
                                                    Retry
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {logs.length === 0 && (
                                <p className="text-center py-10 text-muted-foreground">No logs found yet.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
