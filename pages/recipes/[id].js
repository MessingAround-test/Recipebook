
import Head from 'next/head'
import Image from 'next/image'
import styles from '../../styles/Home.module.css'



import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
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



    async function getUserDetails() {
        var data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        var data = await (await fetch("/api/Recipe/" + String(await router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setRecipe(data.res)
        setIngreds(data.res.ingredients)
        setInstructions(data.res.instructions)
        setImageData(data.res.image)
        setRecipeName(data.res.name)
    }



    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

        // getUserDetails();
        getRecipeDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };


    if (recipe === undefined ) {
        return (
            <div>
                <Toolbar>
                </Toolbar>
                <div className={styles.container}>
                    <Head>
                        <title>Recipes</title>
                        <meta name="description" content="Generated by create next app" />
                        <link rel="icon" href="/favicon.ico" />
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
                        <link rel="icon" href="/favicon.ico" />
                    </Head>







                    <main className={styles.main}>
                        RECIPEID = {id}
                        <Container>
                            <h1>General</h1>
                            <Row style={{paddingBottom: "1vw", "alignItems": "center"}}>
                                <Col>
                                    <Card style={{ width: '40vw', color: "black" }}>
                                        {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                        <Card.Body>
                                            {/* <Card.Title>Add ingredient</Card.Title> */}

                                            <Form>

                                                <Form.Group className="mb-3" id="formBasicEmail">
                                                    <Form.Label>Name: {recipeName}</Form.Label>
                                                    
                                                </Form.Group>

                                            </Form>



                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                            <h1>Ingredients</h1>
                            <Row style={{paddingBottom: "1vw"}}>

                                
                                <Col>

                                    <Card style={{ width: '40vw', color: "black"}}>
                                        {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                        <Card.Body>
                                            <Card.Title>Ingred Summary</Card.Title>
                                            <Container>

                                                {ingreds.map((ingred) => {
                                                    return (
                                                        <div>
                                                            <Row>
                                                                <Col>
                                                                    <li>{ingred.Amount} {ingred.AmountType} {ingred.Name}</li>
                                                                </Col>
                                                                
                                                            </Row>
                                                        </div>
                                                    )
                                                })}
                                            </Container>

                                        </Card.Body>
                                    </Card>

                                </Col>
                            </Row>
                            <Row style={{paddingBottom: "1vw"}}>
                                <h1>Instructions</h1>
                                
                                <Col>
                                    <Card style={{ width: '40vw', color: "black"}}>
                                        {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                        <Card.Body>
                                            <Card.Title>Instructions Summary</Card.Title>
                                            <Container>
                                                <ol>
                                                    {instructions.map((instruction) => {
                                                        return (
                                                            <div>
                                                                <Row>
                                                                    <Col>
                                                                        <li>{instruction.Text} </li>
                                                                    </Col>
                                                                    
                                                                </Row>
                                                            </div>
                                                        )
                                                    })}
                                                </ol>
                                            </Container>

                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                            <Row style={{paddingBottom: "1vw"}}>
                                
                                <Col>
                                    {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                    <Card style={{ width: '40vw', color: "black" }}>
                                        <img src={imageData} style={{ maxWidth: "40vw", maxHeight: "40vw" }} />
                                    </Card>

                                </Col>
                            </Row>
                            

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
