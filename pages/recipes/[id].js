
import Head from 'next/head'
import styles from '../../styles/Home.module.css'



import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import { useRouter } from 'next/router'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

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



    async function getUserDetails() {
        var data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getIngredDetails(ingredients) {
        const newItems = [...ingredients];
        for (var ingredients in newItems) {
            var data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].Name}&qType=${newItems[ingredients].AmountType}&returnN=1&EDGEtoken=${localStorage.getItem('Token')}`)).json()
            console.log(data)
            if (data.success === true && data.res.length > 0) {
                newItems[ingredients].price = data.res[0].price;
                newItems[ingredients].price_measure = data.res[0].quantity_type;
                newItems[ingredients].supplierName = data.res[0].name;
                newItems[ingredients].totalCost = data.res[0].totalCost;
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
        var data = await (await fetch("/api/Recipe/" + String(await router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
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
        var total = 0
        for (let ingredient in ingreds) {
            let current = ingreds[ingredient]
            if (current.totalCost !== undefined) {
                total = total + parseFloat(current.totalCost)
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
                        
                        <div>
                            <Container className={styles.centered}>
                                <h1 className={styles.centered}>{recipeName}</h1>
                                <h2>Ingredients</h2>
                                <Row>
                                    <Col>
                                        <div style={{ color: "white" }}>
                                            <Container>
                                                {ingreds.map((ingred) => {
                                                    return (
                                                        <div style={{ padding: "1rem" }} >
                                                            <Row>
                                                                <Col className={[styles.curvedEdge]} style={{ background: "grey" }}>
                                                                    {ingred.Name} -  {ingred.Amount} / {ingred.AmountType}
                                                                </Col>

                                                                <Col>
                                                                    ${ingred.price} / {ingred.price_measure}
                                                                </Col>
                                                                <Col>{ingred.supplierName}</Col>
                                                                <Col>
                                                                    {<>${(ingred.totalCost)}</>}
                                                                </Col>
                                                                <Col>
                                                                {<>${(ingred.Amount * ingred.price)}</>}

                                                                </Col>
                                                            </Row>
                                                        </div>
                                                    )
                                                })}
                                            </Container>
                                        </div>

                                    </Col>
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

                                    <Col >
                                        {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                        <Card style={{ maxWidth: '80vw', color: "black", "backgroundColor": "rgba(76, 175, 80, 0.0)" }}>
                                            <img src={imageData} style={{ display: "block", maxWidth: "20vw", maxHeight: "20vw", width: "auto", height: "auto" }} />
                                        </Card>

                                    </Col>
                                </Row>
                                <Button onClick={() => getIngredDetails(ingreds)}>Get Grocery Store Data</Button>
                                <br></br>
                                        <Button variant="danger" onClick={() => deleteRecipe()}>
                                            Delete Recipe
                                        </Button>
                                      
                                
                                <p>RECIPEID = {id}</p>
                            </Container>
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
            </div>
        )
    }
}
