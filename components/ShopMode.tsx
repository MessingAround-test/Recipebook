import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Undo2, ChevronDown, ChevronRight, ShoppingBag, PauseCircle } from 'lucide-react';
import {
    SHOP_MODE_GROUPING_CHOICES,
    SHOP_MODE_GROUPING_NONE,
    SHOP_MODE_STORAGE_KEY,
    SHOP_MODE_SESSION_KEY,
    buildSections,
    comeBackCount,
    flattenLeaves,
    isHeldOff,
    leafQuantityDisplay,
    outstandingCount,
    passSummary,
    summarizeGroupingChoice,
} from '../lib/shopMode';
import { getStoredOrder } from '../lib/woolworthsOrder';
import { getColorForCategory } from '../lib/colors';
import { renderFractions } from './Fraction';

const GROUPING_LABELS: Record<string, string> = {
    none: 'No grouping',
    category_simple: 'Aisle (simple)',
    category: 'Broad aisle',
    supplier: 'Store',
    recipe_name: 'Recipe',
    planning: 'Pantry plan',
    quantity_type: 'Measure',
    price_category: 'Price tier',
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
}

type Location = 'setup' | 'grouping' | 'choose' | 'section' | 'pass-complete' | 'done';

interface SessionSnapshot {
    groupBy: string;
    location: 'choose' | 'section' | 'pass-complete';
    pass: number;
    sectionKey?: string;
    sectionLabel?: string;
}

function loadSessionSnapshot(): SessionSnapshot | null {
    try {
        const raw = localStorage.getItem(SHOP_MODE_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !SHOP_MODE_GROUPING_CHOICES.includes(parsed.groupBy)) return null;
        if (!['choose', 'section', 'pass-complete'].includes(parsed.location)) return null;
        if (typeof parsed.pass !== 'number' || parsed.pass < 1) return null;
        return parsed;
    } catch {
        return null;
    }
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

    const chooseGrouping = (choice: string) => {
        const s = summaryFor(choice);
        if (s.itemCount > 0 || s.heldCount > 0) setPendingGroupBy(choice);
    };

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

    const startShopping = () => {
        const choice = pendingGroupBy;
        try { localStorage.setItem(SHOP_MODE_STORAGE_KEY, choice); } catch { /* ignore */ }
        setGroupBy(choice);
        setShowOthers(false);
        setChooserFromKey(null);

        const secs = buildSections(items, choice, getStoredOrder());
        const snapshot = loadSessionSnapshot();
        const resumable = snapshot && snapshot.groupBy === choice ? snapshot : null;

        if (resumable && resumable.location !== 'section' && resumable.location !== 'choose') {
            setPassNumber(resumable.pass);
        }

        if (resumable?.location === 'section' && resumable.sectionKey) {
            const resumeSection = secs.find(s => s.key === resumable.sectionKey);
            if (resumeSection) {
                setPassNumber(resumable.pass);
                setCurrentSection({ key: resumeSection.key, label: resumeSection.label });
                setLocation('section');
                saveSessionSnapshot({ groupBy: choice, location: 'section', pass: resumable.pass, sectionKey: resumeSection.key, sectionLabel: resumeSection.label });
                return;
            }
        }

        if (resumable?.location === 'choose' && secs.length > 0) {
            setPassNumber(resumable.pass);
            setLocation('choose');
            saveSessionSnapshot({ groupBy: choice, location: 'choose', pass: resumable.pass });
            return;
        }

        if (resumable?.location === 'pass-complete') {
            if (secs.length === 0 && comebacks > 0) {
                setLocation('pass-complete');
                saveSessionSnapshot({ groupBy: choice, location: 'pass-complete', pass: resumable.pass });
                return;
            }
            setPassNumber(resumable.pass);
        }

        if (secs.length > 0) {
            setCurrentSection({ key: secs[0].key, label: secs[0].label });
            setLocation('section');
            saveSessionSnapshot({ groupBy: choice, location: 'section', pass: 1, sectionKey: secs[0].key, sectionLabel: secs[0].label });
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
            <div key={leaf._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
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
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{renderFractions(leafQuantityDisplay(leaf))}</span>
                        {leaf.note && <span className="truncate max-w-[14rem]">· {leaf.note}</span>}
                    </div>
                </div>
                <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => markHoldOff(leaf)}
                    title="Hold off — pick it up on a later pass"
                    className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg border border-butter/30 text-butter hover:bg-butter/10 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
                    aria-label={`Hold off on ${leaf.name}`}
                >
                    <Undo2 size={14} />
                    <span className="hidden sm:inline">Hold off</span>
                </button>
            </div>
        );
    };

    const renderProgressBar = () => (
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-water transition-all" style={{ width: `${Math.round((resolvedLeaves / Math.max(summary.total, 1)) * 100)}%` }} />
        </div>
    );

    const pickGroupingNow = (choice: string) => {
        try { localStorage.setItem(SHOP_MODE_STORAGE_KEY, choice); } catch { /* ignore */ }
        setGroupBy(choice);
        setShowOthers(false);
        setChooserFromKey(null);
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

    const renderGroupingChips = () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {groupingSummaries.map((s: any) => {
                const active = pendingGroupBy === s.groupBy;
                const usable = s.itemCount > 0 || s.heldCount > 0;
                const subtext = s.groupBy === SHOP_MODE_GROUPING_NONE
                    ? (s.itemCount > 0 ? `One long list · ${s.itemCount} to get` : s.heldCount > 0 ? `One long list · ${s.heldCount} held off` : 'All set')
                    : s.itemCount === 0 && s.heldCount > 0
                        ? `Next pass · ${s.heldCount} held off`
                        : s.itemCount === 0
                            ? 'All set'
                            : `${s.sectionCount} section${s.sectionCount === 1 ? '' : 's'} · ${s.itemCount} to get${s.heldCount > 0 ? ` · ${s.heldCount} held` : ''}`;
                return (
                    <button
                        key={s.groupBy}
                        type="button"
                        onClick={() => chooseGrouping(s.groupBy)}
                        disabled={!usable}
                        className={`flex flex-col items-start gap-0.5 px-3 py-3 rounded-xl border text-left transition-all active:scale-95 min-h-[64px] ${active && usable ? 'bg-water/15 border-water/40' : !usable ? 'opacity-30 border-white/5 bg-white/[0.02]' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}
                    >
                        <span className={`text-[11px] font-black uppercase tracking-widest ${active && usable ? 'text-water' : 'text-foreground'}`}>{GROUPING_LABELS[s.groupBy] || s.groupBy}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{subtext}</span>
                    </button>
                );
            })}
        </div>
    );

    const renderChangeGrouping = () => {
        const sectionsForPending = buildSections(items, pendingGroupBy, getStoredOrder());
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-center text-white/60 m-0">How do you want to group the list?</p>
                {renderGroupingChips()}
                <button
                    type="button"
                    onClick={() => pickGroupingNow(pendingGroupBy)}
                    className="btn-modern !bg-water hover:!bg-water/85 text-primary-foreground py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-water/20"
                >
                    {sectionsForPending.length > 0 ? <>Show the sections <ChevronRight size={14} /></> : 'Continue'}
                </button>
                <button type="button" onClick={leaveGroupingScreen} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Cancel
                </button>
            </div>
        );
    };

    const renderSetup = () => {
        const remembered = loadSessionSnapshot();
        const resumeHint = remembered && remembered.groupBy === pendingGroupBy && ['choose', 'section'].includes(remembered.location)
            ? (remembered.location === 'section' ? remembered.sectionLabel : null)
            : null;
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-center text-white/60 m-0">How do you want to walk the store?</p>
                {renderGroupingChips()}
                {resumeHint && (
                    <p className="text-[10px] text-center font-black uppercase tracking-widest text-muted-foreground m-0">
                        Will resume in {resumeHint}
                    </p>
                )}
            <button
                type="button"
                onClick={startShopping}
                disabled={summaryFor(pendingGroupBy).itemCount === 0 && comebacks === 0}
                className="btn-modern !bg-water hover:!bg-water/85 text-primary-foreground py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-water/20 disabled:opacity-40"
            >
                <ShoppingBag size={16} /> Start shopping
            </button>
            <button
                type="button"
                onClick={resetAll}
                disabled={busyLeafId === 'resetting' || comebacks === 0}
                className="text-[10px] font-bold uppercase tracking-widest text-red-400/70 hover:text-red-300 underline underline-offset-2 transition-colors disabled:opacity-40 disabled:no-underline"
            >
                {busyLeafId === 'resetting' ? 'Clearing held-off items…' : `Clear held-off items (${comebacks})`}
            </button>
        </div>
    );
    };

    const renderSection = () => {
        const rows = currentSection ? (sections.find(s => s.key === currentSection.key)?.items || []) : [];
        const sectionDone = rows.length === 0;
        return (
            <div className="flex flex-col gap-4">
                <div className="rounded-xl p-4 border border-white/10 bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border border-white/15 rounded px-1.5 py-0.5 shrink-0">Pass {passNumber}</span>
                            <h2 className="text-xl font-black tracking-tight m-0 truncate" style={{ color: sectionColor(currentSection!.key) }}>{currentSection!.label}</h2>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">{comebacks > 0 ? `${comebacks} held off` : 'All done'}</span>
                    </div>
                    {renderProgressBar()}
                </div>

                {sectionDone ? (
                    <div className="text-center py-8 rounded-xl border border-water/20 bg-water/5">
                        <p className="text-sm font-black uppercase tracking-widest text-water m-0">Section cleared</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{comebacks > 0 ? 'You held off some things for a later pass.' : 'Nothing left in this section.'}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {sortRows(rows).map(leaf => renderLeaf(leaf))}
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (sections.length > 0) exitToMainChooser();
                            else if (comebacks > 0) goToPassComplete();
                            else setLocation('done');
                        }}
                        className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${sectionDone ? 'btn-modern !bg-water hover:!bg-water/85 text-primary-foreground shadow-lg shadow-water/20' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}
                    >
                        {sectionDone
                            ? (sections.length > 0
                                ? <>Next: {sections[0].label} <ChevronRight size={14} /></>
                                : comebacks > 0
                                    ? <>Finish this pass <ChevronRight size={14} /></>
                                    : <>Finish up <ChevronRight size={14} /></>)
                            : <>Choose another section ({rows.length} to get) <ChevronRight size={14} /></>}
                    </button>
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
        const nearby = pickerSections.slice(1, 3);
        const others = pickerSections.slice(3);
        const leftBehind = fromKey ? pickerSections.find(s => s.key === fromKey) : null;
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-black tracking-tight text-white m-0">{heading}</h2>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border border-white/15 rounded px-1.5 py-0.5 shrink-0">Pass {passNumber}</span>
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
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/25 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
                    >
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: sectionColor(section.key) }} />
                        <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-[15px] text-foreground truncate">{section.label}</span>
                                {idx === 0 && (
                                    <span className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded bg-water/15 text-water uppercase tracking-widest">Suggested</span>
                                )}
                            </span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">{section.items.length} {countLabel}</span>
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
                                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.06] transition-all active:scale-[0.98]"
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sectionColor(section.key) }} />
                                    <span className="text-[13px] font-bold text-foreground truncate">{section.label}</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{section.items.length}</span>
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
                            <div key={leaf._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
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
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                        <span>{renderFractions(leafQuantityDisplay(leaf))}</span>
                                        {leaf.note && <span className="truncate max-w-[14rem]">· {leaf.note}</span>}
                                    </div>
                                </div>
                                <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-butter">
                                    <PauseCircle size={13} /> <span className="hidden sm:inline">Held</span>
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
                <h2 className="text-2xl font-black tracking-tight text-white m-0">Everything&apos;s done</h2>
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
                    <h2 className="text-base font-bold tracking-tight text-white truncate m-0 flex items-center gap-2">
                        <ShoppingBag size={16} className="text-water" /> Shop Mode
                    </h2>
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] truncate m-0">{listName || 'Shopping list'}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-white/50 hover:text-white transition-colors p-2.5 hover:bg-white/5 rounded-full flex items-center justify-center min-h-[40px] min-w-[40px]"
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
