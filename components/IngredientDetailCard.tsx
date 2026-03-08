import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';

const IngredientDetailCard = ({ ingredient, show, onHide }: any) => {
    useEffect(() => {
        // You can add additional logic or API calls here if needed
    }, [ingredient, show]);

    const renderIngredientDetails = () => {
        if (!ingredient) return null;
        return Object.entries(ingredient).map(([key, value]) => (
            <div key={key} className="mb-2">
                <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </div>
        ));
    };

    return (
        <Modal
            isOpen={show}
            onRequestClose={onHide}
            style={{
                content: {
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                    maxWidth: '600px',
                    margin: '0 auto',
                    padding: '2rem',
                    borderRadius: '0.75rem'
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 50
                }
            }}
            contentLabel="Ingredient Details"
        >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                <h2 className="text-xl font-bold">More details</h2>
                <button onClick={onHide} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] text-sm font-mono break-all bg-muted/20 p-4 rounded-md border border-border">
                {renderIngredientDetails()}
            </div>
        </Modal>
    );
};

export default IngredientDetailCard;
