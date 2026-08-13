import React, { useEffect, useState, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { useAdminGuard } from '../../lib/useAdminGuard'

interface ProviderState {
    name: string;
    disabled: boolean;
    reason: string;
}

const PROVIDER_INFO: Record<string, { display: string; image: string }> = {
    'WW': { display: 'Woolworths', image: '/WW.png' },
    'Coles': { display: 'Coles', image: '/Coles.png' },
    'Aldi': { display: 'Aldi', image: '/Aldi.png' },
    'IGA': { display: 'IGA', image: '/IGA.png' },
    'Panetta': { display: 'Panetta', image: '/Panetta.png' },
};

export default function AdminSettings() {
    const isAuthorized = useAdminGuard();
    const [providers, setProviders] = useState<ProviderState[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const fetchProviders = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/admin/providers', { headers: { 'edgetoken': token || '' } });
            const data = await res.json();
            if (data.success) setProviders(data.data || []);
            else alert(data.message || 'Failed to load providers');
        } catch (e: any) {
            alert('Load failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isAuthorized) fetchProviders(); }, [isAuthorized, fetchProviders]);

    const updateProvider = (name: string, patch: Partial<ProviderState>) => {
        setProviders(prev => prev.map(p => p.name === name ? { ...p, ...patch } : p));
    };

    const saveProvider = async (provider: ProviderState) => {
        setSavingId(provider.name);
        const token = localStorage.getItem('Token');
        try {
            const res = await fetch('/api/admin/providers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({ name: provider.name, disabled: provider.disabled, reason: provider.reason })
            });
            const data = await res.json();
            if (!data.success) alert(data.message || 'Save failed');
        } catch (e: any) {
            alert('Save failed: ' + e.message);
        } finally {
            setSavingId(null);
        }
    };

    if (!isAuthorized) return null;

    const enabledCount = providers.filter(p => !p.disabled).length;

    return (
        <Layout title="Admin Settings" description="Site-wide settings for administrators">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                <PageHeader title="Admin Settings" />

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Shopping Providers</div>
                        <div className="text-2xl font-black">{enabledCount}/{providers.length} enabled</div>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[16rem] text-right">
                        Disabled providers will be skipped for all ingredient searches.
                    </p>
                </div>

                <div className="text-sm text-muted-foreground">
                    Use this to temporarily disable a provider whose API is broken (e.g. schema changes). All requests
                    to a disabled provider are blocked until re-enabled.
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading...</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
                        <div className="divide-y divide-white/5">
                            {providers.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground text-sm">No providers found.</div>
                            ) : providers.map(provider => {
                                const info = PROVIDER_INFO[provider.name] || { display: provider.name, image: '' };
                                return (
                                    <div key={provider.name} className="px-4 md:px-6 py-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {info.image && (
                                                    <img src={info.image} alt={info.display} className="w-8 h-8 rounded-lg object-contain bg-white/10" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-bold text-sm">{info.display}</div>
                                                    <div className={`text-[9px] font-black uppercase tracking-widest ${provider.disabled ? 'text-destructive' : 'text-emerald-400'}`}>
                                                        {provider.disabled ? 'Disabled' : 'Enabled'}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => saveProvider({ ...provider, disabled: !provider.disabled })}
                                                disabled={savingId === provider.name}
                                                className={`relative shrink-0 inline-flex items-center h-8 w-14 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                                    provider.disabled ? 'bg-destructive/70' : 'bg-emerald-500'
                                                } disabled:opacity-50`}
                                                title={provider.disabled ? `Enable ${info.display}` : `Disable ${info.display}`}
                                            >
                                                <span className={`inline-block w-6 h-6 transform rounded-full bg-white shadow transition-transform ${provider.disabled ? 'translate-x-1' : 'translate-x-7'}`} />
                                            </button>
                                        </div>
                                        {provider.disabled && (
                                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={provider.reason}
                                                    onChange={e => updateProvider(provider.name, { reason: e.target.value })}
                                                    placeholder="Reason (e.g. API schema changed)"
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px]"
                                                />
                                                <button
                                                    onClick={() => saveProvider(provider)}
                                                    disabled={savingId === provider.name}
                                                    className="shrink-0 px-4 h-10 bg-emerald-500 text-black font-black uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 min-h-[40px]"
                                                >
                                                    {savingId === provider.name ? 'Saving...' : 'Save Reason'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
