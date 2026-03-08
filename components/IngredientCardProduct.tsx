import React, { useState } from 'react';
import IngredientDetailCard from './IngredientDetailCard';
import { Button } from './ui/button';

function IngredientCardProduct({ ingredient, handleDeleteIngredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, handleDelete, showSupplierImage = true }: any) {
    const [modalIsOpen, setIsOpen] = useState(false);

    // Render a simple tailwind progress bar
    const matchEfficiency = ingredient?.match_efficiency || 0;

    return (
        <div className={`flex flex-col gap-3 ${ingredient?.complete ? 'grayscale opacity-75' : ''}`}>

            {showSupplierImage && (
                <div className="flex justify-center mb-1">
                    <img
                        className="max-w-[10%] h-auto rounded-[5px]"
                        src={`/${ingredient?.source ? ingredient.source : 'cross'}.png`}
                        alt={ingredient?.name}
                    />
                </div>
            )}

            <div className="flex justify-center text-center text-foreground font-medium mb-1 relative group cursor-pointer" onClick={() => setIsOpen(true)}>
                <IngredientDetailCard ingredient={ingredient} show={modalIsOpen} onHide={() => setIsOpen(false)} />
                <span className="text-base group-hover:text-primary transition-colors hover:underline">
                    {ingredient ? ingredient.name : ""}
                </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center text-lg mb-1 font-semibold text-foreground">
                <div>${(ingredient?.total_price || 0).toFixed(2)}/</div>
                <div className="text-sm font-normal">
                    ${((ingredient?.total_price || 0) / (ingredient?.match_efficiency || 100) * 100).toFixed(2)}
                </div>
            </div>

            {ingredient !== undefined && matchEfficiency < 100 && (
                <div className="w-full bg-muted rounded-full h-4 mb-2 overflow-hidden border border-border">
                    <div className="bg-green-500 h-4 rounded-full text-xs font-bold text-white flex items-center justify-center whitespace-nowrap overflow-hidden transition-all" style={{ width: `${Math.max(matchEfficiency, 0)}%` }}>
                        {Math.max(matchEfficiency, 0).toFixed(0)}% efficiency
                    </div>
                </div>
            )}

            {handleDeleteIngredient !== undefined && (
                <div className="flex justify-center mt-2">
                    <Button
                        onClick={() => handleDelete(handleDeleteIngredient(ingredient._id, localStorage.getItem('Token')))}
                        variant="destructive"
                        size="sm"
                    >
                        Delete
                    </Button>
                </div>
            )}
        </div>
    );
}

export default IngredientCardProduct;
