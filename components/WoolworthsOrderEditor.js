import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { getStoredOrder, saveOrder, resetOrder, DEFAULT_WOOLWORTHS_ORDER } from '../lib/woolworthsOrder';

export default function WoolworthsOrderEditor({ isOpen, onClose, onSave }) {
    const [items, setItems] = useState([]);
    const [dragIndex, setDragIndex] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setItems(getStoredOrder());
            setDragIndex(null);
        }
    }, [isOpen]);

    const handleDragStart = (e, index) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const newItems = [...items];
        const [removed] = newItems.splice(dragIndex, 1);
        newItems.splice(index, 0, removed);
        setItems(newItems);
        setDragIndex(index);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
    };

    const handleSave = () => {
        saveOrder(items);
        if (onSave) onSave(items);
        onClose();
    };

    const handleReset = () => {
        resetOrder();
        setItems([...DEFAULT_WOOLWORTHS_ORDER]);
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            portalClassName="dark"
            style={{
                content: {
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    inset: '1rem',
                    maxWidth: '600px',
                    margin: '0 auto',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    overflowY: 'auto',
                    maxHeight: '90vh',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 200
                }
            }}
            contentLabel="Edit Woolworths Walkthrough Order"
        >
            <div className="dark flex flex-col gap-6 h-full">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-4 border-b border-white/10">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold tracking-tight break-words">🏪 Woolworths Walkthrough Order</h2>
                        <p className="text-sm text-gray-400 mt-1">Drag categories to match the store layout from entrance to exit</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none transition-colors self-end sm:self-auto min-h-[40px] min-w-[40px] flex items-center justify-center">&times;</button>
                </div>

                <div className="flex flex-col gap-1.5">
                    {items.map((cat, idx) => (
                        <div
                            key={cat}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                                dragIndex === idx
                                    ? 'border-emerald-500/50 bg-emerald-500/10 scale-[1.02] shadow-lg'
                                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                        >
                            <span className="text-gray-500 text-lg leading-none w-6 text-center flex-shrink-0">⠿</span>
                            <span className="text-sm font-semibold text-gray-200 w-6 text-right flex-shrink-0">{idx + 1}.</span>
                            <span className="text-sm font-medium">{cat}</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-2">
                    <button
                        onClick={handleReset}
                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 border border-white/10 bg-white/5 hover:bg-white/10 py-2 px-4 rounded-lg transition-all"
                    >
                        🔄 Reset to Default
                    </button>
                    <button
                        onClick={handleSave}
                        className="text-[10px] font-black uppercase tracking-widest text-black bg-emerald-400 hover:bg-emerald-300 py-2 px-6 rounded-lg transition-all"
                    >
                        ✅ Done
                    </button>
                </div>
            </div>
        </Modal>
    );
}
