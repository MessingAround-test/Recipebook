import React, { useState, useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';

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
        <div className="relative w-full" ref={dropdownRef}>
            <button
                className={`flex h-10 items-center justify-between rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all w-full shadow-lg backdrop-blur-md active:scale-95 ${isOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/[0.05] border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="flex items-center gap-2">
                    <Layers size={14} className="opacity-70" /> {text}
                </span>
                <span className={`transition-transform duration-300 text-[8px] ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
                <div className="absolute top-12 left-0 right-0 z-[200] min-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] p-2 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col gap-1">
                        {inputList.map((item: string) => {
                            const isChecked = activeItems.includes(item);
                            return (
                                <div
                                    key={item}
                                    className={`relative flex w-full cursor-pointer select-none items-center rounded-xl p-2.5 transition-all ${isChecked ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                                    onClick={() => toggleItem(item)}
                                >
                                    <div className="flex items-center gap-3 w-full uppercase text-[10px] font-black tracking-widest">
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/20'}`}>
                                            {isChecked && (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            )}
                                        </div>
                                        {mapping[item] || item}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToggleList;
