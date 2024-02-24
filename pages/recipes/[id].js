
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
import NewIngredientTable from '../../components/NewIngredientTable'
import { groupByKeys } from '../../lib/grouping'
import { getGroceryStoreProducts } from '../../lib/commonAPIs'
import IngredientCard from '../../components/IngredientCard'


export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipe, setRecipe] = useState({})
    const router = useRouter()
    const { id } = router.query

    const [listIngreds, setlistIngreds] = useState([])
    const [matchedListIngreds, setMatchedListIngreds] = useState([])
    const [instructions, setInstructions] = useState([])
    const [imageData, setImageData] = useState()
    const [recipeName, setRecipeName] = useState("")
    const [ingredientData, setIngredientData] = useState([])
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")
    const [filters, setFilters] = useState([])

    const [loading, setLoading] = useState(false)

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

    // async function getIngredDetails(ingredients) {
    //     setLoading(true)
    //     const newItems = [...ingredients];
    //     console.log(newItems)
    //     for (let ingredients in newItems) {
    //         let data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].Name}&qType=${newItems[ingredients].AmountType}&quantity=${newItems[ingredients].Amount}&returnN=1&EDGEtoken=${localStorage.getItem('Token')}`)).json()
    //         console.log(data)
    //         if (data.loadedSource) {
    //             // We extract again if the source was loaded... our response is returning some weird stuff... 
    //             data = await (await fetch(`/api/Ingredients/?name=${newItems[ingredients].Name}&qType=${newItems[ingredients].AmountType}&quantity=${newItems[ingredients].Amount}&returnN=1&extractLocation=DB&EDGEtoken=${localStorage.getItem('Token')}`)).json()
    //         }
    //         if (data.success === true && data.res.length > 0) {
    //             newItems[ingredients] = { ...newItems[ingredients], ...data.res[0] }
    //         }
    //     }
    //     setLoading(false)
    //     setMatchedListIngreds(newItems)
    // }


    // Loads all ingreds
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
                if (updatedListIngreds[i].complete === true) {

                    updatedListIngreds[i].loading = false
                    continue
                }
                const updatedIngredient = await getGroceryStoreProducts(
                    updatedListIngreds[i],
                    1,
                    [],
                    localStorage.getItem('Token')
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
        setImageData(data.res.image)
        setlistIngreds(data.res.ingredients)

        setInstructions(data.res.instructions)
        setImageData(data.res.image)
        setRecipeName(data.res.name)
    }

    // TJOS ISNT WORKING AGAGAG
    const getAproxTotalRecipeCostUnit = () => {
        let total = 0
        for (let ingredient in matchedListIngreds) {
            let current = matchedListIngreds[ingredient].options[0]

            if (current !== undefined) {
                total = total + current.total_price
            }
        }
        return total.toFixed(2)

    }

    const getAproxTotalRecipeCost = () => {
        let total = 0
        for (let ingredient in matchedListIngreds) {
            let current = matchedListIngreds[ingredient].options[0]

            if (current !== undefined) {
                total = total + current.total_price / current.match_efficiency * 100
            }
        }
        return total.toFixed(2)

    }

    const compressImage = async (base64String) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
      
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxResolution = 800; // Set your desired maximum resolution
      
            let width = img.width;
            let height = img.height;
      
            // Resize the image if necessary
            if (width > maxResolution || height > maxResolution) {
              const aspectRatio = width / height;
      
              if (width > height) {
                width = maxResolution;
                height = width / aspectRatio;
              } else {
                height = maxResolution;
                width = height * aspectRatio;
              }
            }
      
            canvas.width = width;
            canvas.height = height;
      
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
      
            const compressedBase64String = canvas.toDataURL('image/jpeg');
            resolve(compressedBase64String);
          };
      
          img.onerror = (error) => {
            reject(error);
          };
      
          img.src = base64String;
        });
      };
      

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
    
        if (file) {
          try {
            // Convert the selected file to a Base64-encoded string
            const reader = new FileReader();
            reader.readAsDataURL(file);
    
            reader.onload = async () => {
                
              const base64String = reader.result;
              if (file.size > 1024 * 1024) {
                // Compress the image resolution
                base64String = await compressImage(reader.result);
              }

    
              // Your PUT API logic to update the associated image
              try {
                const response = await fetch(`/api/Recipe/${encodeURIComponent(String(await router.query.id))}?EDGEtoken=${localStorage.getItem('Token')}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    image: base64String,
                  }),
                });
    
                // Check the response status and handle accordingly
                if (response.ok) {
                    window.location.reload();
                  // Handle success, e.g., update state or trigger a re-fetch
                } else {
                  console.error('Failed to update the image');
                }
              } catch (error) {
                console.error('Error updating image:', error);
              }
            };
    
            reader.onerror = (error) => {
              console.error('Error reading the file:', error);
            };
          } catch (error) {
            console.error('Error converting file to Base64:', error);
          }
        }
      };

    useEffect(() => {
        console.log(listIngreds)
        if (listIngreds.length > 0) {

            reloadAllIngredients()
        }
    }, [listIngreds])


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

    const handleClick = () => {
        document.querySelector('input[type="file"]').click();
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
                        {/* <Button>Hide matchedListIngreds</Button> */}

                        <Row>
                            <Col className={styles.centered}>
                                <h2>
                                    <input
                                        type="checkbox"
                                        checked={filters.includes("supplier")}
                                        value={filters}
                                        onChange={() => filters.includes("supplier") ? setFilters([]) : setFilters(["supplier"])}
                                        style={{ width: '2rem', height: '2rem' }}
                                    ></input>
                                    Show Grocery Products
                                </h2>


                            </Col>
                        </Row>

                        <Container>
                            <Row xs={1} md={2} lg={2} xl={3} xxl={4} >
                                {/* <NewIngredientTable reload={() => reloadAllIngredients()} ingredients={groupByKeys(matchedListmatchedListIngreds, filters)[group].map((ingred) => { return ingred })} modifyColumnName={modifyColumnOptions[modifyColumnIndex % modifyColumnOptions.length]} filters={filters} ></NewIngredientTable> */}


                                {loading ? <>loading...<object type="image/svg+xml" data="/loading.svg">svg-animation</object></> : <></>}
                                {matchedListIngreds.map((ingred) => (

                                    <IngredientCard ingredient={ingred} filters={filters} openModal={openModal}></IngredientCard>


                                ))}







                            </Row>
                            <Row>
                                <Col className={styles.col}>
                                    <h2>Total Cost ${getAproxTotalRecipeCost()}</h2>
                                    <h2>You will use: ${getAproxTotalRecipeCostUnit()}</h2>
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

                            <IngredientNutrientGraph ingredients={matchedListIngreds}></IngredientNutrientGraph>
                            <Row>

                                <Col className={styles.Col}>
                                    {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                    <Card >

                                        <input
                                            type="file"
                                            style={{ display: 'none' }}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                        />                                            
                                        <img src={imageData} style={{ width: "auto", height: "auto" }} onClick={handleClick} />
                                        

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
                            <Button onClick={() => reloadAllIngredients()}>Get Grocery Store Data</Button>
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
