import React, { useState, useMemo } from 'react';
import { getColorForCategory } from '../lib/colors';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';
import CardListModal from './CardListModal';
import IngredientCardProduct from './IngredientCardProduct';
import Skeleton from './Skeleton';

function IngredientCard({ ingredient, essential, handleCheckboxChange, markAsIncorrect, handleDeleteItem, filters, modalVersion, enabledSuppliers = [], groupColor, pricingStrategy = 'match' }) {
    const [otherOptionsModalIsOpen, setOtherOptionsModalIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // If a group color was passed down, use it. Otherwise, try to figure it out from the category or fallback to accent.
    const accentColor = groupColor || getColorForCategory(ingredient.category || 'unknown') || 'var(--accent)';

    const isGroup = ingredient.isGroup ?? (ingredient.items && ingredient.items.length > 1);

    const bestOption = useMemo(() => {
        if (!ingredient.options || ingredient.options.length === 0) return undefined;
        let filtered = ingredient.options;
        if (enabledSuppliers && enabledSuppliers.length > 0) {
            filtered = ingredient.options.filter(opt => enabledSuppliers.includes(opt.source));
        }
        if (filtered.length === 0) return undefined;

        if (pricingStrategy === 'value') {
            return filtered.reduce((prev, curr) => {
                const pPrev = prev.unit_price_converted ?? prev.price;
                const pCurr = curr.unit_price_converted ?? curr.price;
                return pPrev < pCurr ? prev : curr;
            });
        }
        return filtered.reduce((prev, curr) => {
            const pPrev = prev.total_price ?? prev.price;
            const pCurr = curr.total_price ?? curr.price;
            return pPrev < pCurr ? prev : curr;
        });
    }, [ingredient.options, enabledSuppliers, pricingStrategy]);

    return (
        <div style={{ opacity: ingredient.complete ? 0.6 : 1, width: '100%' }}>
            <div
                key={ingredient._id}
                className="flex-row align-center gap-4 py-4 px-6 relative transition-colors duration-200 hover:bg-accent/5"
                style={{
                    borderBottom: '1px solid var(--glass-border)'
                }}
            >
                {/* Subtle left border hint for color */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                    style={{
                        backgroundColor: ingredient.complete ? 'transparent' : accentColor,
                        opacity: 0.8
                    }}
                />

                {handleCheckboxChange !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'center', minWidth: '40px' }}>
                        <input
                            type="checkbox"
                            checked={ingredient.complete}
                            onChange={() => handleCheckboxChange(ingredient)}
                            style={{
                                width: '1.5rem',
                                height: '1.5rem',
                                cursor: 'pointer',
                                accentColor: accentColor,
                                borderRadius: '0.25rem'
                            }}
                        />
                    </div>
                )}

                <div style={{ flex: 1 }} className="flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <div onClick={() => isGroup ? setIsExpanded(!isExpanded) : setOtherOptionsModalIsOpen(true)} className="hover-accent transition-all hover:translate-x-1" style={{
                            fontSize: '1rem',
                            lineHeight: '1.2',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            textDecoration: ingredient.complete ? 'line-through' : 'none',
                            letterSpacing: '-0.01em',
                            display: 'inline-block'
                        }}>
                            {`${ingredient.name.toUpperCase()}`}
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: '500' }}>
                                &bull; {isGroup ? (ingredient.totalString || `${ingredient.quantity} ${ingredient.quantity_type_shorthand || ingredient.quantity_type || 'each'}`) : `${ingredient.quantity} ${ingredient.quantity_type_shorthand || ingredient.quantity_type || 'each'}`}
                            </span>
                        </div>
                        {isGroup && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        )}
                    </div>

                    {isExpanded && isGroup && (
                        <div className="mt-2 ml-2 pl-4 border-l-2 border-[var(--glass-border)] flex flex-col gap-2">
                            {ingredient.items.map((item, idx) => (
                                <div key={item._id || idx} className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={item.complete}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleCheckboxChange(item);
                                            }}
                                            className="w-3 h-3 rounded cursor-pointer accent-accent"
                                        />
                                        <span>{item.quantity} {item.quantity_type_shorthand || item.quantity_type || 'each'}</span>
                                        {item.note && <span className="italic opacity-60">({item.note})</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono opacity-80">{item.compositionPercentage}%</span>
                                        {handleDeleteItem && (
                                            <button
                                                onClick={(e) => handleDeleteItem(e, item._id)}
                                                className="text-red-400 hover:text-red-300 opacity-60 hover:opacity-100 transition-opacity"
                                                title="Delete this specific entry"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18"></path>
                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {ingredient.loading && (
                        <div className="mt-2 w-full">
                            <Skeleton height="3rem" className="w-full opacity-50" />
                        </div>
                    )}

                    {bestOption !== undefined && filters.includes("supplier") && !ingredient.complete && (
                        <div className="mt-1 flex-col gap-1">
                            <IngredientCardProduct ingredient={bestOption} showSupplierImage={false}></IngredientCardProduct>
                            <div className="flex-row">
                                <button
                                    onClick={() => setOtherOptionsModalIsOpen(true)}
                                    className="btn-modern btn-outline py-0.5 px-2 rounded-md"
                                    style={{ fontSize: '0.75rem' }}
                                    title="View Other Options"
                                >
                                    🔄
                                </button>
                            </div>
                        </div>
                    )}
                    <CardListModal handleDeleteItem={handleDeleteItem} filters={filters} ingredient={ingredient} show={otherOptionsModalIsOpen} onHide={() => setOtherOptionsModalIsOpen(false)} enabledSuppliers={enabledSuppliers}></CardListModal>
                </div>
            </div >
        </div >
    );
}

IngredientCard.propTypes = {
    ingredient: PropTypes.object.isRequired,
    essential: PropTypes.bool,
    openModal: PropTypes.func.isRequired,
    handleCheckboxChange: PropTypes.func,
    markAsIncorrect: PropTypes.func,
};

export default IngredientCard;
