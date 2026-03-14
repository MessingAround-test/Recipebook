import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { useAdminGuard } from '../../lib/useAdminGuard';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { FiUsers, FiFileText, FiSearch, FiActivity } from 'react-icons/fi';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement
);

// --- Unify Label Formatting ---
const formatTimestamp = (date: Date, hours: number, intervalMinutes: number) => {
    if (hours <= 12 || intervalMinutes < 60) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours <= 168) {
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    } else {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
};

export default function AdminDashboard() {
    const isAuthorized = useAdminGuard();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('24h');

    useEffect(() => {
        if (isAuthorized) {
            fetchStats(range);
        }
    }, [isAuthorized, range]);

    async function fetchStats(selectedRange: string) {
        setLoading(true);
        try {
            const token = localStorage.getItem('Token');
            const res = await fetch(`/api/admin/dashboard-stats?range=${selectedRange}`, {
                headers: { 'edgetoken': token || '' }
            });
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }

    if (!isAuthorized) return null;

    if (loading) {
        return (
            <Layout title="Dashboard">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-muted-foreground animate-pulse">Loading Dashboard Insights...</div>
                </div>
            </Layout>
        );
    }

    // --- Helper for Time Series Labels ---
    const generateLabels = (rangeStr: string, intervalMinutes: number) => {
        const labels: string[] = [];
        const now = new Date();
        let queryHours = 24;

        switch (rangeStr) {
            case '1h': queryHours = 1; break;
            case '12h': queryHours = 12; break;
            case '24h': queryHours = 24; break;
            case '3d': queryHours = 72; break;
            case '7d': queryHours = 168; break;
            case '30d': queryHours = 720; break;
        }

        const start = new Date(now.getTime() - queryHours * 60 * 60 * 1000);
        start.setMinutes(Math.floor(start.getMinutes() / intervalMinutes) * intervalMinutes, 0, 0);

        const end = new Date(now.getTime() + (intervalMinutes * 60 * 1000));
        
        for (let t = start.getTime(); t < end.getTime(); t += intervalMinutes * 60 * 1000) {
            const d = new Date(t);
            if (t > now.getTime() + (intervalMinutes * 60 * 1000) / 2) break;
            labels.push(formatTimestamp(d, queryHours, intervalMinutes));
        }
        return { labels: Array.from(new Set(labels)), hours: queryHours };
    };

    // --- Helper to Trim Leading Zeros ---
    const trimLeadingZeros = (labels: string[], datasets: any[]) => {
        let firstActiveIndex = -1;
        
        for (let i = 0; i < labels.length; i++) {
            const hasData = datasets.some(ds => ds.data[i] > 0);
            if (hasData) {
                firstActiveIndex = i;
                break;
            }
        }

        if (firstActiveIndex === -1) return { labels, datasets };
        
        return {
            labels: labels.slice(firstActiveIndex),
            datasets: datasets.map(ds => ({
                ...ds,
                data: ds.data.slice(firstActiveIndex)
            }))
        };
    };

    // --- Chart Data Preparation ---

    // 1. API Usage (Adaptive)
    const getApiInterval = (r: string) => {
        if (r === '1h') return 15;
        if (r === '12h' || r === '24h') return 60;
        if (r === '3d' || r === '7d') return 240; // 4h
        return 1440; // 1d
    };

    const apiInterval = getApiInterval(range);
    const { labels: rawApiLabels, hours: apiHours } = generateLabels(range, apiInterval);
    
    let apiDatasets = [
        {
            label: 'API Calls',
            data: rawApiLabels.map(label => {
                return stats?.apiUsage?.filter((u: any) => formatTimestamp(new Date(u.hour), apiHours, apiInterval) === label)
                    .reduce((a: number, b: any) => a + b.callCount, 0) || 0;
            }),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
        },
        {
            label: 'Overloads (429)',
            data: rawApiLabels.map(label => {
                return stats?.apiUsage?.filter((u: any) => formatTimestamp(new Date(u.hour), apiHours, apiInterval) === label)
                    .reduce((a: number, b: any) => a + b.overloadCount, 0) || 0;
            }),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4
        }
    ];

    const { labels: apiUsageLabels, datasets: apiUsageDatasets } = trimLeadingZeros(rawApiLabels, apiDatasets);
    const apiUsageData = { labels: apiUsageLabels, datasets: apiUsageDatasets };

    // 2. Key Comparison
    const keyComparisonData = {
        labels: ['Key 1', 'Key 2', 'Key 3'],
        datasets: [{
            data: [
                stats?.apiUsage?.filter((u: any) => u.keyIndex === 1).reduce((acc: number, curr: any) => acc + curr.callCount, 0) || 0,
                stats?.apiUsage?.filter((u: any) => u.keyIndex === 2).reduce((acc: number, curr: any) => acc + curr.callCount, 0) || 0,
                stats?.apiUsage?.filter((u: any) => u.keyIndex === 3).reduce((acc: number, curr: any) => acc + curr.callCount, 0) || 0
            ],
            backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'],
            borderWidth: 0
        }]
    };

    // 3. Extraction Usage (Adaptive)
    const getExtInterval = (r: string) => {
        if (r === '1h' || r === '12h') return 15;
        if (r === '24h' || r === '3d' || r === '7d') return 60;
        return 1440; // 1d
    };

    const extInterval = getExtInterval(range);
    const { labels: rawExtLabels, hours: extHours } = generateLabels(range, extInterval);

    let extDatasets = [
        {
            label: 'Cache Hits',
            data: rawExtLabels.map(label => {
                return stats?.extractionUsage?.filter((u: any) => {
                    return u.type === 'CACHE' && formatTimestamp(new Date(u.hour), extHours, extInterval) === label;
                }).reduce((a: number, b: any) => a + b.count, 0) || 0;
            }),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
        },
        {
            label: 'Supplier Extractions',
            data: rawExtLabels.map(label => {
                return stats?.extractionUsage?.filter((u: any) => {
                    return u.type === 'EXTRACTION' && formatTimestamp(new Date(u.hour), extHours, extInterval) === label;
                }).reduce((a: number, b: any) => a + b.count, 0) || 0;
            }),
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            fill: true,
            tension: 0.4
        }
    ];

    const { labels: extractionLabels, datasets: extractionDatasets } = trimLeadingZeros(rawExtLabels, extDatasets);
    const extractionData = { labels: extractionLabels, datasets: extractionDatasets };

    // 4. Record Growth (Daily)
    const generateDailyLabels = (rangeStr: string) => {
        const labels: string[] = [];
        const now = new Date();
        let days = 30;
        switch (rangeStr) {
            case '1h': case '12h': case '24h': days = 7; break; // Show week for context
            case '3d': days = 7; break;
            case '7d': days = 7; break;
            case '30d': days = 30; break;
        }
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            labels.push(d.toISOString().split('T')[0]);
        }
        return labels;
    };
    const rawGrowthLabels = generateDailyLabels(range);
    let growthRawDatasets = [
        {
            label: 'New Recipes',
            data: rawGrowthLabels.map(label => {
                return stats?.growth?.recipes?.find((g: any) => g._id === label)?.count || 0;
            }),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            yAxisID: 'yRecipes',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
        },
        {
            label: 'New Users',
            data: rawGrowthLabels.map(label => {
                return stats?.growth?.users?.find((g: any) => g._id === label)?.count || 0;
            }),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'yUsers',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
        }
    ];

    const { labels: growthLabels, datasets: growthDatasets } = trimLeadingZeros(rawGrowthLabels, growthRawDatasets);
    const growthData = { labels: growthLabels, datasets: growthDatasets };

    return (
        <Layout title="Admin Dashboard">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <PageHeader title="System Dashboard" />
                        <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-2">
                            Overview of system performance & growth
                        </p>
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        {['1h', '12h', '24h', '3d', '7d', '30d'].map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                    range === r 
                                    ? 'bg-white text-black shadow-lg shadow-white/10' 
                                    : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard 
                        title="Total Recipes" 
                        value={stats?.totals?.recipes} 
                        icon={<FiFileText className="text-emerald-500" />} 
                    />
                    <StatCard 
                        title="Active Users" 
                        value={stats?.totals?.users} 
                        icon={<FiUsers className="text-blue-500" />} 
                    />
                    <StatCard 
                        title="Search Logs" 
                        value={stats?.totals?.searchLogs} 
                        icon={<FiSearch className="text-purple-500" />} 
                    />
                    <StatCard 
                        title="Avg API Load" 
                        value={`${((stats?.apiUsage?.reduce((a: any, b: any) => a + b.callCount, 0) || 0) / apiHours).toFixed(1)}/hr`} 
                        icon={<FiActivity className="text-orange-500" />} 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* API Usage Chart */}
                    <div className="lg:col-span-2 glass-card">
                        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-6 flex justify-between">
                            <span>API Usage Over Time</span>
                            <span className="text-[10px] text-gray-500">{range}</span>
                        </h3>
                        <div className="h-[300px]">
                            <Line 
                                data={apiUsageData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
                                    plugins: { legend: { labels: { color: '#94a3b8' } } }
                                }} 
                            />
                        </div>
                    </div>

                    {/* Key Distribution Chart */}
                    <div className="glass-card">
                        <h3 className="text-sm font-black uppercase tracking-widest text-blue-500 mb-6">Key Usage Comparison</h3>
                        <div className="h-[300px] flex items-center justify-center">
                            <Pie 
                                data={keyComparisonData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
                                }} 
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Extraction vs Cache Chart */}
                    <div className="glass-card">
                        <h3 className="text-sm font-black uppercase tracking-widest text-yellow-500 mb-6 flex justify-between">
                            <span>Ingredient Retrieval</span>
                            <span className="text-[10px] text-gray-500">{range}</span>
                        </h3>
                        <div className="h-[300px]">
                            <Line 
                                data={extractionData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
                                    plugins: { legend: { labels: { color: '#94a3b8' } } }
                                }} 
                            />
                        </div>
                    </div>

                    {/* Database Growth Chart */}
                    <div className="glass-card">
                        <h3 className="text-sm font-black uppercase tracking-widest text-purple-500 mb-6 flex justify-between">
                            <span>Record Growth</span>
                            <span className="text-[10px] text-gray-500">Last 30 Days</span>
                        </h3>
                        <div className="h-[300px]">
                            <Line 
                                data={growthData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false,
                                    scales: { 
                                        yRecipes: { 
                                            type: 'linear',
                                            display: true,
                                            position: 'left',
                                            beginAtZero: true,
                                            grid: { color: 'rgba(255,255,255,0.05)' },
                                            title: { display: true, text: 'Recipes', color: '#10b981' },
                                            ticks: { color: '#10b981' }
                                        },
                                        yUsers: {
                                            type: 'linear',
                                            display: true,
                                            position: 'right',
                                            beginAtZero: true,
                                            grid: { display: false },
                                            title: { display: true, text: 'Users', color: '#3b82f6' },
                                            ticks: { color: '#3b82f6' }
                                        },
                                        x: { grid: { display: false } }
                                    },
                                    plugins: { legend: { labels: { color: '#94a3b8' } } }
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatCard({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) {
    return (
        <div className="glass-card flex items-center gap-6 p-6">
            <div className="p-4 bg-white/5 rounded-2xl text-2xl">
                {icon}
            </div>
            <div>
                <div className="text-xs font-bold text-muted-foreground uppercase mb-1">{title}</div>
                <div className="text-3xl font-black tracking-tight">{value?.toLocaleString() || '0'}</div>
            </div>
        </div>
    );
}
