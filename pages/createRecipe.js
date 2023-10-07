import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'
import { quantity_unit_conversions } from "../lib/conversion"

import { Toolbar } from './Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';

import Router from 'next/router'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { RiDeleteBin7Line } from 'react-icons/ri';



export default function Home() {
    const [ingreds, setIngreds] = useState([])
    const [instructions, setInstructions] = useState([])

    const [imageData, setImageData] = useState()
    const [recipeName, setRecipeName] = useState("")
    const [quanityTypes, setQuanityTypes] = useState({})

    const blobToBase64 = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const convertBlobToBase64 = async (blob) => {
        return await blobToBase64(blob);
    }

    async function generateImage(prompt) {
        if (recipeName !== undefined && recipeName !== "") {
            let promptImage = await (await fetch(`https://image.pollinations.ai/prompt/content:${prompt};style:realistic`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })).blob();

            let resData = await convertBlobToBase64(promptImage)
            setImageData(resData)
            return resData
        } else {
            alert("Please set a Recipe Name")
        }
    }

    const onSubmitRecipe = async function (e) {
        let localImage;

        if (imageData === undefined) {
            // if (input("Would you like to generate an image?")) {
            localImage = await generateImage(recipeName)
            // }

        } else {
            localImage = imageData
        }


        const data = await (await fetch("/api/Recipe?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "ingreds": ingreds,
                "instructions": instructions,
                "image": localImage,
                "name": recipeName
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

    const redirect = async function (page) {
        Router.push(page)
    };


    const onSubmitTasteImport = async function (e) {
        e.preventDefault();

        let tasteURL = e.target.tasteURL.value
        const data = await (await fetch(`/api/taste?url=${tasteURL}&EDGEtoken=${localStorage.getItem('Token')}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })).json()

        let tasteIngredsList = []
        data.data.ingredients.forEach(function (ingred) {
            if (ingred.converted !== undefined) {

                var IngredObj = {
                    "Name": ingred.converted.name,
                    "Amount": ingred.converted.quantity,
                    "AmountType": ingred.converted.quantity_unit,
                    "Note": "Imported from Taste"
                }
                tasteIngredsList.push(IngredObj)
            }
        })
        setIngreds(tasteIngredsList)


        let tasteInstructionList = []
        data.data.instructions.forEach(function (instruction) {

            var InstructObj = {
                "Text": instruction.instruction,
                "Note": instruction.stepNumber
            }

            tasteInstructionList.push(InstructObj)

        })
        setInstructions(tasteInstructionList)
    }


    const onSubmitIngred = async function (e) {
        e.preventDefault();

        var IngredObj = {
            "Name": e.target.ingredName.value,
            "Amount": e.target.ingredAmount.value,
            "AmountType": e.target.ingredAmountType.value,
            "Note": e.target.ingredNote.value
        }

        setIngreds([...ingreds, IngredObj])

        e.target.reset()
    }

    const onSubmitInstruc = async function (e) {
        e.preventDefault();


        var InstructObj = {
            "Text": e.target.instructText.value,
            "Note": e.target.instructNote.value
        }


        setInstructions([...instructions, InstructObj])
        console.log(instructions)

        e.target.reset()
    }

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }
        console.log(quantity_unit_conversions)
        setQuanityTypes(quantity_unit_conversions)
    }, []) // <-- empty dependency array


    const getBase64 = function (file, cb) {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            cb(reader.result)
        };
        reader.onerror = function (error) {
            console.log('Error: ', error);
        };
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








                <main className={styles.main}>

                    <Container>
                        <Row>
                            <Col>

                                {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                <Card.Body>
                                    {/* <Card.Title>Add ingredient</Card.Title> */}

                                    <Form>

                                        <Form.Group className="mb-3" id="formBasicEmail">

                                            <Form.Control name="recipeName" id="recipeName" type="text" placeholder="Enter Recipe Name" onChange={(e) => setRecipeName(e.target.value)} />

                                        </Form.Group>

                                    </Form>



                                </Card.Body>

                            </Col>
                        </Row>
                        <Form onSubmit={(e) => onSubmitTasteImport(e)}>
                            <Form.Group className="mb-3" id="formBasicEmail">
                                <Form.Control name="tasteURL" id="tasteURL" type="text" placeholder="Taste.com url" />
                            </Form.Group>
                            <Button variant="primary" type="submit">
                                Import
                            </Button>
                        </Form>

                        <h1>Ingredients</h1>
                        <Row>

                            <Col>

                                {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                <Card.Body>
                                    {/* <Card.Title>Add ingredient</Card.Title> */}

                                    <Form onSubmit={(e) => onSubmitIngred(e)}>
                                        <Form.Group className="mb-3" id="formBasicEmail">

                                            <Form.Control name="ingredName" id="ingredName" type="text" placeholder="Enter ingredient Name" required />

                                        </Form.Group>

                                        <Form.Group className="mb-3" id="formBasicEmail">

                                            <Form.Control name="ingredAmount" id="ingredAmount" type="text" placeholder="Enter Amount" required />

                                            <Form.Select aria-label="Default select example" name="ingredAmountType" id="ingredAmountType" required>
                                                {Object.keys(quantity_unit_conversions).map((item) => <option value={item}>{item}</option>)}
                                            </Form.Select>
                                        </Form.Group>



                                        <Form.Group className="mb-3" id="formBasicPassword">
                                            <Form.Control name="ingredNote" id="ingredNote" type="text" placeholder="(optional note)" />
                                        </Form.Group>
                                        <Button variant="primary" type="submit">
                                            Submit
                                        </Button>
                                    </Form>
                                </Card.Body>

                            </Col>
                            <Col>

                                <div style={{ right: "0px", float: "right", "background-color": "rgba(245, 245, 245, 0.0)" }}>
                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                    <Card.Body>

                                        <Container>

                                            {ingreds.map((ingred) => {
                                                return (
                                                    <div>
                                                        <a>-{ingred.Amount} / {ingred.AmountType} {ingred.Name}</a>
                                                        <Button onClick={() => setIngreds(ingreds.filter(function (ingredItem) { return ingredItem.Name !== ingred.Name }))}><RiDeleteBin7Line></RiDeleteBin7Line></Button>
                                                    </div>
                                                )
                                            })}
                                        </Container>

                                    </Card.Body>
                                </div>

                            </Col>
                        </Row>
                        <Row>
                            <h1>Instructions</h1>
                            <Col>

                                <Card style={{ maxWidth: '20em', color: "black" }}>
                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                    <Card.Body>
                                        {/* <Card.Title>Add ingredient</Card.Title> */}

                                        <Form onSubmit={(e) => onSubmitInstruc(e)}>

                                            <Form.Group className="mb-3" id="formBasicEmail">
                                                <Form.Control name="instructText" id="instructText" type="text" placeholder="Enter Instruction" required />
                                            </Form.Group>



                                            <Form.Group className="mb-3" id="formBasicPassword">
                                                <Form.Control name="instructNote" id="instructNote" type="text" placeholder="(optional note)" />
                                            </Form.Group>
                                            {/* <Form.Group className="mb-3" controlId="formBasicCheckbox">
                                <Form.Check type="checkbox" label="Check me out" />
                            </Form.Group> */}
                                            <Button variant="primary" type="submit">
                                                Submit
                                            </Button>

                                        </Form>



                                    </Card.Body>
                                </Card>



                            </Col>
                            <Col>
                                <Card style={{ maxWidth: '20em', color: "black", right: "0px", float: "right" }}>
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
                                                                <Col>
                                                                    <Button onClick={() => setInstructions(instructions.filter(function (ingredItem) { return ingredItem.Text !== instruction.Text }))}><RiDeleteBin7Line></RiDeleteBin7Line></Button>
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
                        <Row>
                            <Col>
                                <h1>Add Image</h1>
                                <input accept="image/*" type="file" onChange={(e) => { getBase64(e.target.files[0], (data) => setImageData(data)) }} />
                                <Button onClick={() => generateImage(recipeName)}>Generate Image</Button>
                            </Col>
                            <Col>
                                {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                <Card style={{ maxWidth: '20em', color: "black", right: "0px", float: "right" }}>
                                    <img src={imageData} style={{ maxWidth: "20em", maxHeight: "20em" }} />
                                </Card>

                            </Col>
                        </Row>
                        <Row>

                            <Button onClick={() => onSubmitRecipe()}> Save </Button>

                        </Row>

                    </Container>
                    {/* <Button onClick={()=>console.log(recipeName)}>recipe name</Button> */}
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
