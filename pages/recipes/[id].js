
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
import { IngredientSearchList } from '../../components/IngredientSearchList'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Modal from 'react-modal';
import IngredientNutrientGraph from '../../components/IngredientNutrientGraph'
import { set } from 'mongoose'


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

    const [loading, setLoading] = useState(false)
    const [selectedIngredient, setSelectedIngredient] = useState('');
    const filteredIngredients = selectedIngredient ? ingreds.filter(ingredient => ingredient.Name === selectedIngredient) : ingreds;
    const handleDropdownChange = (event) => {
        setSelectedIngredient(event.target.value);
    };

    async function openModal(ingredName) {
        setIsOpen(true);
        setSelectedIngred(ingredName)
    }



    async function closeModal() {
        setIsOpen(false);
    }

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getIngredDetails(ingredients) {
        setLoading(true)
        const newItems = [...ingredients];
        console.log(newItems)
        for (let ingredients in newItems) {
            let data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].Name}&qType=${newItems[ingredients].AmountType}&returnN=1&EDGEtoken=${localStorage.getItem('Token')}`)).json()
            console.log(data)
            if (data.loadedSource) {
                // We extract again if the source was loaded... our response is returning some weird stuff... 
                data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].Name}&qType=${newItems[ingredients].AmountType}&returnN=1&extractLocation=DB&EDGEtoken=${localStorage.getItem('Token')}`)).json()
            }
            if (data.success === true && data.res.length > 0) {
                newItems[ingredients] = { ...newItems[ingredients], ...data.res[0] }
            }
        }
        setLoading(false)
        setIngreds(newItems)
    }

    const deleteRecipe = async function (e) {

        let data = await (await fetch("/api/Recipe/" + String(router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
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
        let data = await (await fetch("/api/Recipe/" + String(await router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setRecipe(data.res)
        // setIngreds(data.res.ingredients)
        setInstructions(data.res.instructions)
        setImageData(data.res.image)
        setRecipeName(data.res.name)

        getIngredDetails(data.res.ingredients)
    }

    // TJOS ISNT WORKING AGAGAG
    const getAproxTotalRecipeCost = () => {
        let total = 0
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
    }, [router.isReady]) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };

    const markAsIncorrect = async function (ingredientId, ingredName) {
        let data = await (await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + localStorage.getItem('Token'), {
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
                        RECIPEID = {id}
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
                        <h1 className={styles.header} style={{ "backgroundColor": "white", "color": "black" }}>{recipeName}</h1>
                        <h2 className={styles.header}>Ingredients</h2>
                        <Button>Hide Ingreds</Button>
                        
                        <Container>
                            <Row xs={1} md={2} lg={2} xl={3} xxl={4} >


                                {loading ? <>loading...<object type="image/svg+xml" data="/loading.svg">svg-animation</object></> : <></>}
                                {ingreds.map((ingred) => (
                                    <Col
                                        key={ingred._id}
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: "8px",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                            margin: "0.2rem 0",  // Adjusted margin for better spacing
                                            padding: "1rem",
                                            backgroundColor: "#171f34",
                                        }}
                                    >

                                        <Row>
                                            <Col xs={12} className={styles.centered} style={{ marginBottom: "0.5rem" }}>
                                                <div onClick={() => openModal(ingred.Name)} style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                                                    {ingred.Name}
                                                </div>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col xs={12} className={styles.centered} style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
                                                {`${ingred.Amount} ${ingred.AmountType} - $${(ingred.unit_price * ingred.Amount).toFixed(2)}`}
                                            </Col>
                                        </Row>
                                        
                                        <Row>
                                            <Col xs={12} className={styles.centered} style={{ marginBottom: "0.5rem" }}>
                                                <div style={{ fontSize: "1rem" }}>
                                                    {ingred.name}
                                                </div>
                                            </Col>
                                            <Col xs={12} className={styles.centered} style={{ marginBottom: "1rem" }}>
                                                <img
                                                    style={{
                                                        maxWidth: "10%",
                                                        height: "auto",
                                                        borderRadius: "5px",
                                                    }}
                                                    src={`/${ingred.source ? ingred.source : "cross"}.png`}
                                                    alt={ingred.Name}
                                                />
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col xs={12} className={styles.centered}>
                                                <Button variant="warning" onClick={(e) => markAsIncorrect(ingred._id, ingred.name)}>
                                                    Wrong Product
                                                </Button>
                                            </Col>
                                        </Row>
                                    </Col>
                                ))}







                            </Row>
                            <Row>
                                <Col className={styles.col}>
                                    <h2>Total {getAproxTotalRecipeCost()}</h2>
                                </Col>
                            </Row>
                            {/* If no instructions then dont show */}
                            {
                                instructions.length > 0 ?
                                    <div>
                                        <h2 className={styles.header}>Instructions</h2>
                                        <Row xs={1} md={2} lg={3} xl={4} xxl={5}>

                                            {instructions.map((instruction, index) => {
                                                return (
                                                    <div>

                                                        <Col style={{ "font-size": "1rem" }}>
                                                            <div className={styles.header}> Step {index + 1} </div>
                                                            <p> {instruction.Text}</p>
                                                        </Col>


                                                    </div>
                                                )
                                            })}



                                        </Row>
                                    </div>
                                    : <></>
                            }

                            <h2 className={styles.header}>Nutrients</h2>
                            <select
                                id="ingredientDropdown"
                                value={selectedIngredient}
                                onChange={handleDropdownChange}
                            >
                                <option value="">Select an ingredient to filter graph</option>

                                {ingreds.map((ingredient, index) => (
                                    <option key={index} value={ingredient.Name}>
                                        {ingredient.Name}
                                    </option>
                                ))}
                            </select>

                            <IngredientNutrientGraph ingredients={filteredIngredients}></IngredientNutrientGraph>
                            <Row>

                                <Col className={styles.Col}>
                                    {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                    <Card >
                                        <img src={imageData} style={{ width: "auto", height: "auto" }} />
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
                                    <IngredientSearchList search_term={selectedIngred}></IngredientSearchList>
                                </a>
                            </Modal>
                            <Button onClick={() => getIngredDetails(ingreds)}>Get Grocery Store Data</Button>
                            <br></br>
                            <Button variant="danger" onClick={() => deleteRecipe()}>
                                Delete Recipe
                            </Button>


                            <p>RECIPEID = {id}</p>
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
