
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
import  ImageList  from '../../components/ImageList'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-modal';
import { set } from 'mongoose'
import AddShoppingItem from '../../components/AddShoppingItem'


export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipe, setRecipe] = useState({})
    const router = useRouter()
    const { id } = router.query

    const [ingreds, setIngreds] = useState([])
    const [instructions, setInstructions] = useState([])
    const [imageData, setImageData] = useState()
    const [recipeName, setRecipeName] = useState("")
    const [ingredientData, setIngredientData] = useState([])
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")
    const [createNewIngredOpen, setCreateNewIngredOpen] = useState(false)
    const [enabledSuppliers, setEnabledSuppliers] = useState([])


    const handleSubmitCreateNewItem = async (e) => {
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
                alert("WORKED")
                e.resetForm()
                console.log(e)
                getRecipeDetails()
                // alert(response)
                // Handle success, e.g., show a success message or redirect
            } else {
                alert(response.data)
                // Handle errors, e.g., show an error message
            }
        } catch (error) {
            alert(error)
            // Handle network or other errors
        }
    };


    async function openModal(ingredName) {
        setIsOpen(true);
        setSelectedIngred(ingredName)
    }



    async function closeModal() {
        setIsOpen(false);
    }

    async function getUserDetails() {
        var data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getIngredDetails(ingredients) {
        const newItems = [...ingredients];
        console.log(newItems)
        for (var ingredients in newItems) {
            let data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].name}&qType=${newItems[ingredients].quantity_unit}&returnN=1&EDGEtoken=${localStorage.getItem('Token')}`)).json()
            console.log(data)
            if (data.loadedSource) {
                // We extract again if the source was loaded... our response is returning some weird stuff... 
                data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].name}&qType=${newItems[ingredients].quantity_unit}&returnN=1&extractLocation=DB&EDGEtoken=${localStorage.getItem('Token')}`)).json()
            }
            if (data.success === true && data.res.length > 0) {
                newItems[ingredients] = { ...newItems[ingredients], ...data.res[0] }
            }
        }
        setIngreds(newItems)
    }

    const deleteRecipe = async function (e) {

        var data = await (await fetch("/api/Recipe/" + String(router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            })
        })).json()
        console.log(data)
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }

        } else {
            redirect("/recipes")
        }
    }

    async function getRecipeDetails() {
        var data = await (await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
        setRecipe(data.res)

        var data = await (await fetch(`/api/ShoppingListItem/?shoppingListId=${id}&EDGEtoken=${localStorage.getItem('Token')}`)).json()
        console.log(data)
        
        getIngredDetails(data.res)
        // setIngreds(data.res.ingredients)
        // setInstructions(data.res.instructions)
        // setImageData(data.res.image)
        // setRecipeName(data.res.name)

        // getIngredDetails(data.res.ingredients)
    }

    // TJOS ISNT WORKING AGAGAG
    const getAproxTotalRecipeCost = () => {
        var total = 0
        for (let ingredient in ingreds) {
            let current = ingreds[ingredient]
            if (current.unit_price !== undefined) {
                total = total + current.unit_price * (current.Amount)
            }
        }
        return (<>{total.toFixed(2)}</>)

    }



    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

        // getUserDetails();
        getRecipeDetails()

        // console.log(await data)


        // console.log(await data)
    }, [router.isReady, id]) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };

    const markAsIncorrect = async function (ingredientId, ingredName) {
        var data = await (await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            })
        })).json()
        console.log(data)
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }

        } else {
            // Ran successfully
            getRecipeDetails()
        }
    }

    const customStyles = {
        content: {
            "backgroundColor": "grey"
        }
    }


    if (recipe === undefined) {
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
                        ID = {id}
                        Loading

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
            </div>
        )
    } else {
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
                        <Container className={styles.centered}>
                            <Row>
                            <Col>
                            <ImageList images={["/WW.png", "/Panetta.png", "/IGA.png"]} onImageChange={(e)=>console.log(e)}></ImageList>
                            </Col>
                            <Col>
                            {
                                (createNewIngredOpen?<Button variant={"danger"} style={{ "float": "right" }} onClick={()=>setCreateNewIngredOpen(false)}>Hide</Button>:<Button variant={"success"} style={{ "float": "right" }} onClick={()=>setCreateNewIngredOpen(true)}>Add to List</Button>)
                            }
                            </Col>
                            </Row>
                            
                            
                            
                            {
                                (createNewIngredOpen?<AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem}></AddShoppingItem>:<></>)
                            }
                            
                            <h2>List</h2>
                            
                            {/* <Button onClick={()=>console.log(ingreds)}>Show Ingreds List</Button> */}
                            
                            <Row>
                                {ingreds.map((ingred) => {
                                    return (
                                        <div style={{ padding: "1rem",  }} >
                                            <Row>
                                                <Col className={styles.col}>
                                                    {ingred.Amount} {ingred.AmountType}
                                                </Col>
                                                <Col className={styles.col}> {ingred.search_term}</Col>
                                                <Col className={styles.col}>
                                                    
                                                    <a onClick={((ingred.source)) ? console.log("nothing") : ()=>alert("hi there")}>
                                                    <img style={{ "maxWidth": "32px", "borderRadius": "5px" }} src={`/${((ingred.source)) ? ingred.source : "cross"}.png`} />
                                                    </a>
                                                    
                                                </Col>
                                                <Col className={[styles.curvedEdge, styles.centered]} style={{ background: "grey" }}>
                                                    <div onClick={() => openModal(ingred.name)}>
                                                        {ingred.name}
                                                    </div>
                                                </Col>
                                                <Col className={styles.col}>
                                                    <Button variant={"warning"} onClick={(e)=>markAsIncorrect(ingred._id, ingred.name)}>Not right?</Button>
                                                </Col>
                                                <Col className={styles.col}>
                                                    ${ingred.price} / {ingred.quantity} {ingred.quantity_unit} = ${(ingred.unit_price * ingred.Amount).toFixed(2)}
                                                </Col>



                                                {/* <Image src={ingred.source}></Image> */}
                                                {/* <div className="w-full h-64 rounded-b-lg bg-cover bg-center" style={{ backgroundImage: `url(${ingred.source})` }}>hi there</div> */}
                                                {/* <Col>
                                                                    {<>${(ingred.unit_price)}</>}
                                                                </Col> */}
                                                {/* <Col>
                                                                    {<>${(ingred.unit_price * ingred.Amount).toFixed(2)}</>}

                                                                </Col> */}
                                            </Row>
                                        </div>
                                    )
                                })}

                            </Row>
                            <h2>Total {getAproxTotalRecipeCost()}</h2>
                            
                            
                            <Row style={{ paddingBottom: "1vw", display: "flex" }}>

                                <Col className={styles.centered}>
                                    {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                    <Card style={{ maxWidth: '30vw', color: "black", "backgroundColor": "rgba(76, 175, 80, 0.0)" }}>
                                        <img src={imageData} style={{ width: "auto", height: "auto"}} />
                                    </Card>

                                </Col>
                            </Row>
                            <Modal
                                isOpen={modalIsOpen}
                                onRequestClose={closeModal}
                                style={customStyles}
                                contentLabel="Example Modal"
                                className={styles.modal}
                            >
                                <a>
                                <button style={{ float: "right", "borderRadius": "5px" }} onClick={closeModal}><img style={{ "maxWidth": "32px", "maxHeight": "32px" }} src={"/cross.png"}></img></button>
                                <h2>Ingredient Research</h2>
                                <IngredientList search_term={selectedIngred}></IngredientList>
                                </a>
                            </Modal>
                            
                            <br></br>
                            {/* onClick={() => deleteRecipe()} */}
                            {/* <Button variant="danger" >
                                Mark as Finished
                            </Button> */}


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
            </div>
        )
    }
}
