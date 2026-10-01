'use client';

import { useEffect, useRef } from 'react';
import { FiCalendar, FiBookOpen, FiCoffee, FiActivity } from 'react-icons/fi';
import { usePlanner } from './PlannerContext';
import { PlannerTab } from './usePlan';

const TABS: { key: PlannerTab; label: string; icon: any }[] = [
    { key: 'plan', label: 'Plan', icon: FiCalendar },
    { key: 'library', label: 'Library', icon: FiBookOpen },
    { key: 'pantry', label: 'Pantry', icon: FiCoffee },
    { key: 'diet', label: 'Diet', icon: FiActivity }
];

/**
 * Mobile bottom tab bar (Plan · Library · Pantry · Diet), stacked above the
 * global app taskbar. Desktop gets the header segmented control instead.
 */
export default function PlannerTabs() {
    const { plannerTab, setPlannerTab, undecidedRecipes } = usePlanner();

    // Publish the toolbar height so popups can anchor flush to its top edge
    const ref = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const publish = () => document.documentElement.style.setProperty('--planner-tabs-h', `${el.getBoundingClientRect().height}px`);
        publish();
        const ro = new ResizeObserver(publish);
        ro.observe(el);
        window.addEventListener('resize', publish);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', publish);
            document.documentElement.style.removeProperty('--planner-tabs-h');
        };
    }, []);

    return (
        <nav
            ref={ref}
            className="xl:hidden fixed z-[80] left-0 right-0 flex justify-around items-stretch bg-[#121214]/95 backdrop-blur-md border-t border-white/10"
            style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
            aria-label="Planner sections"
        >
            {TABS.map(t => {
                const active = plannerTab === t.key || (t.key === 'plan' && plannerTab === 'week');
                return (
                    <button
                        key={t.key}
                        onClick={() => setPlannerTab(t.key)}
                        className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[4rem] transition-colors ${active ? 'text-emerald-400' : 'text-muted-foreground hover:text-white'}`}
                        aria-current={active ? 'page' : undefined}
                    >
                        {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
                        <t.icon size={20} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                        {t.key === 'library' && undecidedRecipes.length > 0 && (
                            <span className="absolute top-1 right-1/2 translate-x-5 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-black leading-none border border-[#121214]">
                                {undecidedRecipes.length}
                            </span>
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
