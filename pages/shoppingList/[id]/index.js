import Head from 'next/head'
import styles from '../../../styles/Home.module.css'
import { Toolbar } from '../../Toolbar'
import { useEffect, useState } from 'react'
import Router from 'next/router'
import { useRouter } from 'next/router'
import ImageList from '../../../components/ImageList'
import CopyToClipboard from '../../../components/CopyToClipboard'
import AddShoppingItem from '../../../components/AddShoppingItem'
import NewIngredientTable from '../../../components/NewIngredientTable'
import ToggleList from '../../../components/ToggleList'
import { getGroceryStoreProducts } from '../../../lib/commonAPIs'
import { groupByKeys } from '../../../lib/grouping'
import { getColorForCategory, getLightColorForCategory } from '../../../lib/colors'
import { Info } from 'lucide-react'

export default function Home() {
    const [userData, setUserData] = useState({})
    const router = useRouter()
    const { id } = router.query
    const [list, setlist] = useState({})
    const [listIngreds, setlistIngreds] = useState([])
    const [matchedListIngreds, setMatchedListIngreds] = useState([])
    const [isLoading, setLoading] = useState(false)
    const [createNewIngredOpen, setCreateNewIngredOpen] = useState(false)
    const [enabledSuppliers, setEnabledSuppliers] = useState(["WW", "Panetta", "IGA", "Aldi"])
    // , "Coles"
    const [pendingSuppliers, setPendingSuppliers] = useState({
        "/WW.png": true,
        "/Panetta.png": true,
        "/IGA.png": true,
        "/Aldi.png": true,
        "/Coles.png": true
    })

    const [filters, setFilters] = useState(["complete"])
    const availableFilters = ["supplier", "category", "complete", "price_category", "quantity_type", "category_simple"]

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            Router.push("/login")
        }
        if (id) {
            getRecipeDetails()
        }
    }, [id])

    useEffect(() => {
        if (list._id !== undefined) {
            getShoppingListItems()
        }
    }, [list])

    const reloadAllIngredients = async () => {
        let updatedListIngreds = listIngreds.map((ingred) => ({
            ...ingred,
            options: [],
            loading: true,
        }));
        setMatchedListIngreds(updatedListIngreds);

        for (let i = 0; i < updatedListIngreds.length; i++) {
            try {
                const updatedIngredient = await getGroceryStoreProducts(
                    updatedListIngreds[i],
                    1000, // Increased from 60 to 1000
                    enabledSuppliers,
                    localStorage.getItem('Token')
                );

                updatedListIngreds[i] = {
                    ...updatedIngredient,
                    loading: false,
                };
                setMatchedListIngreds([...updatedListIngreds]);
            } catch (error) {
                console.error(`Error updating ingredient: ${error.message}`);
            }
        }
    };

    const redirect = async function (page) {
        Router.push(page)
    };

    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    async function getShoppingListItems() {
        let res = await fetch(`/api/ShoppingListItem/?shoppingListId=${id}`, {
            headers: {
                'edgetoken': localStorage.getItem('Token') || ''
            }
        })
        let data = await res.json()
        setlistIngreds(data.res)
    }

    async function getRecipeDetails() {
        let res = await fetch("/api/ShoppingList/" + String(id), {
            headers: {
                'edgetoken': localStorage.getItem('Token') || ''
            }
        })
        let data = await res.json()
        setlist(data.res)
    }

    async function markListAsComplete() {
        const isConfirmed = confirm("Are you sure you want to mark this list as COMPLETE?");
        if (!isConfirmed) return;

        const response = await fetch(`/api/ShoppingList/${String(id)}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'edgetoken': localStorage.getItem('Token') || ''
            },
            body: JSON.stringify({ "complete": "true", "_id": String(id) }),
        });

        if (response.ok) {
            redirect("/shoppingList");
        } else {
            let error = await response.json();
            alert(error.message);
        }
    }

    async function handleSubmitCreateNewItem(e) {
        e.preventDefault();
        try {
            const response = await fetch(`/api/ShoppingListItem/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': localStorage.getItem('Token') || ''
                },
                body: JSON.stringify(e.value),
            });

            if (response.ok) {
                e.resetForm()
                getRecipeDetails()
            } else {
                let error = await response.json()
                alert(error.message)
            }
        } catch (error) {
            alert(error)
        }
    };

    async function handleDeleteItem(e, id) {
        e.preventDefault();
        try {
            const response = await fetch(`/api/ShoppingListItem/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': localStorage.getItem('Token') || ''
                }
            });

            if (response.ok) {
                getRecipeDetails()
            } else {
                let error = await response.json()
                alert(error.message)
            }
        } catch (error) {
            alert(error)
        }
    };

    async function searchForIndex(value, key, list) {
        return new Promise((resolve) => {
            const index = list.findIndex(item => item[key] === value);
            resolve(index);
        });
    }

    async function handleCheckboxChange(ingred) {
        const updatedIngredients = [...matchedListIngreds];
        let index = await searchForIndex(ingred._id, "_id", updatedIngredients)
        updatedIngredients[index].complete = !updatedIngredients[index].complete;
        setMatchedListIngreds(updatedIngredients);
        await updateCompleteInDB(updatedIngredients[index]._id, updatedIngredients[index].complete)
    };

    async function updateCompleteInDB(id, complete) {
        try {
            const response = await fetch(`/api/ShoppingListItem/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'edgetoken': localStorage.getItem('Token') || ''
                },
                body: JSON.stringify({ "complete": complete }),
            });
            if (!response.ok) {
                let error = await response.json()
                alert(error.message)
            }
        } catch (error) {
            alert(error)
        }
    }

    async function updateSupplierFromInputObject(inputObject) {
        const resultArray = Object.keys(inputObject).filter(key => inputObject[key]);
        const formattedResultArray = resultArray.map(key => key.replace(/^\/|\.png$/g, ''));
        setEnabledSuppliers(formattedResultArray)
    };

    function sortFunction(a, b) {
        const aIsComplete = a.includes("complete=true");
        const bIsComplete = b.includes("complete=true");
        if (aIsComplete && !bIsComplete) return 1;
        if (!aIsComplete && bIsComplete) return -1;
        return a.localeCompare(b);
    }

    function ingredientSortFunction(a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }

    useEffect(() => {
        reloadAllIngredients();
    }, [enabledSuppliers]);

    function calculateTotalOfList(items) {
        let total = 0
        items.forEach((item) => {
            if (item.options && item.options.length > 0) {
                // Find the cheapest option by purchase PRICE, not efficiency/usage price
                let cheapestOption = item.options.reduce((prev, curr) => (prev.price < curr.price) ? prev : curr);
                total += cheapestOption.price;
            }
        })
        return total.toFixed(2);
    }

    function calculateMedianSupplierTotal(items, suppliers) {
        const combinations = calculateSupplierTotals(items, suppliers);
        const costs = combinations
            .filter(opt => opt.suppliers.length === 1 && opt.itemsFound > 0)
            .map(opt => opt.cost)
            .sort((a, b) => a - b);

        if (costs.length === 0) return "0.00";
        if (costs.length === 1) return costs[0].toFixed(2);

        const mid = Math.floor(costs.length / 2);
        const median = costs.length % 2 !== 0
            ? costs[mid]
            : (costs[mid - 1] + costs[mid]) / 2;

        return median.toFixed(2);
    }

    function calculateSupplierTotals(items, suppliers) {
        const singleResults = {};

        // Single supplier combinations
        suppliers.forEach(supplier => {
            let cost = 0;
            let itemsFound = 0;
            items.forEach(item => {
                if (!item.options || item.options.length === 0) return;
                const supplierOptions = item.options.filter(opt => opt.source === supplier);
                if (supplierOptions.length > 0) {
                    let cheapestOption = supplierOptions.reduce((prev, curr) => (prev.price < curr.price) ? prev : curr);
                    cost += cheapestOption.price;
                    itemsFound += 1;
                }
            });
            singleResults[supplier] = { suppliers: [supplier], cost, itemsFound };
        });

        const combinations = Object.values(singleResults);

        // Double supplier combinations
        for (let i = 0; i < suppliers.length; i++) {
            for (let j = i + 1; j < suppliers.length; j++) {
                const s1 = suppliers[i];
                const s2 = suppliers[j];
                const supplierPair = [s1, s2];
                let cost = 0;
                let itemsFound = 0;

                items.forEach(item => {
                    if (!item.options || item.options.length === 0) return;
                    const pairOptions = item.options.filter(opt => supplierPair.includes(opt.source));
                    if (pairOptions.length > 0) {
                        let cheapestOption = pairOptions.reduce((prev, curr) => (prev.price < curr.price) ? prev : curr);
                        cost += cheapestOption.price;
                        itemsFound += 1;
                    }
                });

                // Redundancy check: Only add if it's better than either single supplier
                const res1 = singleResults[s1];
                const res2 = singleResults[s2];

                const betterThanS1 = itemsFound > res1.itemsFound || (itemsFound === res1.itemsFound && cost < res1.cost);
                const betterThanS2 = itemsFound > res2.itemsFound || (itemsFound === res2.itemsFound && cost < res2.cost);

                if (betterThanS1 && betterThanS2) {
                    combinations.push({ suppliers: supplierPair, cost, itemsFound });
                }
            }
        }

        return combinations;
    }

    const resetToDefault = () => {
        const allSuppliers = ["WW", "Panetta", "IGA", "Aldi", "Coles"];
        setEnabledSuppliers(allSuppliers);
        setPendingSuppliers({
            "/WW.png": true,
            "/Panetta.png": true,
            "/IGA.png": true,
            "/Aldi.png": true,
            "/Coles.png": true
        });
        setFilters(["complete"]);
    };

    const handleSupplierClick = (suppliersInput) => {
        // Support both single string and array of suppliers
        const suppliers = Array.isArray(suppliersInput) ? suppliersInput : [suppliersInput];

        const isCurrentlySame = enabledSuppliers.length === suppliers.length &&
            suppliers.every(s => enabledSuppliers.includes(s));

        if (isCurrentlySame) {
            // If already filtered to exactly these, reset to all
            const allSuppliers = ["WW", "Panetta", "IGA", "Aldi", "Coles"];
            setEnabledSuppliers(allSuppliers);
            setPendingSuppliers({
                "/WW.png": true,
                "/Panetta.png": true,
                "/IGA.png": true,
                "/Aldi.png": true,
                "/Coles.png": true
            });
            setFilters(filters.filter(f => f !== "supplier"));
        } else {
            // Filter to the selected suppliers
            setEnabledSuppliers(suppliers);
            const newPending = {
                "/WW.png": suppliers.includes("WW"),
                "/Panetta.png": suppliers.includes("Panetta"),
                "/IGA.png": suppliers.includes("IGA"),
                "/Aldi.png": suppliers.includes("Aldi"),
                "/Coles.png": suppliers.includes("Coles")
            };
            setPendingSuppliers(newPending);
            if (!filters.includes("supplier")) {
                setFilters([...filters, "supplier"]);
            }
        }
    };

    const activeFilters = [...filters].sort((a, b) => {
        if (a === 'supplier') return -1;
        if (b === 'supplier') return 1;
        return 0;
    });
    const groupedIngredients = groupByKeys(matchedListIngreds, activeFilters);
    const sortedGroups = Object.keys(groupedIngredients).sort(sortFunction);

    const totalCost1 = parseFloat(calculateTotalOfList(matchedListIngreds));
    const totalCost2 = parseFloat(calculateMedianSupplierTotal(matchedListIngreds, enabledSuppliers));
    const displayTotalMin = Math.min(totalCost1, totalCost2).toFixed(2);
    const displayTotalMax = Math.max(totalCost1, totalCost2).toFixed(2);

    return (
        <div className={styles.wrapper}>
            <Toolbar />
            <Head>
                <title>{`Shopping List | ${list?.name || 'Loading...'}`}</title>
            </Head>

            <div className={styles.container}>
                <main className={styles.main}>

                    {/* Consolidated Header & Actions */}
                    <div className="glass-card w-full mb-6 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 relative z-[100]">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-xl sm:text-2xl font-bold m-0 tracking-tight flex items-center gap-2">
                                <span>🛒</span>
                                <span className="truncate max-w-[200px] sm:max-w-none">{list?.name || 'Loading...'}</span>
                            </h1>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h4 className="text-[10px] sm:text-sm font-bold m-0 text-[var(--accent)] uppercase tracking-wide">
                                    EST. COST: <span className="text-white">${displayTotalMin} - ${displayTotalMax}</span>
                                </h4>
                                <span className="text-[10px] font-medium text-gray-400 uppercase opacity-70">({matchedListIngreds.length} items)</span>
                            </div>
                        </div>

                        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            {!createNewIngredOpen && (
                                <button
                                    className="btn-modern !py-2.5 !px-4 text-[10px] sm:text-xs flex-1 sm:flex-none whitespace-nowrap"
                                    onClick={() => setCreateNewIngredOpen(true)}
                                >
                                    ➕ ADD ITEM
                                </button>
                            )}
                            <div className="flex-1 sm:min-w-[170px] sm:flex-none">
                                <ToggleList
                                    inputList={availableFilters}
                                    onUpdateList={(currentState) => setFilters(currentState)}
                                    value={filters}
                                    text={"Group By"}
                                />
                            </div>
                        </div>
                    </div>

                    {createNewIngredOpen && (
                        <div className="w-full mb-6">
                            <AddShoppingItem
                                shoppingListId={id}
                                handleSubmit={handleSubmitCreateNewItem}
                                reload={getRecipeDetails}
                                onCancel={() => setCreateNewIngredOpen(false)}
                            />
                        </div>
                    )}

                    {/* Secondary Filters (Suppliers) */}
                    {filters.includes("supplier") && (
                        <div className="flex flex-col gap-4 mb-3 w-full">
                            <div className="glass-card w-full p-3 sm:p-4">
                                <h6 className="font-bold uppercase tracking-wider text-gray-500 mb-2" style={{ fontSize: '0.65rem' }}>Active Suppliers</h6>
                                <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                                    <div className="scale-65 sm:scale-75 origin-left flex-1 min-w-[200px]">
                                        <ImageList
                                            images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]}
                                            onImageChange={(e) => setPendingSuppliers(e)}
                                            value={pendingSuppliers}
                                        />
                                    </div>
                                    <button
                                        className="btn-modern !bg-emerald-500 hover:!bg-emerald-400 !text-black px-4 py-2 sm:px-3 sm:py-1 rounded-md font-bold text-[10px] w-full sm:w-auto mt-2 sm:mt-0"
                                        onClick={() => updateSupplierFromInputObject(pendingSuppliers)}
                                    >
                                        APPLY
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ingredients List */}
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                        {sortedGroups.map((group) => {
                            const ingredientsInGroup = groupedIngredients[group];
                            if (!ingredientsInGroup || ingredientsInGroup.length === 0) return null;

                            const groupColorAccent = getColorForCategory(group);
                            const groupColorLight = getLightColorForCategory(group);

                            // Calculate group costs
                            const supplierResults = calculateSupplierTotals(ingredientsInGroup, enabledSuppliers);
                            const groupCost1 = parseFloat(calculateTotalOfList(ingredientsInGroup));
                            const groupCost2 = parseFloat(calculateMedianSupplierTotal(ingredientsInGroup, enabledSuppliers));
                            const groupMin = Math.min(groupCost1, groupCost2).toFixed(2);
                            const groupMax = Math.max(groupCost1, groupCost2).toFixed(2);

                            return (
                                <div key={group} className="glass-card w-full" style={{ padding: '0', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.5rem 1rem', sm: { padding: '0.75rem 1.25rem' }, borderBottom: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-secondary)' }}>
                                        <div className="flex justify-between items-center gap-2">
                                            <h6 className="font-bold uppercase tracking-wider text-xs sm:text-base m-0 flex flex-wrap items-center">
                                                {(() => {
                                                    const parts = group.split('|')
                                                        .map(p => p.includes('=') ? p.split('=')[1] : p)
                                                        .filter(v => v !== 'true' && v !== 'false' && v !== '');

                                                    if (parts.length === 0) {
                                                        if (group.includes("complete=true")) return <span className="text-emerald-400">✅ COMPLETED</span>;
                                                        return <span className="text-white">OTHER</span>;
                                                    }

                                                    return parts.map((part, index) => (
                                                        <span key={index} className="flex items-center">
                                                            <span style={{ color: getColorForCategory(part) || 'white' }}>
                                                                {part}
                                                            </span>
                                                            {index < parts.length - 1 && (
                                                                <span className="mx-1 sm:mx-2 text-gray-500 opacity-50">&</span>
                                                            )}
                                                        </span>
                                                    ));
                                                })()}
                                            </h6>
                                            <div className="text-right flex flex-col justify-center min-w-[80px]">
                                                <h4 className="font-bold m-0 text-[var(--accent)]" style={{ fontSize: '0.65rem', sm: { fontSize: '0.8rem' } }}>
                                                    <span className="hidden sm:inline">EST. COST: </span><span className="text-white">${groupMin} - ${groupMax}</span>
                                                </h4>
                                                <span className="text-[8px] sm:text-[9px] font-medium text-gray-400 mt-0.5 uppercase">({ingredientsInGroup.length} items)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-[var(--bg-main)]">
                                        <NewIngredientTable
                                            reload={() => reloadAllIngredients()}
                                            ingredients={ingredientsInGroup.sort(ingredientSortFunction)}
                                            handleCheckboxChange={handleCheckboxChange}
                                            handleDeleteItem={handleDeleteItem}
                                            filters={filters}
                                            enabledSuppliers={enabledSuppliers}
                                            groupColor={groupColorAccent}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col items-center gap-4 mt-8 pb-8 w-full border-t border-[var(--glass-border)] pt-8">

                        <div className="w-full mb-6">
                            <h3 className="text-xl font-bold mb-4 text-center text-white">Recommended Supplier Options</h3>
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-3 sm:gap-4">
                                {/* Reset View Option */}
                                <div
                                    onClick={resetToDefault}
                                    className="glass-card flex flex-col items-center justify-center p-3 sm:p-4 w-full sm:w-48 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer group hover:border-gray-500"
                                    style={{ borderColor: 'var(--glass-border)' }}
                                >
                                    <div className="text-2xl mb-1 group-hover:rotate-12 transition-transform">🔄</div>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reset View</div>
                                    <div className="text-[9px] text-gray-500 mt-1">Clear all filters</div>
                                </div>

                                {(() => {
                                    const allOptions = calculateSupplierTotals(matchedListIngreds, enabledSuppliers);
                                    const sortedOptions = allOptions.sort((a, b) => {
                                        if (b.itemsFound !== a.itemsFound) return b.itemsFound - a.itemsFound;
                                        return a.cost - b.cost;
                                    });

                                    const someComplete = sortedOptions.some(opt => opt.itemsFound === matchedListIngreds.length);

                                    return sortedOptions.slice(0, 5).map((option, idx) => {
                                        if (option.itemsFound === 0) return null;

                                        const allFound = option.itemsFound === matchedListIngreds.length;
                                        const isRecommended = someComplete ? allFound : idx < 2;
                                        const supplierNames = option.suppliers.join(' + ');
                                        const primarySupplier = option.suppliers[0];
                                        const supplierColor = getColorForCategory(primarySupplier) || 'var(--accent)';

                                        return (
                                            <div
                                                key={supplierNames}
                                                onClick={() => handleSupplierClick(option.suppliers)}
                                                className={`glass-card flex flex-col p-3 sm:p-4 w-full sm:w-48 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer group ${isRecommended ? 'border-2 border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]' : ''}`}
                                                style={{ borderColor: isRecommended ? supplierColor : `${supplierColor}40` }}
                                            >
                                                {isRecommended && (
                                                    <div className="absolute top-2 right-2 z-10">
                                                        <span className="bg-[var(--accent)] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">RECOMMENDED</span>
                                                    </div>
                                                )}

                                                <div className="absolute top-0 left-0 right-0 h-1 transition-height duration-300 group-hover:h-2" style={{ backgroundColor: supplierColor }}></div>

                                                <div className="flex items-center justify-between mb-1 sm:mb-2">
                                                    <div className="flex -space-x-2">
                                                        {option.suppliers.map(s => (
                                                            <img key={s} src={`/${s}.png`} alt={s} className="h-4 sm:h-6 w-4 sm:w-6 rounded-full border border-black object-contain bg-white" onError={(e) => { e.target.style.display = 'none'; }} />
                                                        ))}
                                                    </div>
                                                    <span className="font-bold text-gray-300 uppercase tracking-wider text-[8px] sm:text-xs truncate max-w-[60px]">{supplierNames}</span>
                                                </div>

                                                <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold text-white">
                                                    ${option.cost.toFixed(2)}
                                                </div>

                                                <div className="mt-1 flex items-center gap-2 relative">
                                                    <div className={`text-[8px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 ${allFound ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {option.itemsFound}/{matchedListIngreds.length} <span className="hidden sm:inline">found</span>
                                                        <Info size={10} className="sm:size-[12px] opacity-70 group-hover:opacity-100" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <CopyToClipboard listIngreds={listIngreds} />
                        <button
                            onClick={() => markListAsComplete()}
                            className="btn-modern !bg-emerald-500 hover:!bg-emerald-400 !text-black text-base sm:text-lg py-3 sm:py-4 px-8 w-full max-w-md shadow-lg shadow-emerald-500/20"
                        >
                            ✅ MARK AS COMPLETE
                        </button>
                        <p className="text-xs text-center mt-4 text-gray-500 uppercase tracking-widest font-mono">List ID: {id}</p>
                    </div>

                </main>
            </div>
        </div>
    );
}
