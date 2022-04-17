import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

import Card from 'react-bootstrap/Card'
import Button from 'react-bootstrap/Button'


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

    const onSubmitRecipe = async function (e) {

        console.log(await ingreds)
        console.log(await instructions)
        console.log(await imageData)

        var data = await (await fetch("/api/Recipe?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "ingreds": ingreds,
                "instructions": instructions,
                "image": imageData,
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

        }
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

    }, []) // <-- empty dependency array


    const getBase64 = function(file, cb) {
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
                    <link rel="icon" href="/favicon.ico" />
                </Head>








                <main className={styles.main}>

                    <Container>
                    <h1>General</h1>
                        <Row>
                            <Col>
                            <Card style={{ maxWidth: '20em', color: "black" }}>
                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                    <Card.Body>
                                        {/* <Card.Title>Add ingredient</Card.Title> */}

                                        <Form>

                                            <Form.Group className="mb-3" id="formBasicEmail">
                                                <Form.Label>Recipe Name</Form.Label>
                                                <Form.Control name="recipeName" id="recipeName" type="text" placeholder="Enter Recipe Name" onChange={(e)=>setRecipeName(e.target.value)}/>
                                            </Form.Group>

                                        </Form>



                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                        <h1>Ingredients</h1>
                        <Row>

                            <Col>

                                <Card style={{ maxWidth: '20em', color: "black" }}>
                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                    <Card.Body>
                                        {/* <Card.Title>Add ingredient</Card.Title> */}

                                        <Form onSubmit={(e) => onSubmitIngred(e)}>
                                            <Form.Group className="mb-3" id="formBasicEmail">
                                                <Form.Label>Name</Form.Label>
                                                <Form.Control name="ingredName" id="ingredName" type="text" placeholder="Enter ingredient Name" />

                                            </Form.Group>

                                            <Form.Group className="mb-3" id="formBasicEmail">
                                                <Form.Label>Measure</Form.Label>
                                                <Form.Control name="ingredAmount" id="ingredAmount" type="text" placeholder="Enter Amount" />

                                                <Form.Select aria-label="Default select example" name="ingredAmountType" id="ingredAmountType">

                                                    <option value="x">Amount (xN)</option>
                                                    <option value="g">Grams</option>
                                                    <option value="c">Cups</option>
                                                    <option value="tbs">Tablespoon</option>
                                                    <option value="tsp">Teaspoon</option>

                                                </Form.Select>
                                            </Form.Group>



                                            <Form.Group className="mb-3" id="formBasicPassword">
                                                <Form.Label>Note</Form.Label>
                                                <Form.Control name="ingredNote" id="ingredNote" type="text" placeholder="(optional)" />
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
                                        <Card.Title>Ingred Summary</Card.Title>
                                        <Container>

                                            {ingreds.map((ingred) => {
                                                return (
                                                    <div>
                                                        <Row>
                                                            <Col>
                                                                <li>{ingred.Amount} {ingred.AmountType} {ingred.Name}</li>
                                                            </Col>
                                                            <Col>
                                                                <Button onClick={() => setIngreds(ingreds.filter(function (ingredItem) { return ingredItem.Name !== ingred.Name }))}><RiDeleteBin7Line></RiDeleteBin7Line></Button>
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
                        <Row>
                            <h1>Instructions</h1>
                            <Col>

                                <Card style={{ maxWidth: '20em', color: "black" }}>
                                    {/* <Card.Img variant="top" src="/edge_login_image.png" /> */}
                                    <Card.Body>
                                        {/* <Card.Title>Add ingredient</Card.Title> */}

                                        <Form onSubmit={(e) => onSubmitInstruc(e)}>

                                            <Form.Group className="mb-3" id="formBasicEmail">
                                                <Form.Label>Instruction Step</Form.Label>
                                                <Form.Control name="instructText" id="instructText" type="text" placeholder="Enter Instruction" />
                                            </Form.Group>



                                            <Form.Group className="mb-3" id="formBasicPassword">
                                                <Form.Label>Note</Form.Label>
                                                <Form.Control name="instructNote" id="instructNote" type="text" placeholder="(optional)" />
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
                                <input accept="image/*" type="file" onChange={(e) => { getBase64(e.target.files[0], (data)=>setImageData(data)) }} />
                                <Button onClick={()=>console.log(imageData)}></Button>
                            </Col>
                            <Col>
                                {/* {image!==undefined?<Image src={image}></Image>: <h4>no image</h4>} */}
                                <Card style={{ maxWidth: '20em', color: "black", right: "0px", float: "right" }}>
                                    <img src={imageData} style={{ maxmaxWidth: "20em", maxHeight: "20em" }} />
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
