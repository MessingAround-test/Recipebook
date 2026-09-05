import React, { useState, useEffect } from 'react';
import { X, BarChart3, Apple } from 'lucide-react';
import AddShoppingItem from './AddShoppingItem';
import IngredientResearchComponent from './IngredientResearchComponent';
import IngredientNutrientGraph from './IngredientNutrientGraph';

interface EditShoppingItemOverlayProps {
    item: any;
    show: boolean;
    onClose: () => void;
    onSaved: () => void;
}

type Tab = 'edit' | 'research' | 'nutrition';

export default function EditShoppingItemOverlay({ item, show, onClose, onSaved }: EditShoppingItemOverlayProps) {
    const [activeTab, setActiveTab] = useState<Tab>('edit');

    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
            setActiveTab('edit');
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

    if (!show || !item) return null;

    const handleEditComplete = () => {
        onSaved();
    };

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'edit', label: 'Edit', icon: null },
        { key: 'research', label: 'Price Research', icon: <BarChart3 size={12} /> },
        { key: 'nutrition', label: 'Nutrition', icon: <Apple size={12} /> },
    ];

    return (
        <div className="fixed inset-0 z-[1100] flex flex-col">
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Edit shopping item"
                className="relative z-10 flex flex-col h-full animate-in fade-in duration-300"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-lg font-bold tracking-tight text-white truncate">{item.name}</h2>
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Edit Item</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors p-2.5 hover:bg-white/5 rounded-full flex items-center justify-center min-h-[40px] min-w-[40px]"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-4 pb-3 shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === tab.key
                                    ? 'bg-white/10 text-white border border-white/20'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
                    {activeTab === 'edit' && (
                        <div className="animate-in fade-in duration-200">
                            <AddShoppingItem
                                variant="inline"
                                editMode={true}
                                editItemId={item._id}
                                initialData={{
                                    name: item.name,
                                    quantity: item.quantity,
                                    quantity_type: item.quantity_type,
                                    note: item.note || '',
                                }}
                                initialCategory={item.category || ''}
                                handleSubmit={() => {}}
                                onCancel={onClose}
                                onEditComplete={handleEditComplete}
                                hideHeader={true}
                                hideNote={false}
                            />
                        </div>
                    )}

                    {activeTab === 'research' && (
                        <div className="animate-in fade-in duration-200">
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                                    <BarChart3 size={14} />
                                    Price Research
                                </h3>
                                <IngredientResearchComponent
                                    initialSearchTerm={item.name}
                                    initialQuantity={item.quantity || 1}
                                    initialQuantityUnit={item.quantity_type || 'each'}
                                    autoSearch={true}
                                    excludeTop3={true}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'nutrition' && (
                        <div className="animate-in fade-in duration-200">
                            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20">
                                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2">
                                    <Apple size={14} />
                                    Nutritional Profile
                                </h3>
                                <IngredientNutrientGraph ingredients={[item]} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
