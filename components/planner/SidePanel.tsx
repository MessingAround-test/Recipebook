'use client';

import RecipePool from './RecipePool';
import PantryPanel from './PantryPanel';
import DietaryPanel from './DietaryPanel';
import { usePlanner } from './PlannerContext';
import type { RailTab } from './usePlan';

/**
 * Unified Library / Pantry / Diet panel. Renders one tab's content without
 * its own tab bar when `embedded` (bottom tabs own navigation on mobile);
 * standalone mode shows the rail tab switcher (desktop right column).
 */
export default function SidePanel({ tab, embedded = false }: { tab?: RailTab; embedded?: boolean }) {
    const { railTab, setRailTab } = usePlanner();
    const active: RailTab = tab || railTab;

    const content = (
        <div className="w-full">
            {active === 'library' && <RecipePool />}
            {active === 'pantry' && <PantryPanel />}
            {active === 'diet' && <DietaryPanel />}
        </div>
    );

    if (embedded) return content;

    return (
        <div className="w-full flex flex-col min-h-0">
            <div className="flex gap-1 mb-3 shrink-0">
                {(['library', 'pantry', 'diet'] as RailTab[]).map(t => (
                    <button
                        key={t}
                        onClick={() => setRailTab(t)}
                        className={`flex-1 text-[10px] font-black uppercase tracking-widest px-2 py-2 rounded-lg transition-all capitalize ${active === t
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 border border-transparent'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
            <div className="flex-1 min-h-0">{content}</div>
        </div>
    );
}
