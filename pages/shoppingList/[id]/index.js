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
import CategoryImage from '../../../components/CategoryImage'
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
    const [enabledSuppliers, setEnabledSuppliers] = useState(["WW", "Panetta", "IGA", "Aldi", "Coles"])
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
                    60,
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
                total += (item.options[0].total_price / item.options[0].match_efficiency * 100)
            }
        })
        return total.toFixed(2);
    }

    function calculateMedianSupplierTotal(items, suppliers) {
        const supplierTotals = calculateSupplierTotals(items, suppliers);
        const costs = Object.values(supplierTotals)
            .filter(data => data.itemsFound > 0)
            .map(data => data.cost)
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
        const totals = {};
        suppliers.forEach(supplier => {
            totals[supplier] = { cost: 0, itemsFound: 0 };
        });

        items.forEach(item => {
            if (!item.options || item.options.length === 0) return;

            suppliers.forEach(supplier => {
                // Find all options from this supplier
                const supplierOptions = item.options.filter(opt => opt.source === supplier);
                if (supplierOptions.length > 0) {
                    // Options seem to be already sorted by price, but let's be safe and find the minimum total_price explicitly.
                    // Assuming options are objects mapped from filter():
                    let cheapestOption = supplierOptions[0];
                    for (let i = 1; i < supplierOptions.length; i++) {
                        if (supplierOptions[i].total_price < cheapestOption.total_price) {
                            cheapestOption = supplierOptions[i];
                        }
                    }

                    totals[supplier].cost += (cheapestOption.total_price / cheapestOption.match_efficiency * 100);
                    totals[supplier].itemsFound += 1;
                }
            });
        });

        return totals;
    }

    const handleSupplierClick = (supplier) => {
        const isCurrentlyOnlyEnabled = enabledSuppliers.length === 1 && enabledSuppliers[0] === supplier;

        if (isCurrentlyOnlyEnabled) {
            // Reset to all suppliers
            const allSuppliers = ["WW", "Panetta", "IGA", "Aldi", "Coles"];
            setEnabledSuppliers(allSuppliers);
            setPendingSuppliers({
                "/WW.png": true,
                "/Panetta.png": true,
                "/IGA.png": true,
                "/Aldi.png": true,
                "/Coles.png": true
            });
            // Remove "supplier" from filters
            setFilters(filters.filter(f => f !== "supplier"));
        } else {
            // Filter to just this supplier
            setEnabledSuppliers([supplier]);
            const newPending = {
                "/WW.png": supplier === "WW",
                "/Panetta.png": supplier === "Panetta",
                "/IGA.png": supplier === "IGA",
                "/Aldi.png": supplier === "Aldi",
                "/Coles.png": supplier === "Coles"
            };
            setPendingSuppliers(newPending);
            // Add "supplier" to filters if not present
            if (!filters.includes("supplier")) {
                setFilters([...filters, "supplier"]);
            }
        }
    };

    const groupedIngredients = groupByKeys(matchedListIngreds, filters);
    const sortedGroups = Object.keys(groupedIngredients).sort(sortFunction);

    return (
        <div className={styles.wrapper}>
            <Toolbar />
            <Head>
                <title>{`Shopping List | ${list?.name || 'Loading...'}`}</title>
            </Head>

            <div className={styles.container}>
                <main className={styles.main}>

                    {/* Header */}
                    <div className="flex-row justify-between align-center mb-6 w-full glass-card p-4">
                        <h1 className="text-2xl font-bold m-0 tracking-tight">🛒 {list?.name || 'Loading...'}</h1>
                        <div className="text-right flex flex-col justify-center">
                            <h4 className="text-lg font-bold m-0 text-[var(--accent)]">
                                EST. COST: <span className="text-white">${calculateTotalOfList(matchedListIngreds)} - ${calculateMedianSupplierTotal(matchedListIngreds, enabledSuppliers)}</span>
                            </h4>
                            <span className="text-[10px] font-medium text-gray-400 mt-0.5 uppercase">({matchedListIngreds.length} items)</span>
                        </div>
                    </div>

                    {/* Actions & Filters */}
                    <div className="flex items-center gap-4 mb-6 w-full relative z-[100]">
                        <button
                            className={`btn-modern scale-90 ${createNewIngredOpen ? 'btn-danger' : ''}`}
                            onClick={() => setCreateNewIngredOpen(!createNewIngredOpen)}
                        >
                            {createNewIngredOpen ? 'CANCEL' : '➕ ADD ITEM'}
                        </button>

                        <div className="ml-auto min-w-[200px]">
                            <ToggleList
                                inputList={availableFilters}
                                onUpdateList={(currentState) => setFilters(currentState)}
                                value={filters}
                                text={"Group By"}
                            />
                        </div>
                    </div>

                    {createNewIngredOpen && (
                        <div className="w-full mb-6">
                            <AddShoppingItem
                                shoppingListId={id}
                                handleSubmit={handleSubmitCreateNewItem}
                                reload={getRecipeDetails}
                            />
                        </div>
                    )}

                    {/* Supplier Filter */}
                    {filters.includes("supplier") && (
                        <div className="glass-card w-full mb-6" style={{ padding: '1rem 1.25rem' }}>
                            <h6 className="font-bold uppercase tracking-wider text-gray-500 mb-3" style={{ fontSize: '0.7rem' }}>Active Suppliers</h6>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="scale-90 origin-left">
                                    <ImageList
                                        images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]}
                                        onImageChange={(e) => setPendingSuppliers(e)}
                                        value={pendingSuppliers}
                                    />
                                </div>
                                <button
                                    className="btn-modern !bg-emerald-500 hover:!bg-emerald-400 !text-black px-4 py-1.5 rounded-md font-bold text-xs"
                                    onClick={() => updateSupplierFromInputObject(pendingSuppliers)}
                                >
                                    APPLY FILTER
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ingredients List */}
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
                        {sortedGroups.map((group) => {
                            const ingredientsInGroup = groupedIngredients[group];
                            if (!ingredientsInGroup || ingredientsInGroup.length === 0) return null;

                            // Apply dynamic colors to the group wrapper based on the group name
                            const groupColorAccent = getColorForCategory(group);
                            const groupColorLight = getLightColorForCategory(group);

                            return (
                                <div key={group} className="glass-card w-full" style={{ padding: '0', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-secondary)' }}>
                                        <h6 className="font-bold uppercase tracking-wider text-base m-0 flex items-center text-white">
                                            <CategoryImage
                                                data={groupedIngredients}
                                                order={sortedGroups}
                                                current={group}
                                            >
                                                <span style={{ marginLeft: '0.6rem' }}>
                                                    {group.split('|')
                                                        .map(p => p.includes('=') ? p.split('=')[1] : p)
                                                        .filter(v => v !== 'true' && v !== 'false')
                                                        .join(' ')
                                                    }
                                                </span>
                                            </CategoryImage>
                                        </h6>
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

                        {/* Supplier Totals Cards */}
                        <div className="w-full mb-6">
                            <h3 className="text-xl font-bold mb-4 text-center text-white">Cheapest Single-Supplier Options</h3>
                            <div className="flex flex-wrap justify-center gap-4">
                                {Object.entries(calculateSupplierTotals(matchedListIngreds, enabledSuppliers))
                                    .sort((a, b) => a[1].cost - b[1].cost) // Sort by cost ascending
                                    .map(([supplier, data]) => {
                                        if (data.itemsFound === 0) return null;

                                        // Calculate percentage of items found
                                        const percentFound = Math.round((data.itemsFound / matchedListIngreds.length) * 100);
                                        const allFound = data.itemsFound === matchedListIngreds.length;
                                        const supplierColor = getColorForCategory(supplier) || 'var(--accent)';

                                        return (
                                            <div
                                                key={supplier}
                                                onClick={() => handleSupplierClick(supplier)}
                                                className="glass-card flex flex-col p-4 w-48 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer group hover:border-[var(--accent)]"
                                                style={{ borderColor: `${supplierColor}40` }}
                                            >
                                                {/* Top accent bar */}
                                                <div className="absolute top-0 left-0 right-0 h-1 transition-height duration-300 group-hover:h-2" style={{ backgroundColor: supplierColor }}></div>

                                                <div className="flex items-center justify-between mb-2">
                                                    <img src={`/${supplier}.png`} alt={supplier} className="h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                                                    <span className="font-bold text-gray-300 uppercase tracking-wider text-xs" style={{ display: 'none' }}>{supplier}</span>
                                                </div>

                                                <div className="mt-2 text-2xl font-bold text-white">
                                                    ${data.cost.toFixed(2)}
                                                </div>

                                                <div className="mt-1 flex items-center gap-2 relative">
                                                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${allFound ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {data.itemsFound}/{matchedListIngreds.length} items found
                                                        <Info size={12} className="opacity-70 group-hover:opacity-100" />
                                                    </div>

                                                    {/* Tooltip hint */}
                                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-[10px] text-white rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-10 text-center">
                                                        Click to filter by {supplier}
                                                        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        <CopyToClipboard listIngreds={listIngreds} />
                        <button
                            onClick={() => markListAsComplete()}
                            className="btn-modern !bg-emerald-500 hover:!bg-emerald-400 !text-black text-lg py-4 px-8 w-full max-w-md shadow-lg shadow-emerald-500/20"
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