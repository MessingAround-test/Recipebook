import React, { useState } from 'react';
import { getColorForCategory } from '../lib/colors';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';
import CardListModal from './CardListModal';
import IngredientCardProduct from './IngredientCardProduct';
import Skeleton from './Skeleton';

/**
 * @param {Object} props
 * @param {any} props.ingredient
 * @param {boolean} [props.essential]
 * @param {Function} props.openModal
 * @param {Function} [props.handleCheckboxChange]
 * @param {Function} [props.markAsIncorrect]
 * @param {string[]} props.filters
 * @param {boolean} [props.modalVersion]
 * @param {string[]} [props.enabledSuppliers]
 * @param {string} [props.groupColor]
 */
function IngredientCard({ ingredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, enabledSuppliers = [], groupColor }) {
    const [otherOptionsModalIsOpen, setOtherOptionsModalIsOpen] = useState(false);

    // If a group color was passed down, use it. Otherwise, try to figure it out from the category or fallback to accent.
    const accentColor = groupColor || getColorForCategory(ingredient.category || 'unknown') || 'var(--accent)';

    return (
        <div style={{ opacity: ingredient.complete ? 0.6 : 1, width: '100%', marginBottom: '1.25rem' }}>
            <div
                key={ingredient._id}
                className="glass-card flex-row align-center gap-4 py-4 px-6 relative overflow-hidden transition-all duration-300"
                style={{
                    border: ingredient.complete ? '1px solid var(--glass-border)' : `1px solid ${accentColor}40`,
                    boxShadow: ingredient.complete ? 'none' : `0 4px 20px -10px ${accentColor}30`,
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
                    <div onClick={() => openModal(ingredient.name)} className="hover-accent" style={{
                        fontSize: '1.2rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textDecoration: ingredient.complete ? 'line-through' : 'none',
                        letterSpacing: '-0.01em'
                    }}>
                        {`${ingredient.name.toUpperCase()}`}
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: '500' }}>
                            &bull; {ingredient.quantity} {ingredient.quantity_type_shorthand}
                        </span>
                    </div>

                    {ingredient.loading && (
                        <div className="mt-2 w-full">
                            <Skeleton height="3rem" className="w-full opacity-50" />
                        </div>
                    )}

                    {ingredient.options[0] !== undefined && filters.includes("supplier") && !ingredient.complete && (
                        <div className="mt-2 flex-col gap-3">
                            <IngredientCardProduct ingredient={ingredient.options[0]} showSupplierImage={false}></IngredientCardProduct>
                            <div className="flex-row">
                                <button
                                    onClick={() => setOtherOptionsModalIsOpen(true)}
                                    className="btn-modern btn-outline py-1 px-3"
                                    style={{ fontSize: '0.8rem' }}
                                >
                                    View Other Options
                                </button>
                            </div>
                            <CardListModal filters={filters} ingredient={ingredient} show={otherOptionsModalIsOpen} onHide={() => setOtherOptionsModalIsOpen(false)} enabledSuppliers={enabledSuppliers}></CardListModal>
                        </div>
                    )}
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
