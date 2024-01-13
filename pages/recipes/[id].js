
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
                        <Container className={styles.centered}>
                            <h1 className={styles.centered}>{recipeName}</h1>
                            <h2>Ingredients</h2>
                            <Row>
                                {ingreds.map((ingred) => {
                                    return (
                                        // <div style={{ padding: "1rem",  }} >
                                            <Row>
                                                <Col className={styles.col}>
                                                    {ingred.Amount} {ingred.AmountType}
                                                </Col>
                                                <Col className={styles.col}> {ingred.Name}</Col>
                                                <Col className={styles.col}>
                                                    
                                                    <a onClick={((ingred.source)) ? console.log("nothing") : ()=>alert("hi there")}>
                                                    <img style={{ "maxWidth": "32px", "borderRadius": "5px" }} src={`/${((ingred.source)) ? ingred.source : "cross"}.png`} />
                                                    </a>
                                                    
                                                </Col>
                                                <Col className={[styles.curvedEdge, styles.centered]} style={{ background: "grey" }}>
                                                    <div onClick={() => openModal(ingred.Name)} style={{"overflow":"hidden"}}>
                                                        {ingred.name}
                                                    </div>
                                                </Col>
                                                <Col className={styles.col}>
                                                    <Button variant={"warning"} onClick={(e)=>markAsIncorrect(ingred._id, ingred.name)}>x</Button>
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
                                        // </div>
                                    )
                                })}

                            </Row>
                            <h2>Total {getAproxTotalRecipeCost()}</h2>
                            <h2>Instructions</h2>
                            <Row >
                                <Col>

                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}

                                    <ol>
                                        {instructions.map((instruction, index) => {
                                            return (
                                                <div>
                                                    <Row>
                                                        <Col>
                                                            <p> Step:  {index + 1}: {instruction.Text} </p>
                                                        </Col>

                                                    </Row>
                                                </div>
                                            )
                                        })}
                                    </ol>

                                </Col>
                            </Row>
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
