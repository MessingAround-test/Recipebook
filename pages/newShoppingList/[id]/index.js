
import Head from 'next/head'
import styles from '../../../styles/Home.module.css'

import Image from 'next/image'

import { Toolbar } from '../../Toolbar'
import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import { useRouter } from 'next/router'
import Container from 'react-bootstrap/Container'
import ImageList from '../../../components/ImageList'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-modal';
import { set } from 'mongoose'
import AddShoppingItem from '../../../components/AddShoppingItem'
import NewIngredientTable from '../../../components/NewIngredientTable'
import ToggleList from '../../../components/ToggleList'
import CategoryList from '../../../components/CategoryImage'


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
    const availableFilters = ["supplier", "category", "complete", "price_category", "quantity_type"]
    const [modifyColumnIndex, setModifyColumnIndex] = useState(0)

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
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
                    updatedListIngreds[i]
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

    function determinePriceCategory(price) {
        if (price === undefined) {
            return ""
        }

        if (price < 5) {
            return "Cheap"
        }
        if (price < 10) {
            return "Reasonable"
        }

        return "Expensive"

    }

    async function getGroceryStoreProducts(ingredient) {
        let data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&quantity=${ingredient.quantity}&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        if (data.loadedSource) {
            //     // We extract again if the source was loaded... our response is returning some weird stuff... 
            data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&quantity=${ingredient.quantity}&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        }

        let updatedIngredient = ingredient
        updatedIngredient.options = []
        if (data.success === true && data.res.length > 0) {
            // updatedIngredient = { ...ingredient, ...data.res[0] }
            updatedIngredient.options = data.res

            updatedIngredient.supplier = data.res.length > 0 ? data.res[0].source : ""
            updatedIngredient.price_category = determinePriceCategory(data.res[0].price)

        } else {
            updatedIngredient.supplier = ""
            updatedIngredient.price_category = ""
        }
        return updatedIngredient
    }


    async function getShoppingListItems() {
        let data = await (await fetch(`/api/ShoppingListItem/?shoppingListId=${id}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        setlistIngreds(data.res)
    }


    async function getRecipeDetails() {
        let data = await (await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
        setlist(data.res)
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
                // alert(response)
                // Handle success, e.g., show a success message or redirect
            } else {
                // console.log()
                let error = await response.json()
                console.log(error)
                alert(error.message)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            alert(error)
            // Handle network or other errors
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

                // e.resetForm()
                console.log(e)
                getRecipeDetails()
                // alert(response)
                // Handle success, e.g., show a success message or redirect
            } else {
                // console.log()
                let error = await response.json()
                console.log(error)
                alert(error.message)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            alert(error)
            // Handle network or other errors
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
                // console.log()
                let error = await response.json()
                console.log(error)
                alert(error.message)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            alert(error)
            // Handle network or other errors
        }
    }

    async function updateSupplierFromInputObject(inputObject) {
        const resultArray = Object.keys(inputObject).filter(key => inputObject[key]);

        const formattedResultArray = resultArray.map(key => key.replace(/^\/|\.png$/g, ''));

        console.log(formattedResultArray);
        setEnabledSuppliers(formattedResultArray)
    };

    useEffect(() => {
        // This code will run after the component renders and whenever enabledSuppliers changes
        reloadAllIngredients();
    }, [enabledSuppliers]);

    async function handleActiveSupplierChange(inputObject) {
        await updateSupplierFromInputObject(inputObject)

    }

    function generateKey(obj, keys) {
        return keys.map(key => `${key}=${obj[key]}`).join('|');
    }

    function processEmptyKeyObjects(emptyKeyObjects, groupedLists) {
        emptyKeyObjects.forEach(obj => {
            const emptyKey = "";
            const emptyGroupKey = generateKey(obj, [emptyKey]);

            if (!groupedLists[emptyGroupKey]) {
                groupedLists[emptyGroupKey] = [];
            }

            groupedLists[emptyGroupKey].push(obj);
        });
    }

    function processRegularObjects(regularObjects, keysToGroupBy, groupedLists) {
        regularObjects.forEach(obj => {
            const key = generateKey(obj, keysToGroupBy.filter(key => key !== "complete"));

            if (key === undefined) {
                return;
            }

            if (!groupedLists[key]) {
                groupedLists[key] = [];
            }

            groupedLists[key].push(obj);
        });
    }

    function processCompleteObjects(completeObjects, groupedLists) {
        completeObjects.forEach(obj => {
            const completeKey = "complete";
            const completeGroupKey = generateKey(obj, [completeKey]);

            if (!groupedLists[completeGroupKey]) {
                groupedLists[completeGroupKey] = [];
            }

            groupedLists[completeGroupKey].push(obj);
        });
    }

    function groupByKeys(data, keysToGroupBy) {
        const groupedLists = {
            "": [] // Initialize an empty key for empty values
        };

        // Separate the objects into three arrays based on key conditions
        const emptyKeyObjects = [];
        const completeObjects = [];
        const regularObjects = [];

        // Iterate through each JSON object
        data.forEach(obj => {
            // Check for an empty key and add to the corresponding array
            if (generateKey(obj, keysToGroupBy) === "") {
                emptyKeyObjects.push(obj);
            }
            // Check for "complete" key and add to the corresponding array
            else if (obj.complete === true) {
                completeObjects.push(obj);
            }
            // Otherwise, add to the regular array
            else {
                regularObjects.push(obj);
            }
        });

        // Process empty key objects first
        processEmptyKeyObjects(emptyKeyObjects, groupedLists);

        // Process regular objects next
        processRegularObjects(regularObjects, keysToGroupBy, groupedLists);

        // Process complete objects last
        processCompleteObjects(completeObjects, groupedLists);


        return groupedLists;
    }




    return (
        <div>
            <Toolbar>
            </Toolbar>

            <div className={styles.container}>
                <Head>
                    <title>Shopping List</title>
                    <meta name="description" content="Generated by create next app" />
                    <link rel="icon" href="/avo.ico" />
                </Head>
                <main className={styles.main}>

                    <div className={styles.centered}>


                        <Row className={styles.Row}>




                            <Col>

                                {
                                    (createNewIngredOpen ?
                                        <>
                                            <Button variant={"primary"} style={{}} onClick={() => setCreateNewIngredOpen(false)} className={"w-100 h-100"}>Hide</Button>

                                        </>
                                        :
                                        <>
                                            <Button variant={"primary"} style={{}} onClick={() => setCreateNewIngredOpen(true)} className={"w-100 h-100"}>Add</Button>
                                        </>
                                    )
                                }
                            </Col>
                            <Col>
                                <ToggleList inputList={availableFilters} onUpdateList={(currentState) => setFilters(currentState)} value={filters} text={"Group By"} />
                            </Col>

                        </Row>

                        {
                            filters.includes("supplier") ? <Container>
                                <ImageList images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]} onImageChange={(e) => handleActiveSupplierChange(e)}></ImageList>
                            </Container> : <></>
                        }


                        {
                            (createNewIngredOpen ? <><h2>Add New Ingredient</h2><AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem} reload={getRecipeDetails}></AddShoppingItem></> : <></>)
                        }



                        <br></br>
                        {/* <Button onClick={() => groupByKeys(matchedListIngreds, filters)}></Button> */}
                        {
                            Object.keys(groupByKeys(matchedListIngreds, filters)).map((group) => (
                                <>

                                    <Row>
                                        <h3>{group}</h3>
                                        {/* <CategoryList categoryString={group}></CategoryList> */}
                                        <NewIngredientTable reload={() => reloadAllIngredients()} ingredients={groupByKeys(matchedListIngreds, filters)[group].map((ingred) => { return ingred })} handleCheckboxChange={handleCheckboxChange} handleDeleteItem={handleDeleteItem} modifyColumnName={modifyColumnOptions[modifyColumnIndex % modifyColumnOptions.length]} filters={filters}></NewIngredientTable>
                                    </Row>
                                </>
                            ))
                        }

                        {/* <h1>List 1</h1> */}

                        {/* <Row>
                            <NewIngredientTable reload={() => reloadAllIngredients()} ingredients={matchedListIngreds.map((ingred) => { return ingred })} handleCheckboxChange={handleCheckboxChange} handleDeleteItem={handleDeleteItem} modifyColumnName={modifyColumnOptions[modifyColumnIndex % modifyColumnOptions.length]}></NewIngredientTable>
                        </Row> */}

                        <Button onClick={() => redirect(`${id}/stats`)} >
                            see stats
                        </Button>
                        <p>ID = {id}</p>

                    </div>


                </main>

                <footer className={styles.footer}>
                    <a
                        href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                    </a>
                </footer>
            </div>
        </div >
    )
}