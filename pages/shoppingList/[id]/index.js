import Head from 'next/head'
import styles from '../../../styles/Home.module.css' // Assuming this provides global/container styles
import { Toolbar } from '../../Toolbar'
import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import { useRouter } from 'next/router'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
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
    const modifyColumnOptions = ["", "Incorrect", "Remove"]

    const [filters, setFilters] = useState(["complete"])
    const availableFilters = ["supplier", "category", "complete", "price_category", "quantity_type", "category_simple"]
    const [modifyColumnIndex, setModifyColumnIndex] = useState(0)

    async function handleActiveSupplierChange(inputObject) {
        await updateSupplierFromInputObject(inputObject)
    }

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
            // Load the ingredients on the list
            getShoppingListItems()
        }
    }, [list])


    const reloadAllIngredients = async () => {
        // While loading...
        let updatedListIngreds = listIngreds.map((ingred) => ({
            ...ingred,
            options: [],
            loading: true,
        }));
        setMatchedListIngreds(updatedListIngreds);

        // Use a loop to update the state for each ingredient individually
        for (let i = 0; i < updatedListIngreds.length; i++) {
            try {
                const updatedIngredient = await getGroceryStoreProducts(
                    updatedListIngreds[i],
                    1,
                    enabledSuppliers,
                    localStorage.getItem('Token')
                );

                // Update the state for the specific ingredient
                updatedListIngreds[i] = {
                    ...updatedIngredient,
                    loading: false,
                };
                setMatchedListIngreds([...updatedListIngreds]);
            } catch (error) {
                // Handle errors if needed
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
        // ⚠️ Added the confirmation dialog
        const isConfirmed = confirm("Are you sure you want to mark this list as COMPLETE? This action cannot be easily undone.");

        // If the user clicks 'Cancel', stop execution.
        if (!isConfirmed) {
            return;
        }

        // If the user clicks 'OK', proceed with the API call.
        const response = await fetch(`/api/ShoppingList/${String(id)}/?EDGEtoken=${localStorage.getItem('Token')}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "complete": "true", "_id": String(id) }),
        });

        if (response.ok) {
            // Assuming 'redirect' navigates the user away after completion
            redirect("/shoppingList");
        } else {
            let error = await response.json();
            console.log(error);
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
                console.log(e)
                getRecipeDetails()
            } else {
                let error = await response.json()
                console.log(error)
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

                console.log(e)
                getRecipeDetails()
            } else {
                let error = await response.json()
                console.log(error)
                alert(error.message)
            }
        } catch (error) {
            alert(error)
        }
    };

    async function searchForIndex(value, key, list) {
        return new Promise((resolve, reject) => {
            try {
                const index = list.findIndex(item => item[key] === value);
                resolve(index);
            } catch (error) {
                reject(error);
            }
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
            console.log(response)

            if (!response.ok) {
                let error = await response.json()
                console.log(error)
                alert(error.message)
            }
        } catch (error) {
            alert(error)
        }
    }

    async function updateSupplierFromInputObject(inputObject) {
        const resultArray = Object.keys(inputObject).filter(key => inputObject[key]);
        const formattedResultArray = resultArray.map(key => key.replace(/^\/|\.png$/g, ''));
        console.log(formattedResultArray);
        setEnabledSuppliers(formattedResultArray)
    };

    function sortFunction(a, b) {
        // Custom sorting logic: "complete=true" goes last
        const aIsComplete = a.includes("complete=true");
        const bIsComplete = b.includes("complete=true");
        if (aIsComplete && !bIsComplete) {
            return 1; // 'a' goes after 'b'
        } else if (!aIsComplete && bIsComplete) {
            return -1; // 'a' goes before 'b'
        } else {
            return a.localeCompare(b); // Default alphabetical sorting
        }
    }

    function ingredientSortFunction(a, b) {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return nameA.localeCompare(nameB);
    }

    useEffect(() => {
        // This code will run after the component renders and whenever enabledSuppliers changes
        reloadAllIngredients();
    }, [enabledSuppliers]);

    function calculateTotalOfList(items) {
        let efficientTotal = 0
        let total = 0
        items.forEach((item) => {
            if (item.options && item.options.length > 0) {
                efficientTotal += item.options[0].total_price
                total += (item.options[0].total_price / item.options[0].match_efficiency * 100)
            }
        }
        )
        return {
            "total": total.toFixed(2),
            "efficient_total": efficientTotal.toFixed(2)
        }
    }

    function showTotalOfList(items) {
        let res = calculateTotalOfList(items)
        return <h4 className="text-success my-0">Total: ${res.total}</h4>
    }

    const groupedIngredients = groupByKeys(matchedListIngreds, filters);
    const sortedGroups = Object.keys(groupedIngredients).sort(sortFunction);

    return (
        <div className={styles.wrapper}>
            <Toolbar />

            <Head>
                <title>Shopping List | {list.name || 'Loading...'}</title>
                <meta name="description" content="Manage your smart shopping list" />
                <link rel="icon" href="/avo.ico" />
            </Head>

            <Container className={`${styles.container} py-3 px-md-5`}>
                <main className={styles.main}>

                    {/* 🛒 Shopping List Header & Stats 📊 */}
                    <Row className="mb-4 align-items-center w-100">
                        <Col xs={12} md={8}>
                            <h1 className="mb-0">🛒 {list.name} <span className="text-secondary fs-5"></span></h1>
                        </Col>
                        <Col xs={12} md={4} className="text-md-end mt-2 mt-md-0">
                            {showTotalOfList(matchedListIngreds)}
                            <span className="text-muted small">({matchedListIngreds.length} items)</span>
                        </Col>
                    </Row>
                    <hr className="mb-4 w-100" />

                    {/* Top Action & Filter Row (Sticky on Mobile) */}
                    <Row className={`${styles['sticky-top-controls']} g-2 w-100`}>

                        {/* Add New Item (Left side, takes 6/12 width on mobile) */}
                        <Col xs={6} md={3} className="order-1 order-md-1">
                            <Button
                                variant={createNewIngredOpen ? "outline-danger" : "primary"}
                                onClick={() => setCreateNewIngredOpen(!createNewIngredOpen)}
                                className="w-100"
                            >
                                {createNewIngredOpen ? 'Close Add' : '➕ Add New Item'}
                            </Button>

                        </Col>

                        {/* Group By (Right side, takes 6/12 width on mobile) */}
                        <Col xs={6} md={{ span: 3, offset: 6 }} className="order-2 order-md-2">
                            <div className="w-100">
                                <ToggleList
                                    inputList={availableFilters}
                                    onUpdateList={(currentState) => setFilters(currentState)}
                                    value={filters}
                                    text={"Group By"}
                                    className="w-100"
                                />
                            </div>
                        </Col>
                        {createNewIngredOpen && (
                            <Card className="mb-4 border-primary w-100">
                                <Card.Body>
                                    <h5 className="card-title text-primary">New Shopping Item</h5>
                                    <AddShoppingItem
                                        shoppingListId={id}
                                        handleSubmit={handleSubmitCreateNewItem}
                                        reload={getRecipeDetails}
                                    />
                                </Card.Body>
                            </Card>
                        )}
                    </Row>


                    {/* Add New Ingredient Form (Keep the standard look for input forms) */}



                    {/* Supplier Filter (if enabled) - Updated to use same background */}
                    {filters.includes("supplier") && (
                        <Card className="mb-4 w-100" style={{ backgroundColor: '#394955' }}>
                            <Card.Body className="p-2">
                                <h6 className="card-subtitle mb-2 text-muted">Active Suppliers:</h6>
                                <ImageList
                                    images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]}
                                    onImageChange={(e) => handleActiveSupplierChange(e)}
                                />
                            </Card.Body>
                        </Card>
                    )}


                    {/* List Ingredients - Streamlined Grouped View */}
                    <div className={`${styles['ingredient-list-container']} w-100`}>
                        {sortedGroups.map((group) => {
                            const ingredientsInGroup = groupedIngredients[group];

                            // Conditional Check: Don't render if the array is empty or undefined
                            if (!ingredientsInGroup || ingredientsInGroup.length === 0) {
                                return null;
                            }

                            return (
                                <Card
                                    key={group}
                                    className={`mb-3 bg-transparent ${styles.cardHeader}`} // Minimal gap, subtle shadow
                                >

                                    {/* 1. SMALL HEADER: Group Name */}
                                    <Card.Header className={`d-flex justify-content-start align-items-center ${styles.cardHeader}`}>
                                        <h6 className="mb-0 text-light">
                                            <CategoryImage
                                                data={groupedIngredients}
                                                order={sortedGroups}
                                                current={group}
                                                // 💡 ADD THIS CLASS TO TARGET THE INNER IMAGE CONTAINER IF POSSIBLE
                                                className="bg-transparent"
                                            >
                                                <span className="ms-2">{group}</span>
                                            </CategoryImage>
                                        </h6>
                                    </Card.Header>

                                    {/* 2. CARD BODY: Ingredient Table */}
                                    <Card.Body className="p-0">
                                        <NewIngredientTable
                                            reload={() => reloadAllIngredients()}
                                            ingredients={ingredientsInGroup.sort(ingredientSortFunction)}
                                            handleCheckboxChange={handleCheckboxChange}
                                            handleDeleteItem={handleDeleteItem}
                                            filters={filters}
                                            enabledSuppliers={enabledSuppliers}
                                        />
                                    </Card.Body>

                                    {/* 3. CARD FOOTER: Total Sum */}
                                    {/* <Card.Footer className={`d-flex justify-content-end align-items-center ${styles.cardFooter}`}> */}
                                    {/* <h5 className="text-primary mb-0"> */}
                                    {/* NOTE: showTotalOfList already returns an <h4>, adjust if necessary */}
                                    {/* {showTotalOfList(ingredientsInGroup)} */}
                                    {/* </h5> */}
                                    {/* </Card.Footer> */}

                                </Card>
                            );
                        })}
                    </div>


                    {/* Bottom Actions and Debug Info */}
                    <Row className="mt-4 pb-5 w-100">
                        <Col xs={12} className="text-center">
                            <CopyToClipboard listIngreds={listIngreds} />
                        </Col>
                        <Col xs={12} className="text-center">
                            <Button
                                onClick={() => markListAsComplete()}
                                variant="success"
                                className="mx-auto col-6 col-md-4"
                            >
                                ✅ Mark as Complete
                            </Button>
                            <p className="text-muted small mt-2">List ID: {id}</p>
                        </Col>
                    </Row>

                </main>
            </Container>

        </div >
    );
}