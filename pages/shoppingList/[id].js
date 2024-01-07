
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
import { IngredientList } from '../../components/IngredientList'
import ImageList from '../../components/ImageList'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-modal';
import { set } from 'mongoose'
import AddShoppingItem from '../../components/AddShoppingItem'
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
    const [enabledSuppliers, setEnabledSuppliers] = useState(["WW", "Panetta", "IGA"])


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



    useEffect(() => {
        if (listIngreds.length > 0) {
            reloadAllIngredients()
        }
    }, [listIngreds])

    async function getGroceryStoreProducts(ingredient) {
        let data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        if (data.loadedSource) {
            //     // We extract again if the source was loaded... our response is returning some weird stuff... 
            data = await (await fetch(`/api/Ingredients/?name=${ingredient.name}&qType=${ingredient.quantity_type}&returnN=1&supplier=${enabledSuppliers.join(',')}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
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

    async function handleCheckboxChange(index) {
        const updatedIngredients = [...matchedListIngreds];
        updatedIngredients[index].bought = !updatedIngredients[index].bought;
        setMatchedListIngreds(updatedIngredients);
    };

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

    async function handleActiveSupplierChange(inputObject){
        await updateSupplierFromInputObject(inputObject)
        
    }



    return (
        <div>
            <Toolbar>
            </Toolbar>

            <div className={styles.container}>
                <Head>
                    <title>Recipes</title>
                    <meta name="description" content="Generated by create next app" />
                    <link rel="icon" href="/avo.ico" />
                </Head>
                <main className={styles.main}>
                    {isLoading ?
                        <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/loading.svg"}`} />
                        :
                        <></>}
                    <Container className={styles.centered}>
                        <Row>
                            <Col>
                                <ImageList images={["/WW.png", "/Panetta.png", "/IGA.png"]} onImageChange={(e) => handleActiveSupplierChange(e)}></ImageList>
                            </Col>
                            <Col>
                                {
                                    (createNewIngredOpen ?
                                        <div>
                                            <Button variant={"danger"} style={{ "float": "right" }} onClick={() => setCreateNewIngredOpen(false)}>Hide</Button>
                                            <AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem} reload={getRecipeDetails}></AddShoppingItem>
                                        </div>
                                        :
                                        <Button variant={"success"} style={{ "float": "right" }} onClick={() => setCreateNewIngredOpen(true)}>Add to List</Button>)
                                }
                            </Col>
                        </Row>



                        {
                            (createNewIngredOpen ? <AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem} reload={getIngredDetails}></AddShoppingItem> : <></>)
                        }

                        <h2>List</h2>





                        <Row>
                            <IngredientTable reload={() => reloadAllIngredients()} ingredients={matchedListIngreds.map((ingred) => { return ingred })} handleCheckboxChange={handleCheckboxChange}></IngredientTable>
                        </Row>

                        <Button onClick={() => console.log(matchedListIngreds)} >
                            see state
                        </Button>
                        <p>ID = {id}</p>
                    </Container>


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