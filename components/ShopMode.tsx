import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Undo2, ChevronDown, ChevronLeft, ChevronRight, Play, RotateCcw, PauseCircle } from 'lucide-react';
import {
    SHOP_MODE_GROUPING_CHOICES,
    SHOP_MODE_GROUPING_NONE,
    SHOP_MODE_STORAGE_KEY,
    SHOP_MODE_SESSION_KEY,
    buildSections,
    comeBackCount,
    flattenLeaves,
    isHeldOff,
    isResolved,
    leafItems,
    leafQuantityDisplay,
    outstandingCount,
    passSummary,
    summarizeGroupingChoice,
} from '../lib/shopMode';
import { getStoredOrder } from '../lib/woolworthsOrder';
import { getColorForCategory } from '../lib/colors';
import { noteForDisplay } from '../lib/notes';
import { renderFractions } from './Fraction';

const GROUPING_LABELS: Record<string, string> = {
    none: 'No grouping',
    category_simple: 'Aisle (Simple)',
    category: 'Aisle (Complicated)',
    supplier: 'Store',
    recipe_name: 'Recipe',
    planning: 'Pre-shop helper',
    quantity_type: 'Measure',
    price_category: 'Price tier',
};

const RECOMMENDED_GROUPINGS = ['category_simple', 'category', 'planning', SHOP_MODE_GROUPING_NONE];

const GROUPING_BLURBS: Record<string, string> = {
    none: 'One long list, top to bottom — no sections to pick.',
    category_simple: 'Big departments in walk order — the quick lap of the shop.',
    category: 'Fine aisles that take you exactly where you need to go.',
    planning: 'Before you leave: skip what the pre-shop plan says you already have.',
    supplier: 'Bundle up by store for multi-shop runs.',
    recipe_name: 'One recipe at a time, start to finish.',
    quantity_type: 'All the grams together, all the eaches together.',
    price_category: 'Hit the specials and budget items first.',
};

interface ShopModeProps {
    show: boolean;
    listName?: string;
    items: any[];
    onResolveLeaf: (leaf: any, updates: { complete?: boolean; cantFind?: boolean }) => Promise<string | void>;
    onResetAll: () => Promise<string | void>;
    onClose: () => void;
    onFinishList: () => void;
}

interface SectionRef {
    key: string;
    label: string;
}

interface Section {
    key: string;
    label: string;
    items: any[];
    unresolved?: number;
}

type Location = 'setup' | 'grouping' | 'choose' | 'section' | 'pass-complete' | 'done';

interface SessionSnapshot {
    groupBy: string;
    location: 'choose' | 'section' | 'pass-complete';
    pass: number;
    sectionKey?: string;
    sectionLabel?: string;
}

function saveSessionSnapshot(snapshot: SessionSnapshot) {
    try { localStorage.setItem(SHOP_MODE_SESSION_KEY, JSON.stringify(snapshot)); } catch { /* ignore */ }
}

export default function ShopMode({ show, listName, items, onResolveLeaf, onResetAll, onClose, onFinishList }: ShopModeProps) {
    const [location, setLocation] = useState<Location>('setup');
    const [pendingGroupBy, setPendingGroupBy] = useState<string>(SHOP_MODE_GROUPING_NONE);
    const [groupBy, setGroupBy] = useState<string | null>(null);
    const [passNumber, setPassNumber] = useState(1);
    const [currentSection, setCurrentSection] = useState<SectionRef | null>(null);
    const [chooserFromKey, setChooserFromKey] = useState<string | null>(null);
    const [showOthers, setShowOthers] = useState(false);
    const [busyLeafId, setBusyLeafId] = useState<string | null>(null);
    const [isResettingPass, setIsResettingPass] = useState(false);

    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
            let stored: string | null = null;
            try {
                stored = localStorage.getItem(SHOP_MODE_STORAGE_KEY);
            } catch { /* ignore */ }
            setPendingGroupBy(stored && SHOP_MODE_GROUPING_CHOICES.includes(stored) ? stored : SHOP_MODE_GROUPING_NONE);
            setGroupBy(null);
            setCurrentSection(null);
            setChooserFromKey(null);
            setShowOthers(false);
            setPassNumber(1);
            // Reset the flow too — staying on 'section' after a reopen would
            // render renderSection() with a null currentSection.
            setLocation('setup');
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [show]);

    useEffect(() => {
        if (!show) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [show, onClose]);

    const groupingSummaries = useMemo(
        () => SHOP_MODE_GROUPING_CHOICES.map(choice => ({
            groupBy: choice,
            ...summarizeGroupingChoice(items, choice, getStoredOrder()),
        })),
        [items]
    );

    const sections: Section[] = useMemo(
        () => (groupBy ? buildSections(items, groupBy, getStoredOrder()) : []),
        [items, groupBy]
    );

    const outstanding = useMemo(() => outstandingCount(items), [items]);
    const comebacks = useMemo(() => comeBackCount(items), [items]);
    const summary = useMemo(() => passSummary(items), [items]);
    const resolvedLeaves = summary.total - outstanding;

    if (!show) return null;

    const summaryFor = (choice: string) =>
        groupingSummaries.find(s => s.groupBy === choice) || { groupBy: choice, sectionCount: 0, itemCount: 0, heldCount: 0, heldSectionCount: 0 };

    const enterMainSection = (section: Section) => {
        setCurrentSection({ key: section.key, label: section.label });
        setShowOthers(false);
        setChooserFromKey(null);
        setLocation('section');
        saveSessionSnapshot({ groupBy: groupBy!, location: 'section', pass: passNumber, sectionKey: section.key, sectionLabel: section.label });
    };

    const exitToMainChooser = () => {
        setChooserFromKey(currentSection ? currentSection.key : null);
        setCurrentSection(null);
        setLocation('choose');
        saveSessionSnapshot({ groupBy: groupBy!, location: 'choose', pass: passNumber });
    };

    const goToPassComplete = () => {
        setCurrentSection(null);
        setLocation('pass-complete');
        saveSessionSnapshot({ groupBy: groupBy!, location: 'pass-complete', pass: passNumber });
    };

    const startShopping = (choiceOverride?: string) => {
        const choice = choiceOverride || pendingGroupBy;
        try { localStorage.setItem(SHOP_MODE_STORAGE_KEY, choice); } catch { /* ignore */ }
        setPendingGroupBy(choice);
        setGroupBy(choice);
        setShowOthers(false);
        setChooserFromKey(null);

        // One section: walk straight into it. Otherwise: the picker. No
        // session resume — every start is a fresh walk.
        const secs = buildSections(items, choice, getStoredOrder());
        if (secs.length === 1) {
            setCurrentSection({ key: secs[0].key, label: secs[0].label });
            setLocation('section');
            saveSessionSnapshot({ groupBy: choice, location: 'section', pass: 1, sectionKey: secs[0].key, sectionLabel: secs[0].label });
            return;
        }

        if (secs.length > 0) {
            setCurrentSection(null);
            setLocation('choose');
            saveSessionSnapshot({ groupBy: choice, location: 'choose', pass: 1 });
        } else if (comebacks > 0) {
            setLocation('pass-complete');
            saveSessionSnapshot({ groupBy: choice, location: 'pass-complete', pass: 1 });
        } else {
            setLocation('done');
            saveSessionSnapshot({ groupBy: choice, location: 'choose', pass: 1 });
        }
    };

    const markGot = async (leaf: any) => {
        setBusyLeafId(leaf._id);
        try {
            await onResolveLeaf(leaf, { complete: true, cantFind: false });
        } finally {
            setBusyLeafId(null);
        }
    };

    const markHoldOff = async (leaf: any) => {
        setBusyLeafId(leaf._id);
        try {
            await onResolveLeaf(leaf, { cantFind: true });
        } finally {
            setBusyLeafId(null);
        }
    };

    const startNextPass = async () => {
        const held = flattenLeaves(items).filter(isHeldOff);
        setIsResettingPass(true);
        for (const leaf of held) {
            await onResolveLeaf(leaf, { cantFind: false });
        }
        setIsResettingPass(false);
        setPassNumber(passNumber + 1);
        setLocation('choose');
        saveSessionSnapshot({ groupBy: groupBy!, location: 'choose', pass: passNumber + 1 });
    };

    const resetAll = async () => {
        if (!confirm(`Clear held-off marks on ${comebacks} item${comebacks === 1 ? '' : 's'}? They go back to the active list — anything marked as got stays got.`)) return;
        setBusyLeafId('resetting');
        try {
            await onResetAll();
        } finally {
            setBusyLeafId(null);
            setGroupBy(null);
            setCurrentSection(null);
            setLocation('setup');
        }
    };

    const sectionColor = (key: string) => getColorForCategory(key) || 'var(--accent)';

    const sortRows = (rows: any[]) =>
        rows.slice().sort((a, b) => String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()));

    const renderLeaf = (leaf: any) => {
        const isBusy = busyLeafId === leaf._id;
        return (
            <div key={leaf._id} className="group flex items-center gap-3 rounded-xl bg-water/[0.04] px-3 py-2.5 transition-colors hover:bg-water/[0.08]">
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => markGot(leaf)}
                    aria-label={`Got ${leaf.name}`}
                    title="Got it"
                    className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 border-water/50 text-water/70 hover:bg-water hover:text-white transition-all active:scale-90"
                >
                    <Check size={20} strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] leading-tight text-foreground truncate">{leaf.name}</div>
                    {noteForDisplay(leaf.note) && (
                        <div className="text-[10px] italic text-muted-foreground mt-0.5 truncate">[{noteForDisplay(leaf.note)}]</div>
                    )}
                </div>
                <span className="shrink-0 text-lg font-black text-foreground tabular-nums text-right leading-none">
                    {renderFractions(leafQuantityDisplay(leaf))}
                </span>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => markHoldOff(leaf)}
                    title="Hold off — pick it up on a later pass"
                    className="shrink-0 flex items-center gap-1 p-2 rounded-lg text-butter/60 hover:text-butter hover:bg-butter/10 transition-all active:scale-95"
                    aria-label={`Hold off on ${leaf.name}`}
                >
                    <Undo2 size={15} />
                    <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Hold off</span>
                </button>
            </div>
        );
    };

    const gotAllInGroup = async (entry: any) => {
        const outstandingSubs = leafItems(entry).filter((sub: any) => !isResolved(sub));
        for (const sub of outstandingSubs) {
            await markGot(sub);
        }
    };

    const renderSubLeaf = (sub: any) => {
        const isBusy = busyLeafId === sub._id;
        return (
            <div key={sub._id} className={`flex items-center gap-2.5 ${sub.complete ? 'opacity-50' : ''}`}>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => markGot(sub)}
                    aria-label={`Got ${sub.name}`}
                    title="Got it"
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 border-water/50 text-water/70 hover:bg-water hover:text-white transition-all active:scale-90"
                >
                    <Check size={15} strokeWidth={3} />
                </button>
                <div className="flex-1 min-w-0 text-[13px] text-foreground">
                    <span className={sub.complete ? 'line-through' : ''}>{sub.name}</span>
                    {sub.complete && <span className="text-[9px] font-black uppercase tracking-widest text-water/80 ml-1.5">Got</span>}
                    {noteForDisplay(sub.note, { isGroup: true }) && (
                        <div className="text-[10px] italic text-muted-foreground mt-0.5 truncate">[{noteForDisplay(sub.note, { isGroup: true })}]</div>
                    )}
                </div>
                {!sub.complete && (
                    <>
                        <span className="shrink-0 text-sm font-bold text-foreground tabular-nums text-right leading-none">
                            {renderFractions(leafQuantityDisplay(sub))}
                        </span>
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => markHoldOff(sub)}
                            title="Hold off — pick it up on a later pass"
                            className="shrink-0 p-2 rounded-lg text-butter/60 hover:text-butter hover:bg-butter/10 transition-all active:scale-95"
                            aria-label={`Hold off on ${sub.name}`}
                        >
                            <Undo2 size={14} />
                        </button>
                    </>
                )}
            </div>
        );
    };

    const renderGroupCard = (entry: any) => {
        const entryLeaves: any[] = leafItems(entry);
        const outstandingSubs = entryLeaves.filter((sub: any) => !isResolved(sub));
        const totalQty = entry.totalString || leafQuantityDisplay(entry);
        return (
            <div className="group rounded-xl bg-water/[0.04] px-3 py-2.5 flex flex-col gap-2 transition-colors hover:bg-water/[0.08]">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={busyLeafId !== null}
                        onClick={() => gotAllInGroup(entry)}
                        aria-label={`Got all ${entry.name}`}
                        title="Got all remaining in this group"
                        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 border-water/50 text-water/70 hover:bg-water hover:text-white transition-all active:scale-90"
                    >
                        <Check size={20} strokeWidth={3} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-[15px] leading-tight text-foreground truncate">{entry.name}</div>
                        <div className="text-[11px] text-muted-foreground">{outstandingSubs.length} of {entryLeaves.length} left</div>
                    </div>
                    <span className="shrink-0 text-lg font-black text-foreground tabular-nums text-right leading-none">
                        {renderFractions(totalQty)}
                    </span>
                </div>
                <div className="flex flex-col gap-1.5 border-l-2 border-border/60 pl-3 ml-4">
                    {sortRows(entryLeaves).map((sub: any) => renderSubLeaf(sub))}
                </div>
            </div>
        );
    };

    const pickGroupingNow = (choice: string) => {
        try { localStorage.setItem(SHOP_MODE_STORAGE_KEY, choice); } catch { /* ignore */ }
        setGroupBy(choice);
        setShowOthers(false);
        setChooserFromKey(null);

        // Only one section left? Skip the picker and walk straight into it.
        const secs = buildSections(items, choice, getStoredOrder());
        if (secs.length === 1) {
            setCurrentSection({ key: secs[0].key, label: secs[0].label });
            setLocation('section');
            saveSessionSnapshot({ groupBy: choice, location: 'section', pass: passNumber, sectionKey: secs[0].key, sectionLabel: secs[0].label });
            return;
        }

        setCurrentSection(null);
        setLocation('choose');
        saveSessionSnapshot({ groupBy: choice, location: 'choose', pass: passNumber });
    };

    const leaveGroupingScreen = () => {
        if (comebacks > 0 && outstanding === 0) setLocation('pass-complete');
        else if (outstanding > 0) setLocation('choose');
        else if (comebacks > 0) setLocation('pass-complete');
        else setLocation('done');
    };

    const renderGroupingRow = (s: any, onPick: (groupBy: string) => void) => {
        const usable = s.itemCount > 0 || s.heldCount > 0;
        return (
            <button
                key={s.groupBy}
                type="button"
                onClick={() => onPick(s.groupBy)}
                disabled={!usable}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-water/[0.04] text-left transition-all active:scale-[0.98] hover:border-water/30 hover:bg-water/[0.07]"
            >
                <span className="min-w-0">
                    <span className="block text-[13px] font-black uppercase tracking-widest text-foreground">{GROUPING_LABELS[s.groupBy] || s.groupBy}</span>
                    <span className="block text-[10.5px] leading-snug text-muted-foreground font-medium mt-0.5">{GROUPING_BLURBS[s.groupBy] || ''}</span>
                </span>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-water text-right tabular-nums">
                    {s.itemCount > 0 ? `${s.sectionCount}` : ''}
                </span>
            </button>
        );
    };

    const renderGroupingChips = (onPick: (groupBy: string) => void) => {
        const recommended = groupingSummaries.filter((s: any) => RECOMMENDED_GROUPINGS.includes(s.groupBy));
        const rest = groupingSummaries.filter((s: any) => !RECOMMENDED_GROUPINGS.includes(s.groupBy));
        return (
            <div className="flex flex-col gap-2">
                {recommended.map((s: any) => renderGroupingRow(s, onPick))}
                {rest.some((s: any) => s.itemCount > 0 || s.heldCount > 0) && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        {rest.map((s: any) => (
                            <button
                                key={s.groupBy}
                                type="button"
                                onClick={() => onPick(s.groupBy)}
                                disabled={!(s.itemCount > 0 || s.heldCount > 0)}
                                title={GROUPING_BLURBS[s.groupBy] || ''}
                                className="flex flex-col items-start gap-0.5 px-2 py-1.5 rounded-lg text-left transition-all active:scale-95 text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-foreground/[0.04] disabled:opacity-30"
                            >
                                <span className="text-[9px] font-bold uppercase tracking-widest">{GROUPING_LABELS[s.groupBy] || s.groupBy}</span>
                                <span className="text-[9px] font-medium leading-snug">{GROUPING_BLURBS[s.groupBy] || ''}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderChangeGrouping = () => (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-muted-foreground m-0">How do you want to group the list?</p>
            {renderGroupingChips((groupBy) => pickGroupingNow(groupBy))}
            <button type="button" onClick={leaveGroupingScreen} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                Cancel
            </button>
        </div>
    );

    const renderSetup = () => (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-muted-foreground m-0">How do you want to walk the store?</p>
            {renderGroupingChips((groupBy) => startShopping(groupBy))}
            <button
                type="button"
                onClick={resetAll}
                disabled={busyLeafId === 'resetting' || comebacks === 0}
                className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
                <RotateCcw size={11} />
                {busyLeafId === 'resetting' ? 'Clearing held-off items…' : `Clear held-off items (${comebacks})`}
            </button>
        </div>
    );

    const stepSection = (dir: 1 | -1) => {
        if (!currentSection || sections.length === 0) return;
        const idx = sections.findIndex(s => s.key === currentSection.key);
        const next = sections[(idx + dir + sections.length) % sections.length];
        setShowOthers(false);
        setChooserFromKey(null);
        setCurrentSection({ key: next.key, label: next.label });
        saveSessionSnapshot({ groupBy: groupBy!, location: 'section', pass: passNumber, sectionKey: next.key, sectionLabel: next.label });
    };

    const renderSection = () => {
        if (!currentSection) {
            // Defensive: 'section' location without a chosen section (e.g. a
            // stale state race) — fall back to the picker instead of crashing.
            return renderChoose();
        }
        const rows = sections.find(s => s.key === currentSection.key)?.items || [];
        const sectionDone = rows.length === 0;
        const pct = Math.round((resolvedLeaves / Math.max(summary.total, 1)) * 100);
        return (
            <div className="flex flex-col gap-4">
                <div className="rounded-xl p-3 pb-3.5 bg-foreground/[0.03]">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <button
                            type="button"
                            onClick={() => stepSection(-1)}
                            disabled={sections.length <= 1}
                            aria-label="Previous section"
                            className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="flex-1 min-w-0 text-xl font-black tracking-tight m-0 truncate text-center" style={{ color: sectionColor(currentSection!.key) }}>{currentSection!.label}</h2>
                        <button
                            type="button"
                            onClick={() => stepSection(1)}
                            disabled={sections.length <= 1}
                            aria-label="Next section"
                            className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    {comebacks > 0 && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center m-0 mb-1.5">{comebacks} held off</p>
                    )}
                    <div className="relative h-5 rounded-md bg-water/5 border border-water/20 overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 rounded-r-md bg-water/70 transition-all"
                            style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-wide text-foreground">{pct}%</span>
                    </div>
                </div>

                {sectionDone ? (
                    <div className="text-center py-8 rounded-xl border border-water/20 bg-water/5">
                        <p className="text-sm font-black uppercase tracking-widest text-water m-0">Section cleared</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{comebacks > 0 ? 'You held off some things for a later pass.' : 'Nothing left in this section.'}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {sortRows(rows).map((entry: any) =>
                            entry.items && entry.items.length > 0 ? renderGroupCard(entry) : renderLeaf(entry)
                        )}
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 pt-1">
                    {(sectionDone || sections.length > 1) && (
                        <button
                            type="button"
                            onClick={() => {
                                if (sectionDone && sections.length === 0) {
                                    if (comebacks > 0) goToPassComplete();
                                    else setLocation('done');
                                } else {
                                    exitToMainChooser();
                                }
                            }}
                            className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${sectionDone ? 'btn-modern !bg-water hover:!bg-water/85 text-primary-foreground shadow-lg shadow-water/20' : 'border border-border text-foreground/70 hover:bg-foreground/5'}`}
                        >
                            {sectionDone
                                ? (sections.length > 0
                                    ? <>Next: {sections[0].label} <ChevronRight size={14} /></>
                                    : comebacks > 0
                                        ? <>Finish this pass <ChevronRight size={14} /></>
                                        : <>Finish up <ChevronRight size={14} /></>)
                                : <>Back to sections ({sections.length}) <ChevronRight size={14} /></>}
                        </button>
                    )}
                    <button type="button" onClick={() => { setCurrentSection(null); setLocation('grouping'); }} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Change grouping
                    </button>
                </div>
            </div>
        );
    };

    const renderSectionPicker = ({
        heading,
        subtitle,
        pickerSections,
        fromKey,
        onPick,
        countLabel = 'to get',
    }: {
        heading: string;
        subtitle?: string;
        pickerSections: Section[];
        fromKey?: string | null;
        countLabel?: string;
        onPick: (section: Section) => void;
    }) => {
        const suggested = pickerSections[0];
        // Only fold into "Other sections" when there are too many to scan
        // comfortably — 8 or fewer always shows in full.
        const expanded = pickerSections.length > 8 ? 3 : pickerSections.length;
        const nearby = pickerSections.slice(1, expanded);
        const others = pickerSections.slice(expanded);
        const leftBehind = fromKey ? pickerSections.find(s => s.key === fromKey) : null;
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-black tracking-tight text-foreground m-0">{heading}</h2>
                </div>
                {subtitle && <p className="text-[11px] text-muted-foreground m-0">{subtitle}</p>}
                {leftBehind && (
                    <p className="text-[11px] text-muted-foreground m-0">
                        {leftBehind.items.length} item{leftBehind.items.length === 1 ? '' : 's'} left in {leftBehind.label}.
                    </p>
                )}
                {[suggested, ...nearby].filter(Boolean).map((section: Section, idx: number) => (
                    <button
                        key={section.key}
                        type="button"
                        onClick={() => onPick(section)}
                        className="flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.04] hover:bg-foreground/[0.07] hover:border-foreground/25 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
                    >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: sectionColor(section.key) }} />
                        <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-[15px] text-foreground truncate">{section.label}</span>
                                {idx === 0 && (
                                    <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded bg-water/15 text-water uppercase tracking-widest">Suggested</span>
                                )}
                            </span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">{section.unresolved ?? section.items.length} {countLabel}</span>
                        </span>
                        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>
                ))}
                {others.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => setShowOthers(!showOthers)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground w-fit"
                        >
                            <ChevronDown size={13} className={`transition-transform ${showOthers ? 'rotate-180' : ''}`} />
                            Other sections ({others.length})
                        </button>
                        {showOthers && others.map((section: Section) => (
                            <button
                                key={section.key}
                                type="button"
                                onClick={() => onPick(section)}
                                className="flex items-center justify-between rounded-lg border border-border bg-foreground/[0.02] px-3 py-2 text-left hover:bg-foreground/[0.06] transition-all active:scale-[0.98]"
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sectionColor(section.key) }} />
                                    <span className="text-[13px] font-bold text-foreground truncate">{section.label}</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{section.unresolved ?? section.items.length}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderChoose = () => {
        if (sections.length === 0) {
            return (
                <div className="flex flex-col items-center gap-4 py-6">
                    <p className="text-sm font-black uppercase tracking-widest text-water m-0">Nothing left to get</p>
                    {comebacks > 0 ? (
                        <button
                            type="button"
                            onClick={goToPassComplete}
                            className="btn-modern !bg-water hover:!bg-water/85 text-primary-foreground px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-water/20"
                        >
                            <PauseCircle size={14} /> Review held-off items ({comebacks})
                        </button>
                    ) : (
                        <button type="button" onClick={() => setLocation('done')} className="btn-modern !bg-water hover:!bg-water/85 text-primary-foreground px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs">
                            Finish up
                        </button>
                    )}
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-3">
                {renderSectionPicker({
                    heading: "What's next?",
                    pickerSections: sections,
                    fromKey: chooserFromKey,
                    onPick: enterMainSection,
                })}
                <button type="button" onClick={() => { setChooserFromKey(null); setLocation('grouping'); }} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Change grouping
                </button>
            </div>
        );
    };

    const renderPassComplete = () => {
        const heldLeafs = sortRows(flattenLeaves(items).filter(isHeldOff));
        return (
            <div className="flex flex-col gap-4">
                <div className="rounded-xl p-4 border border-butter/20 bg-butter/5">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xl font-black tracking-tight text-butter m-0">Pass {passNumber} complete</h2>
                        <span className="text-[9px] font-black uppercase tracking-widest text-butter/80 shrink-0">{comebacks} held off</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 m-0 mb-1">
                        {summary.got} got this run. Start another pass to try the held-off items again.
                    </p>
                </div>

                {heldLeafs.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-water/20 bg-water/5">
                        <p className="text-sm font-black uppercase tracking-widest text-water m-0">All come-backs resolved</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {heldLeafs.map(leaf => (
                            <div key={leaf._id} className="flex items-center gap-3 rounded-xl bg-butter/[0.05] px-3 py-2.5">
                                <button
                                    type="button"
                                    disabled={busyLeafId === leaf._id}
                                    onClick={() => markGot(leaf)}
                                    aria-label={`Got ${leaf.name}`}
                                    title="Found it after all"
                                    className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 border-water/50 text-water/70 hover:bg-water hover:text-white transition-all active:scale-90"
                                >
                                    <Check size={20} strokeWidth={3} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[15px] leading-tight text-foreground truncate">{leaf.name}</div>
                                    {noteForDisplay(leaf.note) && (
                                        <div className="text-[10px] italic text-muted-foreground mt-0.5 truncate">[{noteForDisplay(leaf.note)}]</div>
                                    )}
                                </div>
                                <span className="shrink-0 text-lg font-black text-foreground tabular-nums text-right leading-none">
                                    {renderFractions(leafQuantityDisplay(leaf))}
                                </span>
                                <span className="shrink-0" title="Held off">
                                    <PauseCircle size={20} className="text-butter" />
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                        type="button"
                        disabled={isResettingPass || comebacks === 0}
                        onClick={startNextPass}
                        className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${comebacks > 0 ? 'btn-modern !bg-water hover:!bg-water/85 text-primary-foreground shadow-lg shadow-water/20 disabled:opacity-40' : 'invisible'}`}
                    >
                        {isResettingPass ? 'Clearing held items…' : <>Start pass {passNumber + 1} ({comebacks} items) <ChevronRight size={14} /></>}
                    </button>
                    <button type="button" onClick={onClose} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Finish for now
                    </button>
                    <button type="button" onClick={() => setLocation('grouping')} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                        Change grouping
                    </button>
                </div>
            </div>
        );
    };

    const renderDone = () => (
        <div className="flex flex-col items-center gap-5 py-10">
            <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-black tracking-tight text-foreground m-0">Everything&apos;s done</h2>
                <p className="text-[11px] text-muted-foreground mt-1">{listName || 'Shopping list'} — {summary.total} item{summary.total === 1 ? '' : 's'} got.</p>
            </div>
            <button
                type="button"
                onClick={onFinishList}
                className="btn-modern !bg-water hover:!bg-water/85 text-primary-foreground w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-water/20"
            >
                Close off this list
            </button>
            <button type="button" onClick={onClose} className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                Back to the list
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[1100] flex flex-col bg-background">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                <div className="flex flex-col min-w-0">
                    <h2 className="text-base font-bold tracking-tight text-foreground truncate m-0 flex items-center gap-2">
                        <Play size={16} className="text-water" /> Shop Mode
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] truncate m-0">{listName || 'Shopping list'}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground transition-colors p-2.5 hover:bg-foreground/5 rounded-full flex items-center justify-center min-h-[40px] min-w-[40px]"
                    aria-label="Exit Shop Mode"
                >
                    <X size={18} />
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8">
                <div className="animate-in fade-in duration-200 max-w-2xl mx-auto w-full">
                    {location === 'setup' && renderSetup()}
                    {location === 'grouping' && renderChangeGrouping()}
                    {location === 'section' && renderSection()}
                    {location === 'choose' && renderChoose()}
                    {location === 'pass-complete' && renderPassComplete()}
                    {location === 'done' && renderDone()}
                </div>
            </div>
        </div>
    );
}
