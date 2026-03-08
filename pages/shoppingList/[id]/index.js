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
                    <div className="flex-row justify-between align-center mb-3 w-full">
                        <h1 className="bold uppercase m-0" style={{ fontFamily: 'var(--receipt-font)' }}>🛒 {list.name}</h1>
                        <div className="text-center">
                            <h4 className="bold m-0" style={{ fontFamily: 'var(--receipt-font)' }}>TOTAL: ${calculateTotalOfList(matchedListIngreds)}</h4>
                            <span className="small uppercase" style={{ color: '#666', fontFamily: 'var(--receipt-font)' }}>({matchedListIngreds.length} items)</span>
                        </div>
                    </div>
                    <div style={{ borderTop: '2px dashed #ccc', width: '100%', marginBottom: '1.5rem' }}></div>

                    {/* Actions & Filters */}
                    <div className="flex-row gap-2 mb-4 w-full">
                        <button
                            className={`btn-paper ${createNewIngredOpen ? 'btn-danger' : ''}`}
                            onClick={() => setCreateNewIngredOpen(!createNewIngredOpen)}
                        >
                            {createNewIngredOpen ? 'CANCEL' : '➕ ADD ITEM'}
                        </button>

                        <div className="ms-auto">
                            <ToggleList
                                inputList={availableFilters}
                                onUpdateList={(currentState) => setFilters(currentState)}
                                value={filters}
                                text={"Group By"}
                            />
                        </div>
                    </div>

                    {createNewIngredOpen && (
                        <div className="receipt w-full mb-4">
                            <h5 className="bold uppercase mb-2">New Item</h5>
                            <AddShoppingItem
                                shoppingListId={id}
                                handleSubmit={handleSubmitCreateNewItem}
                                reload={getRecipeDetails}
                            />
                        </div>
                    )}

                    {/* Supplier Filter */}
                    {filters.includes("supplier") && (
                        <div className="receipt w-full mb-4" style={{ padding: '1rem' }}>
                            <h6 className="bold uppercase mb-2" style={{ fontSize: '0.8rem' }}>Active Suppliers:</h6>
                            <ImageList
                                images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]}
                                onImageChange={(e) => handleActiveSupplierChange(e)}
                            />
                        </div>
                    )}

                    {/* Ingredients List */}
                    <div className="w-full">
                        {sortedGroups.map((group) => {
                            const ingredientsInGroup = groupedIngredients[group];
                            if (!ingredientsInGroup || ingredientsInGroup.length === 0) return null;

                            return (
                                <div key={group} className="receipt w-full mb-3" style={{ padding: '0' }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px dashed #ccc', backgroundColor: '#fafcf7' }}>
                                        <h6 className="bold uppercase m-0">
                                            <CategoryImage
                                                data={groupedIngredients}
                                                order={sortedGroups}
                                                current={group}
                                            >
                                                <span style={{ marginLeft: '0.5rem' }}>{group}</span>
                                            </CategoryImage>
                                        </h6>
                                    </div>
                                    <div>
                                        <NewIngredientTable
                                            reload={() => reloadAllIngredients()}
                                            ingredients={ingredientsInGroup.sort(ingredientSortFunction)}
                                            handleCheckboxChange={handleCheckboxChange}
                                            handleDeleteItem={handleDeleteItem}
                                            filters={filters}
                                            enabledSuppliers={enabledSuppliers}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex-col align-center gap-2 mt-4 pb-5 w-full">
                        <CopyToClipboard listIngreds={listIngreds} />
                        <button
                            onClick={() => markListAsComplete()}
                            className="btn-paper btn-success"
                            style={{ padding: '1rem 2rem' }}
                        >
                            ✅ MARK AS COMPLETE
                        </button>
                        <p className="small text-center mt-2 uppercase" style={{ color: '#888' }}>ID: {id}</p>
                    </div>

                </main>
            </div>
        </div>
    );
}