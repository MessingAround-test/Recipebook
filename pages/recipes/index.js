import Head from 'next/head'
import Image from 'next/image'
import styles from '../../styles/Home.module.css'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { Toolbar } from '../Toolbar'
import { useEffect, useState } from 'react'
import Button from 'react-bootstrap/Button';
import Router from 'next/router'
import ImageCard from '../../components/ImageCard'
import FormControl from 'react-bootstrap/FormControl';


export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipes, setRecipes] = useState([])

    const [searchTerm, setSearchTerm] = useState()
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

            Router.push("/login")
        }

        getUserDetails();
        getRecipeDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array

    useEffect(() => {
        setFilteredRecipes(filterList(recipes, searchTerm))
    }, [recipes, searchTerm])


    const redirect = async function (page) {
        Router.push(page)
    };

    // Check all the keys values for the search term
    function filterList(list, searchTerm) {
        if (searchTerm) {
            return list.filter(item =>
                Object.values(item).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
        }
        return list
    };

    const [filteredRecipes, setFilteredRecipes] = useState([])


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
            localRecipes = localRecipes.filter(function (obj) {
                return obj._id !== id;
            });
            setRecipes(localRecipes)
        }
    }

    const toggleMassDelete = async function () {
        setAllowDelete(!allowDelete)
    }

    const cardHeight = '15rem'


    return (
        <div key={"index div"} className={styles.wrapper}>
            <Toolbar />
            <div className={styles.container}>
                <Head>
                    <title>Recipebook | Your Collection</title>
                    <meta name="description" content="View and manage your recipes" />
                    <link rel="icon" href="/avo.ico" />
                </Head>

                <main className={styles.main}>
                    <div className="flex-row justify-between align-center mb-8">
                        <h1 className="m-0">Your Recipes</h1>
                        <div className="flex-row gap-2">
                            <button className="btn-modern" onClick={() => redirect("/createRecipe")}>
                                Add recipe
                            </button>
                            {userData.role === "admin" && (
                                <button
                                    className={`btn-modern ${allowDelete ? 'btn-danger' : 'btn-outline'}`}
                                    onClick={() => toggleMassDelete()}
                                >
                                    {allowDelete ? "Disable Mass Delete" : "Allow Mass Delete"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-8">
                        <input
                            className="input-modern"
                            placeholder="Search recipes..."
                            aria-label="Search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Row xl={5} lg={4} md={3} sm={2} xs={1}>
                        {filteredRecipes.map((recipe) => (
                            <Col key={recipe._id} className="mb-4">
                                <ImageCard
                                    recipe={recipe}
                                    allowDelete={allowDelete}
                                    onDelete={deleteRecipe}
                                    onRedirect={redirect}
                                />
                            </Col>
                        ))}
                    </Row>
                </main>

                <footer className={styles.footer}>
                    &copy; {new Date().getFullYear()} Recipebook &bull; Premium Culinary Management
                </footer>
            </div>
        </div>
    )
}
