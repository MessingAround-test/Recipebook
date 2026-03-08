import React, { useState, useEffect, useRef } from 'react';

const ToggleList = ({ inputList, onUpdateList, value, text = "Select Option" }: any) => {
    const [activeItems, setActiveItems] = useState<string[]>(value || []);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleItem = (item: string) => {
        const updatedItems = [...activeItems];
        const index = updatedItems.indexOf(item);
        if (index === -1) {
            updatedItems.push(item);
        } else {
            updatedItems.splice(index, 1);
        }
        setActiveItems(updatedItems);
    };

    useEffect(() => {
        onUpdateList(activeItems);
    }, [activeItems, onUpdateList]);

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
                className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-bold uppercase ring-offset-background hover:bg-accent hover:text-accent-foreground w-full"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                {text}
            </button>
            {isOpen && (
                <div className="absolute top-12 left-0 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md w-full">
                    {inputList.map((item: string) => (
                        <div
                            key={item}
                            className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => toggleItem(item)}
                        >
                            <label className="flex items-center gap-2 cursor-pointer w-full uppercase">
                                <input
                                    type="checkbox"
                                    checked={activeItems.includes(item)}
                                    onChange={() => { }}
                                    className="accent-primary"
                                />
                                {item}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ToggleList;
