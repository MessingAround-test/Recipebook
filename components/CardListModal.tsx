import React from 'react';
import Modal from 'react-modal';
import IngredientResearchComponent from './IngredientResearchComponent';

const CardListModal = ({ ingredient, show, onHide, filters, enabledSuppliers = [], handleDeleteItem }: any) => {

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
                            onClick={() => {
                                if (confirm(`Are you sure you want to remove ${ingredient?.name} from the list?`)) {
                                    handleDeleteItem(null, ingredient?._id);
                                    onHide();
                                }
                            }}
                            className="text-xs font-bold uppercase tracking-widest text-red-500 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 py-1.5 px-3 rounded-lg transition-all"
                            title="Remove from Shopping List"
                        >
                            🗑️ Remove from List
                        </button>
                        <button onClick={onHide} className="text-muted-foreground hover:text-foreground text-3xl leading-none transition-colors">&times;</button>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
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
