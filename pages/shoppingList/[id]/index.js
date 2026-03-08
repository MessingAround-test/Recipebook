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
                    1,
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
        let data = await (await fetch(`/api/ShoppingListItem/?shoppingListId=${id}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        setlistIngreds(data.res)
    }

    async function getRecipeDetails() {
        let data = await (await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
        setlist(data.res)
    }

    async function markListAsComplete() {
        const isConfirmed = confirm("Are you sure you want to mark this list as COMPLETE?");
        if (!isConfirmed) return;

        const response = await fetch(`/api/ShoppingList/${String(id)}/?EDGEtoken=${localStorage.getItem('Token')}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
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
            const response = await fetch(`/api/ShoppingListItem/?EDGEtoken=${localStorage.getItem('Token')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            const response = await fetch(`/api/ShoppingListItem/${id}?EDGEtoken=${localStorage.getItem('Token')}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
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
            const response = await fetch(`/api/ShoppingListItem/${id}?EDGEtoken=${localStorage.getItem('Token')}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
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

    const groupedIngredients = groupByKeys(matchedListIngreds, filters);
    const sortedGroups = Object.keys(groupedIngredients).sort(sortFunction);

    return (
        <div className={styles.wrapper}>
            <Toolbar />
            <Head>
                <title>Shopping List | {list.name || 'Loading...'}</title>
            </Head>

            <div className={styles.container}>
                <main className={styles.main}>

                    {/* Header */}
                    <div className="flex-row justify-between align-center mb-6 w-full glass-card p-6">
                        <h1 className="text-4xl font-bold m-0 tracking-tight">🛒 {list.name}</h1>
                        <div className="text-right flex flex-col justify-center">
                            <h4 className="text-2xl font-bold m-0 text-[var(--accent)]">TOTAL: <span className="text-white">${calculateTotalOfList(matchedListIngreds)}</span></h4>
                            <span className="text-sm font-medium text-gray-400 mt-1 uppercase">({matchedListIngreds.length} items)</span>
                        </div>
                    </div>

                    {/* Actions & Filters */}
                    <div className="flex items-center gap-4 mb-6 w-full">
                        <button
                            className={`btn-modern ${createNewIngredOpen ? 'btn-danger' : ''}`}
                            onClick={() => setCreateNewIngredOpen(!createNewIngredOpen)}
                        >
                            {createNewIngredOpen ? 'CANCEL' : '➕ ADD ITEM'}
                        </button>

                        <div className="ml-auto">
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
                        <div className="glass-card w-full mb-6" style={{ padding: '1.5rem' }}>
                            <h6 className="font-bold uppercase tracking-wider text-gray-400 mb-4" style={{ fontSize: '0.85rem' }}>Active Suppliers</h6>
                            <ImageList
                                images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]}
                                onImageChange={(e) => handleActiveSupplierChange(e)}
                            />
                        </div>
                    )}

                    {/* Ingredients List */}
                    <div className="w-full flex flex-col gap-6">
                        {sortedGroups.map((group) => {
                            const ingredientsInGroup = groupedIngredients[group];
                            if (!ingredientsInGroup || ingredientsInGroup.length === 0) return null;

                            // Apply dynamic colors to the group wrapper based on the group name
                            const groupColorAccent = getColorForCategory(group);
                            const groupColorLight = getLightColorForCategory(group);

                            return (
                                <div key={group} className="glass-card w-full" style={{ padding: '0', overflow: 'hidden' }}>
                                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-secondary)' }}>
                                        <h6 className="font-bold uppercase tracking-wider text-lg m-0 flex items-center text-white">
                                            <CategoryImage
                                                data={groupedIngredients}
                                                order={sortedGroups}
                                                current={group}
                                            >
                                                <span style={{ marginLeft: '0.75rem' }}>{group}</span>
                                            </CategoryImage>
                                        </h6>
                                    </div>
                                    <div className="p-4 bg-[var(--bg-main)]">
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