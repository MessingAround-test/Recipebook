import React, { useState } from 'react';
import Modal from 'react-modal';
import IngredientResearchComponent from './IngredientResearchComponent';
import IngredientNutrientGraph from './IngredientNutrientGraph';

const CardListModal = ({ ingredient, show, onHide, filters, enabledSuppliers = [], handleDeleteItem, hideDelete = false }: any) => {
    const [showNutrition, setShowNutrition] = useState(false);

    return (
        <Modal
            isOpen={show}
            onRequestClose={onHide}
            portalClassName="dark"
            style={{
                content: {
                    backgroundColor: '#0f172a', // Deep slate for better chart contrast
                    borderColor: 'rgba(255,255,255,0.1)',
                    color: '#f8fafc', // Light slate text
                    maxWidth: '900px',
                    margin: '0 auto',
                    padding: '2rem',
                    borderRadius: '0.75rem',
                    overflowY: 'auto',
                    maxHeight: '90vh',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 200 // Higher than page header
                }
            }}
            contentLabel="Ingredient Detail & Research"
        >
            <div className="dark flex flex-col gap-8 h-full">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 sticky top-0 bg-[#0f172a] z-10 -mt-2 -mx-2 px-2">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-bold tracking-tight">{ingredient?.name?.toUpperCase()}</h2>
                        <p className="text-sm text-muted-foreground">Detail & Advanced Research</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowNutrition(!showNutrition)}
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all border ${
                                showNutrition 
                                ? 'bg-emerald-500 text-white border-emerald-400' 
                                : 'bg-white/5 text-muted-foreground border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {showNutrition ? '📊 Hide Nutrition' : '🥗 Show Nutrition'}
                        </button>
                        {handleDeleteItem && !hideDelete && (
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to remove ${ingredient?.name} from the list?`)) {
                                        handleDeleteItem(null, ingredient?._id);
                                        onHide();
                                    }
                                }}
                                className="text-xs font-bold uppercase tracking-widest text-red-500 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 py-1.5 px-3 rounded-lg transition-all"
                                title="Remove from Shopping List"
                            >
                                🗑️ Remove
                            </button>
                        )}
                        <button onClick={onHide} className="text-muted-foreground hover:text-foreground text-3xl leading-none transition-colors">&times;</button>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    {showNutrition && (
                        <div className="glass-card bg-white/5 border-emerald-500/20 p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-6 flex items-center gap-2">
                                <span>🥗</span> Nutritional Profile (Per Ingredient Quantity)
                            </h3>
                            <IngredientNutrientGraph ingredients={[ingredient]} />
                        </div>
                    )}

                    <IngredientResearchComponent
                        initialSearchTerm={ingredient?.name}
                        initialQuantity={ingredient?.quantity || 1}
                        initialQuantityUnit={ingredient?.quantity_unit || ingredient?.quantity_type || 'any'}
                        autoSearch={true}
                        excludeTop3={true}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default CardListModal;
