import { useState } from 'react';
import { FiCoffee, FiActivity, FiBookOpen } from 'react-icons/fi';
import RecipePool from './RecipePool';
import PantryPanel from './PantryPanel';
import InsightsPanel from './InsightsPanel';

type Tab = 'library' | 'pantry' | 'insights';

const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'library', label: 'Library', icon: FiBookOpen },
    { key: 'pantry', label: 'Pantry', icon: FiCoffee },
    { key: 'insights', label: 'Insights', icon: FiActivity }
];

export default function SidePanel() {
    const [tab, setTab] = useState<Tab>('library');

    return (
        <div className="w-full">
            <div className="flex gap-1 mb-4 p-1 rounded-xl bg-black/20 border border-white/5">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-2 rounded-lg transition-all ${tab === t.key
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent'}`}
                    >
                        <t.icon size={12} /> {t.label}
                    </button>
                ))}
            </div>
            {tab === 'library' && <RecipePool />}
            {tab === 'pantry' && <PantryPanel />}
            {tab === 'insights' && <InsightsPanel />}
        </div>
    );
}
