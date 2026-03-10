import React, { useState } from 'react';
import IngredientDetailCard from './IngredientDetailCard';
import { Button } from './ui/button';

function IngredientCardProduct({ ingredient, handleDeleteIngredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, handleDelete, showSupplierImage = true }: any) {
    const [modalIsOpen, setIsOpen] = useState(false);

    // Render a simple tailwind progress bar
    const matchEfficiency = ingredient?.match_efficiency || 0;

    return (
        <div className={`flex flex-col gap-1.5 ${ingredient?.complete ? 'grayscale opacity-75' : ''}`}>

            {/* Top row: Image & Name */}
            <div className="flex flex-row items-center gap-2">
                {showSupplierImage && (
                    <img
                        className="w-5 h-5 object-contain rounded-sm"
                        src={`/${ingredient?.source ? ingredient.source : 'cross'}.png`}
                        alt={ingredient?.name}
                    />
                )}

                <div className="text-sm font-medium relative group cursor-pointer" onClick={() => setIsOpen(true)}>
                    <span className="group-hover:text-primary transition-colors hover:underline truncate max-w-[200px] inline-block align-bottom">
                        {ingredient ? ingredient.name : ""}
                    </span>
                </div>
                <IngredientDetailCard ingredient={ingredient} show={modalIsOpen} onHide={(e: any) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setIsOpen(false);
                }} />
            </div>

            {/* Middle row: Price & Efficiency Bar */}
            <div className="flex flex-row items-center gap-3">
                <div className="flex flex-row items-baseline gap-1 font-semibold text-foreground text-sm">
                    <span>${(ingredient?.total_price || 0).toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                        (${((ingredient?.total_price || 0) / (matchEfficiency || 100) * 100).toFixed(2)} adj)
                    </span>
                </div>

                {ingredient !== undefined && matchEfficiency < 100 && (
                    <div className="w-24 bg-muted rounded-full overflow-hidden border border-border h-1.5 mt-0.5" title={`${Math.max(matchEfficiency, 0).toFixed(0)}% match efficiency`}>
                        <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${Math.max(matchEfficiency, 0)}%` }}></div>
                    </div>
                )}
            </div>

            {/* Bottom Row: Delete button (if present) */}
            {handleDeleteIngredient !== undefined && (
                <div className="flex mt-1">
                    <Button
                        onClick={() => handleDelete(handleDeleteIngredient(ingredient._id, localStorage.getItem('Token')))}
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs px-2"
                    >
                        Delete
                    </Button>
                </div>
            )}
        </div>
    );
}

export default IngredientCardProduct;
