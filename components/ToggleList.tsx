import React, { useState, useEffect, useRef } from 'react';

const ToggleList = ({ inputList, onUpdateList, value, text = "Select Option", mapping = {} }: any) => {
    const [activeItems, setActiveItems] = useState<string[]>(value || []);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync state with prop
    useEffect(() => {
        if (value) {
            setActiveItems(value);
        }
    }, [value]);

    const toggleItem = (item: string) => {
        const updatedItems = [...activeItems];
        const index = updatedItems.indexOf(item);
        if (index === -1) {
            updatedItems.push(item);
        } else {
            updatedItems.splice(index, 1);
        }
        setActiveItems(updatedItems);
        onUpdateList(updatedItems);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    return (
        <div className="relative font-mono" ref={dropdownRef}>
            <button
                className="flex h-10 items-center justify-between rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-2 text-xs font-bold uppercase ring-offset-background hover:bg-[var(--accent)] hover:text-black transition-colors w-full shadow-lg"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="flex items-center gap-2">
                    <span className="opacity-60">📁</span> {text}
                </span>
                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
                <div className="absolute top-12 right-0 z-[200] min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#0f172a] p-1.5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                    {inputList.map((item: string) => (
                        <div
                            key={item}
                            className="relative flex w-full cursor-pointer select-none items-center rounded-sm hover:bg-[var(--accent)] hover:text-black transition-colors"
                            onClick={() => toggleItem(item)}
                        >
                            <div className="flex items-center gap-2 py-1.5 px-2 w-full uppercase pointer-events-none">
                                <input
                                    type="checkbox"
                                    checked={activeItems.includes(item)}
                                    readOnly
                                    className="accent-emerald-500"
                                />
                                {mapping[item] || item}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ToggleList;
