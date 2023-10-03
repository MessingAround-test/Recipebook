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

    async function getUserDetails() {
        var data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function getRecipeDetails() {
        var data = await (await fetch("/api/Recipe?EDGEtoken=" + localStorage.getItem('Token'))).json()
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


    const redirect = async function(page) {
        Router.push(page)
    };




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
                <div className={styles.cardGroup}>
                <div style={{padding:"0.5vh"}}>
                            <Card style={{ maxWidth: '15rem', minWidth:"15rem", maxHeight: "15rem", minHeight: "15rem", color: "black"}} onClick={()=>(redirect("/createRecipe"))}>
                                <Card.Body style={{overflow: "hidden"}}>
                                    <Card.Title>{String("New Recipe")}</Card.Title>
                                    <Card.Img style={{}} variant="top" src={"add-128.png"} />
                                </Card.Body>

                            </Card>
                            </div>
                    {recipes.map((recipe) => {
                        return (
                            <div style={{padding:"0.5vh"}}>
                            <Card style={{ maxWidth: '15rem', minWidth:"15rem", maxHeight: "15rem", minHeight: "15rem", color: "black"}} onClick={()=>(redirect("/recipes/" + recipe._id))}>
                                <Card.Body style={{overflow: "hidden"}}>
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
