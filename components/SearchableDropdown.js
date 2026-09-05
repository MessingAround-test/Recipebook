import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import styles from '../styles/SearchableDropdown.module.css';
import { Search, X, ChevronDown, Plus } from 'lucide-react';

const LOCAL_LIMIT = 30;
const REMOTE_LIMIT = 8;
const MIN_REMOTE_QUERY_DEFAULT = 2;
const REMOTE_DEBOUNCE_MS = 250;
const GOOD_MATCH_SCORE = 60; // scores below this trigger a thorough database lookup

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(str) {
    return String(str || '').toLowerCase().trim();
}

/**
 * Score how well an option label matches the query. Higher = better.
 * 100 exact, 90 starts with, 80 word-start, 70 all tokens at word starts,
 * 60 all tokens present, 40 subsequence, 0 no match. Empty query = 1 (show all, in order).
 */
function scoreMatch(label, query) {
    const l = normalize(label);
    const q = normalize(query);
    if (!q) return 1;
    if (!l) return 0;
    if (l === q) return 100;
    if (l.startsWith(q)) return 90;
    if (new RegExp('(^|[^a-z0-9])' + escapeRegex(q)).test(l)) return 80;

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
        const allWordStarts = tokens.every(t => new RegExp('(^|[^a-z0-9])' + escapeRegex(t)).test(l));
        if (allWordStarts) return 70;
        const allPresent = tokens.every(t => l.includes(t));
        if (allPresent) return 60;
        return 0;
    }

    // Single token: subsequence fallback (characters in order)
    let i = 0;
    for (const ch of l) {
        if (ch === q[i]) i++;
        if (i === q.length) break;
    }
    if (i === q.length) return 40;
    return 0;
}

function buildHighlightRegex(query) {
    const q = normalize(query);
    if (!q) return null;
    const parts = [escapeRegex(q)];
    q.split(/\s+/).filter(Boolean).forEach(t => {
        const esc = escapeRegex(t);
        if (!parts.includes(esc)) parts.push(esc);
    });
    try {
        return new RegExp(`(${parts.join('|')})`, 'gi');
    } catch (e) {
        return null;
    }
}

function SearchableDropdown({
    options = [],
    placeholder,
    onChange,
    name,
    value,
    onComplete,
    remoteSearch = undefined,
    minRemoteLength = MIN_REMOTE_QUERY_DEFAULT,
    showUseAnyway = true,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [isFocused, setIsFocused] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [openUp, setOpenUp] = useState(false);
    const [remote, setRemote] = useState({ loading: false, results: [] });

    const wrapRef = useRef(null);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const optionSelectedRef = useRef(false);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);
    const cacheRef = useRef(new Map());

    const isStringMode = options.length === 0 || typeof options[0] === 'string';

    // Keep the visible text in sync with the externally-controlled value
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Close when clicking outside the component
    useEffect(() => {
        const closeDropdown = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        document.addEventListener('click', closeDropdown);
        return () => document.removeEventListener('click', closeDropdown);
    }, []);

    // Clean up pending remote work on unmount
    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
    }, []);

    const getLabel = useCallback((opt) => (typeof opt === 'string' ? opt : opt?.label ?? ''), []);

    // Local fuzzy matching
    const localMatches = useMemo(() => {
        if (!isOpen) return [];
        const scored = [];
        for (let i = 0; i < options.length; i++) {
            const label = getLabel(options[i]);
            const score = scoreMatch(label, inputValue);
            if (score > 0) scored.push({ opt: options[i], label, score, index: i });
        }
        scored.sort((a, b) => b.score - a.score || a.index - b.index);
        return scored.slice(0, LOCAL_LIMIT);
    }, [isOpen, inputValue, options, getLabel]);

    const bestLocalScore = localMatches.length > 0 ? localMatches[0].score : 0;
    const query = inputValue.trim();

    // Thorough database lookup when local matching comes up short
    useEffect(() => {
        if (!isOpen || !remoteSearch || query.length < minRemoteLength || bestLocalScore >= GOOD_MATCH_SCORE) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setRemote(prev => (prev.loading || prev.results.length ? { loading: false, results: [] } : prev));
            return;
        }
        const cached = cacheRef.current.get(query);
        if (cached) {
            setRemote({ loading: false, results: cached });
            return;
        }
        setRemote({ loading: true, results: [] });
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const results = await remoteSearch(query, controller.signal);
                cacheRef.current.set(query, results || []);
                setRemote({ loading: false, results: results || [] });
            } catch (err) {
                if (!controller.signal.aborted) setRemote({ loading: false, results: [] });
            }
        }, REMOTE_DEBOUNCE_MS);
    }, [isOpen, query, bestLocalScore, remoteSearch, minRemoteLength]);

    // Merge local + remote, dropping duplicates
    const items = useMemo(() => {
        if (!isOpen) return [];
        const seen = new Set(localMatches.map(m => normalize(m.label)));
        const remoteItems = [];
        for (const r of remote.results) {
            const label = getLabel(r);
            const key = normalize(label);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            remoteItems.push({ opt: r, label, score: 0, index: -1, isRemote: true });
            if (remoteItems.length >= REMOTE_LIMIT) break;
        }
        return [...localMatches, ...remoteItems];
    }, [isOpen, localMatches, remote.results, getLabel]);

    // Reset keyboard highlight whenever the list content or query changes
    useEffect(() => {
        setActiveIndex(0);
    }, [inputValue, items.length]);

    // Flip the list above the input when there isn't room below
    useLayoutEffect(() => {
        if (!isOpen || !wrapRef.current) return;
        const rect = wrapRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUp(spaceBelow < 290 && rect.top > spaceBelow);
    }, [isOpen]);

    // Keep the active keyboard item visible
    useEffect(() => {
        if (!isOpen || !listRef.current) return;
        const el = listRef.current.querySelector('[data-active="true"]');
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, isOpen, items]);

    const highlightRegex = useMemo(() => buildHighlightRegex(inputValue), [inputValue]);

    const renderLabel = (label) => {
        if (!highlightRegex) return label;
        const parts = label.split(highlightRegex);
        return parts.map((part, i) =>
            i % 2 === 1 ? <em key={i} className={styles.highlight}>{part}</em> : <React.Fragment key={i}>{part}</React.Fragment>
        );
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
        // In string mode every keystroke propagates so the parent form stays in sync;
        // object mode waits for an explicit selection.
        if (isStringMode) {
            onChange(e);
        }
    };

    const handleInputBlur = () => {
        setIsFocused(false);
        // Small timeout lets option-selection mousedown flag itself first
        setTimeout(() => {
            if (!optionSelectedRef.current && onComplete && inputValue.trim() !== '') {
                onComplete(inputValue.trim());
            }
            optionSelectedRef.current = false;
            setIsOpen(false);
        }, 150);
    };

    const selectOption = (opt) => {
        optionSelectedRef.current = true;
        const label = getLabel(opt);
        const finalValue = typeof opt === 'string' ? opt : opt?.value;
        setInputValue(label);
        setIsOpen(false);
        onChange({ target: { name, value: finalValue, option: opt } });
        if (inputRef.current) inputRef.current.blur();
    };

    const useFreeText = () => {
        optionSelectedRef.current = true;
        setIsOpen(false);
        if (onComplete) onComplete(query);
        if (inputRef.current) inputRef.current.blur();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setInputValue('');
        setRemote({ loading: false, results: [] });
        if (isStringMode) {
            onChange({ target: { name, value: '' } });
        }
        if (onComplete) onComplete('');
        if (inputRef.current) inputRef.current.focus();
    };

    // "Use anyway" (typed text) is the first row when present — but hidden when the
    // list already contains an exact (case-insensitive) match for what was typed
    const useAnywayActive = showUseAnyway && !!onComplete && query !== ''
        && !remote.loading
        && !items.some(it => normalize(it.label) === normalize(query));

    const openList = () => setIsOpen(true);

    const handleKeyDown = (e) => {
        // "Use anyway" (typed text) is the first row when present, so items are offset by one
        const offset = useAnywayActive ? 1 : 0;
        const maxIndex = items.length + offset - 1;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) { openList(); return; }
            setActiveIndex(i => Math.min(i + 1, Math.max(maxIndex, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Home' && isOpen && maxIndex >= 0) {
            e.preventDefault();
            setActiveIndex(0);
        } else if (e.key === 'End' && isOpen && maxIndex >= 0) {
            e.preventDefault();
            setActiveIndex(maxIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && useAnywayActive && activeIndex === 0) {
                useFreeText();
            } else if (isOpen) {
                const itemIdx = activeIndex - offset;
                if (itemIdx >= 0 && itemIdx < items.length) {
                    selectOption(items[itemIdx].opt);
                } else if (inputRef.current) {
                    inputRef.current.blur();
                }
            } else {
                if (inputRef.current) inputRef.current.blur();
            }
        } else if (e.key === 'Escape') {
            if (isOpen) {
                e.preventDefault();
                e.stopPropagation(); // don't close modals behind us
                setIsOpen(false);
            }
        }
    };

    const hasContent = items.length > 0;
    const showEmptyState = isOpen && query === '' && !hasContent && !remote.loading;
    const showNoMatches = isOpen && query !== '' && !hasContent && !remote.loading;
    const showDbDivider = hasContent && items.some(it => it.isRemote) && localMatches.length > 0;

    return (
        <div className={styles.sdd} ref={wrapRef}>
            <div className={`${styles.control} ${isFocused ? styles.controlFocused : ''}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => { setIsFocused(true); openList(); }}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    onClick={openList}
                    name={name}
                    placeholder={placeholder}
                    className={styles.input}
                    autoComplete="off"
                    enterKeyHint="search"
                />
                <span className={styles.leadingIcon}>
                    <Search size={15} strokeWidth={2.2} />
                </span>
                <span className={styles.trailing}>
                    {inputValue !== '' && (
                        <button
                            type="button"
                            className={styles.clearBtn}
                            onMouseDown={handleClear}
                            tabIndex={-1}
                            aria-label="Clear"
                        >
                            <X size={14} strokeWidth={2.2} />
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.chevronBtn}
                        onClick={() => setIsOpen(!isOpen)}
                        tabIndex={-1}
                        aria-label={isOpen ? 'Collapse suggestions' : 'Show suggestions'}
                    >
                        <ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
                    </button>
                </span>
            </div>

            {isOpen && (
                <ul className={`${styles.list} ${openUp ? styles.listUp : ''}`} ref={listRef} role="listbox">
                    {useAnywayActive && (
                        <li
                            className={`${styles.useAnyway} ${activeIndex === 0 ? styles.itemActive : ''}`}
                            data-active={activeIndex === 0}
                            role="option"
                            aria-selected={activeIndex === 0}
                            onMouseDown={useFreeText}
                            onMouseEnter={() => setActiveIndex(0)}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            <span className={styles.useAnywayText}>Use &ldquo;{query}&rdquo;</span>
                        </li>
                    )}

                    {items.map((item, i) => {
                        const isActive = activeIndex === i + (useAnywayActive ? 1 : 0);
                        const isSelected = value !== undefined && value !== '' && normalize(item.label) === normalize(value) && !item.isRemote;
                        return (
                            <React.Fragment key={`${item.label}-${i}`}>
                                {i > 0 && item.isRemote && items[i - 1] && !items[i - 1].isRemote && showDbDivider && (
                                    <>
                                        <li className={styles.divider} aria-hidden="true" />
                                        <li className={styles.metaRow} aria-hidden="true">From database</li>
                                    </>
                                )}
                                <li
                                    role="option"
                                    aria-selected={isActive}
                                    data-active={isActive}
                                    onMouseDown={() => selectOption(item.opt)}
                                    onMouseEnter={() => setActiveIndex(i + (useAnywayActive ? 1 : 0))}
                                    className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isSelected ? styles.itemSelected : ''}`}
                                >
                                    <span className={styles.itemLabel}>{renderLabel(item.label)}</span>
                                    {item.isRemote && <span className={styles.dbBadge}>db</span>}
                                    {isSelected && (
                                        <span className={styles.selectedCheck}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </span>
                                    )}
                                </li>
                            </React.Fragment>
                        );
                    })}

                    {remote.loading && !hasContent && (
                        <li className={styles.metaRow}>
                            <span className={styles.spinner} />
                            Searching database…
                        </li>
                    )}

                    {showEmptyState && (
                        <li className={styles.empty} aria-hidden="true">
                            <p className={styles.emptyTitle}>Start typing to search</p>
                            <p className={styles.emptyHint}>Suggestions appear as you type</p>
                        </li>
                    )}

                    {showNoMatches && (
                        <li className={styles.empty} aria-hidden="true">
                            <p className={styles.emptyTitle}>No matches found</p>
                            <p className={styles.emptyHint}>{remoteSearch ? 'Database searched — nothing similar' : 'Nothing similar in your lists'}</p>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default SearchableDropdown;
