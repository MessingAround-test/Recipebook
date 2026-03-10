import React, { useState } from 'react';
import Modal from 'react-modal';
import { IngredientSearchList } from './IngredientSearchList';
import Skeleton from './Skeleton';

function IngredientTable({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName, sortFunction }: any) {
    const [ingredientData, setIngredientData] = useState<any[]>(ingredients);
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("");
    const [essential, setEssential] = useState(true);

    const calculateTotalOfList = () => {
        let total = 0;
        ingredientData.forEach((ingred) => {
            if (ingred.options && ingred.options[0]) {
                total += ingred.options[0].unit_price * ingred.quantity;
            }
        });
        return total.toFixed(2);
    };

    const markAsIncorrect = (id: string, name: string) => {
        // API logic for marking as incorrect
        console.log(`Marking ${name} (${id}) as incorrect`);
    };

    function toggleEssentials() {
        setEssential(!essential);
        if (!essential) {
            setIngredientData(sortIngredients(ingredients));
        } else {
            setIngredientData(sortIngredientsSimple(ingredients));
        }
    }

    function sortIngredientsSimple(ingredientList: any[]) {
        let sortedIngreds = [...ingredientList];
        sortedIngreds.sort((a, b) => {
            if (a.complete && !b.complete) return 1;
            if (!a.complete && b.complete) return -1;

            const sourceA = a.category ? a.category.toLowerCase() : '';
            const sourceB = b.category ? b.category.toLowerCase() : '';

            if (sourceA < sourceB) return -1;
            if (sourceA > sourceB) return 1;

            const searchTermA = a.name ? a.name.toLowerCase() : '';
            const searchTermB = b.name ? b.name.toLowerCase() : '';

            if (searchTermA < searchTermB) return -1;
            if (searchTermA > searchTermB) return 1;

            return 0;
        });
        return sortedIngreds;
    }

    function sortIngredients(ingredientList: any[]) {
        let sortedIngreds = [...ingredientList];
        sortedIngreds.sort((a, b) => {
            if (a.complete && !b.complete) return 1;
            if (!a.complete && b.complete) return -1;

            const sourceA = a.options && a.options.length > 0 ? a.options[0].source.toLowerCase() : '';
            const sourceB = b.options && b.options.length > 0 ? b.options[0].source.toLowerCase() : '';

            if (sourceA < sourceB) return -1;
            if (sourceA > sourceB) return 1;

            const catA = a.category ? a.category.toLowerCase() : '';
            const catB = b.category ? b.category.toLowerCase() : '';

            if (catA < catB) return -1;
            if (catA > catB) return 1;

            const searchTermA = a.name ? a.name.toLowerCase() : '';
            const searchTermB = b.name ? b.name.toLowerCase() : '';

            if (searchTermA < searchTermB) return -1;
            if (searchTermA > searchTermB) return 1;

            return 0;
        });
        return sortedIngreds;
    }

    async function openModal(ingredName: string) {
        setIsOpen(true);
        setSelectedIngred(ingredName);
    }

    async function closeModal() {
        setIsOpen(false);
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="bg-white/5 border border-white/10 rounded-xl p-0 overflow-hidden w-full backdrop-blur-md shadow-xl">
                <div className="grid grid-cols-12 items-center mb-4 p-3 bg-muted/50 rounded-t-xl font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    <div className="col-span-1 text-center">Bought</div>
                    <div className="col-span-2 text-center md:text-left">Amount</div>
                    <div className={essential ? "col-span-6" : "col-span-3"}>Search Term</div>
                    {essential ? (
                        <div className="col-span-3 text-center md:text-left">Category</div>
                    ) : (
                        <>
                            <div className="col-span-2">Product</div>
                            <div className="col-span-1 text-center hidden md:block">Source</div>
                            <div className="col-span-2 hidden md:block">Category</div>
                            <div className="col-span-1 font-bold">Total</div>
                        </>
                    )}
                    {modifyColumnName && <div className="col-span-1 text-center">{modifyColumnName}</div>}
                </div>

                {ingredientData.map((ingred, index) => (
                    <div key={index} className="mb-3 px-3">
                        <div
                            className={`grid grid-cols-12 items-center bg-card text-card-foreground border border-border shadow-sm rounded-lg p-3 transition-all duration-300 ${ingred.complete ? 'opacity-60 grayscale' : 'opacity-100'}`}
                        >
                            <div className="col-span-1 text-center flex justify-center">
                                <input
                                    type="checkbox"
                                    checked={ingred.complete}
                                    onChange={() => handleCheckboxChange(ingred)}
                                    className="w-5 h-5 cursor-pointer accent-primary"
                                />
                            </div>

                            <div className="col-span-2 text-base md:text-lg font-semibold text-center md:text-left truncate px-1">
                                {ingred.quantity} {ingred.quantity_type}
                            </div>

                            <div className={essential ? "col-span-6" : "col-span-3"}>
                                <div
                                    onClick={() => openModal(ingred.name)}
                                    className="cursor-pointer hover:text-primary transition-colors truncate px-1"
                                >
                                    {ingred.complete ? (
                                        <del className="text-muted-foreground">{ingred.name}</del>
                                    ) : (
                                        <span className="text-base md:text-lg font-medium">{ingred.name}</span>
                                    )}
                                </div>
                            </div>

                            {!essential && (
                                <>
                                    <div className="col-span-2 text-xs md:text-sm text-muted-foreground truncate px-1">
                                        {ingred.options && ingred.options[0]?.name ? ingred.options[0].name : ingred.name}
                                    </div>

                                    <div className="col-span-1 hidden md:flex justify-center items-center">
                                        {ingred.loading ? (
                                            <Skeleton width="24px" height="24px" circle className="mx-auto" />
                                        ) : (
                                            ingred.options && ingred.options[0]?.source && (
                                                <img
                                                    style={{ maxWidth: '24px', borderRadius: '4px' }}
                                                    src={`/${ingred.options[0].source}.png`}
                                                    alt={ingred.options[0].source}
                                                />
                                            )
                                        )}
                                    </div>
                                </>
                            )}

                            <div className={`${essential ? "col-span-3" : "col-span-2 hidden md:flex"} flex items-center justify-center md:justify-start gap-2`}>
                                {ingred.category && (
                                    <>
                                        <img
                                            src={`/categories/${ingred.category.replace(/\s/g, '')}.png`}
                                            style={{ maxWidth: '24px', opacity: 0.8 }}
                                            alt={ingred.category}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <span className="text-sm hidden lg:inline">{ingred.category}</span>
                                    </>
                                )}
                            </div>

                            {!essential && (
                                <div className="col-span-1 font-semibold text-right md:text-left text-sm md:text-base pr-2">
                                    ${(ingred.options && ingred.options[0] ? ingred.options[0].unit_price * ingred.quantity : 0).toFixed(2)}
                                </div>
                            )}

                            {modifyColumnName && (
                                <div className="col-span-1 flex justify-center">
                                    {modifyColumnName === "Incorrect" ? (
                                        <button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded p-1 min-w-[32px] text-xs h-8 flex items-center justify-center" onClick={() => markAsIncorrect(ingred.options && ingred.options[0]?._id, ingred.name)}>
                                            &times;
                                        </button>
                                    ) : modifyColumnName === "Remove" ? (
                                        <button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded p-1 min-w-[32px] text-xs h-8 flex items-center justify-center" onClick={(e) => handleDeleteItem(e, ingred._id)}>
                                            &times;
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                style={{
                    content: {
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                        maxWidth: '800px',
                        margin: '0 auto',
                        padding: '2rem',
                        borderRadius: '1.5rem',
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 2000
                    }
                }}
                contentLabel="Ingredient Research"
            >
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                        <h2 className="text-2xl font-bold m-0">Ingredient Research</h2>
                        <button
                            className="text-muted-foreground hover:text-foreground text-3xl leading-none"
                            onClick={closeModal}
                        >
                            &times;
                        </button>
                    </div>
                    <IngredientSearchList search_term={selectedIngred} />
                </div>
            </Modal>

            <div className="flex justify-between items-center mt-6 bg-card border border-border rounded-xl p-6 shadow-sm">
                <h2 className="text-xl m-0 font-bold">Total: <span className="text-primary">${calculateTotalOfList()}</span></h2>
                <button
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    onClick={toggleEssentials}
                >
                    {essential ? 'Show All Details' : 'Hide Extra Crap'}
                </button>
            </div>
        </div>
    );
}

export default IngredientTable;
