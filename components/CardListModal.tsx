import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import IngredientCardProduct from './IngredientCardProduct';
import { getGroceryStoreProducts, handleDeleteIngredient } from '../lib/commonAPIs';

const CardListModal = ({ ingredient, show, onHide, filters, enabledSuppliers = [] }: any) => {
    const [selectableOptions, setselectableOptions] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (ingredient && show === true) {
                    const response = await getGroceryStoreProducts(ingredient, 5, enabledSuppliers, localStorage.getItem('Token') || '');
                    const resOptions = response.options;
                    setselectableOptions(resOptions);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [ingredient, show]);

    const handleDelete = async (id_promise: Promise<string> | string) => {
        const id = await id_promise;
        const indexToDelete = selectableOptions.findIndex(option => option._id === id);
        const updatedSelectableOptions = [...selectableOptions];
        if (indexToDelete !== -1) {
            updatedSelectableOptions.splice(indexToDelete, 1);
            setselectableOptions(updatedSelectableOptions);
        } else {
            console.error(`Object with _id ${id} not found in selectableOptions`);
        }
    };

    const handleSelect = () => {
        if (selectableOptions.length > 0) {
            onHide();
        }
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
                    maxWidth: '800px',
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
            contentLabel="Alternative Options"
        >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                <h2 className="text-xl font-bold">Alternative Options</h2>
                <button onClick={onHide} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
            </div>
            <div>
                <p className="text-sm text-muted-foreground mb-4">Please delete Options until a valid one is first</p>
                <div className="flex flex-col gap-2">
                    {selectableOptions.map((option, index) => (
                        <div
                            key={option._id || index}
                            className="border border-border rounded-lg shadow-sm my-1 p-4 bg-muted/20"
                        >
                            <IngredientCardProduct
                                ingredient={option}
                                handleDeleteIngredient={handleDeleteIngredient}
                                handleDelete={handleDelete}
                                filters={filters}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default CardListModal;
