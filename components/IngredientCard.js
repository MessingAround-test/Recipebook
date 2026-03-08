import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';
import CardListModal from './CardListModal';
import IngredientCardProduct from './IngredientCardProduct';

function IngredientCard({ ingredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, enabledSuppliers = [] }) {
    const [otherOptionsModalIsOpen, setOtherOptionsModalIsOpen] = useState(false);

    return (
        <div style={{ filter: ingredient.complete ? 'grayscale(100%)' : 'none', opacity: ingredient.complete ? 0.6 : 1, width: '100%', marginBottom: '1rem' }}>
            <div
                key={ingredient._id}
                className="glass-card flex-row align-center gap-4 py-4 px-6"
                style={{
                    border: '1px solid var(--glass-border)',
                }}
            >
                {handleCheckboxChange !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'center', minWidth: '40px' }}>
                        <input
                            type="checkbox"
                            checked={ingredient.complete}
                            onChange={() => handleCheckboxChange(ingredient)}
                            style={{
                                width: '1.4rem',
                                height: '1.4rem',
                                cursor: 'pointer',
                                accentColor: 'var(--accent)'
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

                    {ingredient.loading && <div className={styles.lds_circle} style={{ transform: 'scale(0.5)' }}><div></div></div>}

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
    essential: PropTypes.bool.isRequired,
    openModal: PropTypes.func.isRequired,
    handleCheckboxChange: PropTypes.func.isRequired,
    markAsIncorrect: PropTypes.func.isRequired,
};

export default IngredientCard;
