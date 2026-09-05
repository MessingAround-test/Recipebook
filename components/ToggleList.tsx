import React, { useState, useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';
import Modal from 'react-modal';

const ToggleList = ({ inputList, onUpdateList, value, text = "Select Option", mapping = {} }: any) => {
    const [activeItems, setActiveItems] = useState<string[]>(value || []);
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

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
            const target = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target)) {
                if ((target as HTMLElement)?.closest?.('.ReactModal__Overlay')) return;
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const activeCount = activeItems.length;

    return (
        <div className="relative w-full sm:w-auto" ref={dropdownRef}>
            <button
                className={`flex h-8 sm:h-10 items-center justify-between sm:justify-center rounded-xl border px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] transition-all w-full sm:w-auto shadow-lg backdrop-blur-md active:scale-95 ${isOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/[0.05] border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="flex items-center gap-1.5 sm:gap-2">
                    <span className="relative">
                        <Layers size={14} className="sm:w-3.5 sm:h-3.5 opacity-70" />
                        {activeCount > 0 && (
                            <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] bg-emerald-500 text-black text-[8px] font-black rounded-full flex items-center justify-center px-0.5">{activeCount}</span>
                        )}
                    </span>
                    <span className="hidden sm:inline">{text}</span>
                </span>
                <span className={`transition-transform duration-300 text-[7px] sm:text-[8px] sm:hidden ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {!isMobile && isOpen && (
                <div className="absolute top-12 left-0 z-[200] min-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] p-2 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200">
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

            {isMobile && (
                <Modal
                    isOpen={isOpen}
                    onRequestClose={() => setIsOpen(false)}
                    style={{
                        content: {
                            backgroundColor: 'var(--bg-main, #0c0c0e)',
                            borderColor: 'var(--border, rgba(255,255,255,0.1))',
                            color: 'var(--foreground, white)',
                            maxWidth: '520px',
                            width: '100%',
                            margin: '0 auto',
                            padding: '1rem 1rem 2rem',
                            borderRadius: '1.5rem 1.5rem 0 0',
                            inset: 'auto 0 0 0',
                            height: 'fit-content',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            boxShadow: '0 -20px 40px rgba(0,0,0,0.6)',
                            borderBottom: 'none',
                            marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(8px)',
                            zIndex: 200,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center'
                        }
                    }}
                    contentLabel="Group By"
                >
                    <div className="flex items-center justify-center mb-3">
                        <div className="w-10 h-1 rounded-full bg-white/30" />
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Layers size={18} className="text-emerald-400" /> {text}
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="bg-white/10 hover:bg-white/20 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {inputList.map((item: string) => {
                            const isChecked = activeItems.includes(item);
                            return (
                                <div
                                    key={item}
                                    className={`relative flex w-full cursor-pointer select-none items-center rounded-xl p-3.5 transition-all ${isChecked ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                                    onClick={() => toggleItem(item)}
                                >
                                    <div className="flex items-center gap-3 w-full uppercase text-[11px] font-black tracking-widest">
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${isChecked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/20'}`}>
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
                </Modal>
            )}
        </div>
    );
};

export default ToggleList;
