import Head from 'next/head'
import Image from 'next/image'
import styles from '../../styles/Home.module.css'



import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'
import GenericForm from '../../components/GenericForm'
import { Col, Row } from 'react-bootstrap'
import ImageCard from '../../components/ImageCard'



export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipes, setRecipes] = useState([])
    const [allowDelete, setAllowDelete] = useState(false)




    const cardStyles = {
        color: "black",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
        boxSizing: "border-box",
    };

    const divStyles = {
        padding: "0.5vh",
        width: 'auto',
    };

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        console.log("SHOPPING LIST INIT")
        let data = await (await fetch("/api/ShoppingList?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setRecipes(data.res)
    }

    async function handleSubmit(e) {

        console.log(e)
        console.log(e.value)

    }



    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

        getUserDetails();
        getRecipeDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };


    const deleteRecipe = async function (id) {

        let data = await (await fetch("/api/ShoppingList/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
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
            const localRecipes = recipes;
            // Remove the recipe with the same ID which was just deleted from local state
            localRecipes = localRecipes.filter(function (obj) {
                return obj._id !== id;
            });
            setRecipes(localRecipes)
        }
    }

    const toggleMassDelete = async function () {
        setAllowDelete(!allowDelete)
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

                <h1 className={styles.centered_horizontal} style={{ "color": "white" }}>Shopping Lists</h1>

                <Row>
                    <Col className={styles.col}>
                        <Button variant="success" onClick={() => (redirect("/shoppingList/create/"))} style={{}}>Create New List</Button>
                    </Col>
                    {userData.role === "admin" ?
                        <Col>
                            <div style={{ padding: "0.5vh" }}>
                                <Button variant="danger" onClick={() => toggleMassDelete()} >Allow Mass Delete</Button>
                            </div>
                        </Col> : <></>

                    }

                </Row>
                <main className={styles.main}>

                    <Row xl={5} lg={4} md={3} sm={2} xs={1}>
                        {recipes.map((recipe) => {
                            return (
                                <>
                                    <Col>

                                        <ImageCard recipe={recipe}
                                            allowDelete={allowDelete}
                                            onDelete={deleteRecipe}
                                            onRedirect={redirect}
                                            cardHeight={'5rem'}
                                        ></ImageCard>
                                        {recipe.complete ? <h1>Complete</h1> : <>Incomplete</>}


                                    </Col>
                                </>
                            )

                        })}

                    </Row>
                    {/* <Button onClick={() => console.log(recipes)}> show Recipes</Button> */}
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
