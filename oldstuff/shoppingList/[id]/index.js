
import Head from 'next/head'
import styles from '../../styles/Home.module.css'

import Image from 'next/image'

import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import { useRouter } from 'next/router'
import Container from 'react-bootstrap/Container'
import ImageList from '../../components/ImageList'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-modal';
import { set } from 'mongoose'
import AddShoppingItem from '../../components/AddShoppingItem'
import NewIngredientTable from '../../components/NewIngredientTable'
import IngredientTable from '../../components/IngredientTable'


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
    const [modifyColumnIndex, setModifyColumnIndex] = useState(0)

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



    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

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
                                <ImageList images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]} onImageChange={(e) => handleActiveSupplierChange(e)}></ImageList>
                            </Col>


                            <Col Col xs={12}>

                                {
                                    (createNewIngredOpen ?
                                        <>
                                            <Button variant={"primary"} style={{}} onClick={() => setCreateNewIngredOpen(false)}>Hide</Button>

                                        </>
                                        :
                                        <>
                                            <Button variant={"primary"} style={{}} onClick={() => setCreateNewIngredOpen(true)} className={"w-100 h-100"}>Add</Button>
                                        </>
                                    )
                                }
                            </Col>
                            


                        </Row>



                        {
                            (createNewIngredOpen ?<><h2>Add New Ingredient</h2><AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem} reload={getRecipeDetails}></AddShoppingItem></>: <></>)
                        }



                        <br></br>



                        <Row>
                            <IngredientTable reload={() => reloadAllIngredients()} ingredients={matchedListIngreds.map((ingred) => { return ingred })} handleCheckboxChange={handleCheckboxChange} handleDeleteItem={handleDeleteItem} modifyColumnName={modifyColumnOptions[modifyColumnIndex % modifyColumnOptions.length]}></IngredientTable>
                        </Row>

                        {/* <Button onClick={() => console.log(matchedListIngreds)} >
                            see state
                        </Button> */}

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