import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'



import { Toolbar } from './Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import Card from 'react-bootstrap/Card'



export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipes, setRecipes] = useState([])
    const [allowDelete, setAllowDelete] = useState(false)

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        let data = await (await fetch("/api/Recipe?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setRecipes(data.res)
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

        let data = await (await fetch("/api/Recipe/" + String(id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
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
            localRecipes = localRecipes.filter(function( obj ) {
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
                <div style={{ padding: "0.5vh" }}>
                <Button variant="danger" onClick={() => toggleMassDelete()} style={{ "float": "right" }}>Allow Mass Delete</Button>
                </div>
                <main className={styles.main}>
                    <div>
                
                </div>
                    <div className={styles.cardGroup}>
                        <div style={{ padding: "0.5vh" }}>
                            <Card style={{ maxWidth: '15rem', minWidth: "15rem", maxHeight: "15rem", minHeight: "15rem", color: "black", "borderStyle": "solid", "borderColor": "green", "borderWidth": "0.5rem", "alignItems": "center","justifyContent": "center" }} onClick={() => (redirect("/createRecipe"))}>
                                <Card.Body style={{ overflow: "hidden" }}>
                                    <Card.Title>{String("New Recipe")}</Card.Title>
                                    <Card.Img style={{maxHeight:"10rem", maxWidth:"10rem"}} variant="top" src={"add.jpg"} />
                                </Card.Body>

                            </Card>
                        </div>
                        {recipes.map((recipe) => {
                            return (
                                <div style={{ padding: "0.5vh" }}>
                                    <Card style={{ maxWidth: '15rem', minWidth: "15rem", maxHeight: "15rem", minHeight: "15rem", color: "black", "alignItems": "center","justifyContent": "center" }} >

                                        {(allowDelete) ? (<>
                                            <Button variant="danger" onClick={() => deleteRecipe(recipe._id)} style={{ "float": "right" }}>x </Button>
                                        </>) : (<></>)}
                                        <Card.Body style={{ overflow: "hidden" }} onClick={() => (redirect("/recipes/" + recipe._id))}>


                                            <Card.Title>{String(recipe.name)}</Card.Title>
                                            <Card.Img variant="top" src={recipe.image} />
                                        </Card.Body>

                                    </Card>
                                </div>
                            )

                        })}
                    </div>
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
