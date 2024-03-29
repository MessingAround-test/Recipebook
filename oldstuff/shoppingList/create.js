
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
import AddShoppingItem from '../../components/AddShoppingItem'
import GenericForm from '../../components/GenericForm'


export default function Home() {
    const [userData, setUserData] = useState({})
    const router = useRouter()
    const { id } = router.query
    const [loading, setLoading] = useState(false)

    const blobToBase64 = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const convertBlobToBase64 = async (blob) => {
        return await blobToBase64(blob);
    }


    async function closeModal() {
        setIsOpen(false);
    }


    async function generateImage(prompt) {
        try {
            setLoading(true)

            let promptImage = await (await fetch(`https://image.pollinations.ai/p/${prompt} realistic`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })).blob();

            let resData = await convertBlobToBase64(promptImage)

            setLoading(false)
            return resData
        } catch (e) {

            setLoading(false)
        }
    }


    async function handleSubmit(e) {

        console.log(e)
        console.log(e.value)

        // let imageData = await generateImage(`Fruit and vegetables ${Math.random()*100000}`)
        // e.value.image = imageData

        let data = await (await fetch("/api/ShoppingList/" + "?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(e.value)
        })).json()
        console.log(data)
        if (data.success === false || data.success === undefined) {
            if (data.message !== undefined) {
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }

        } else {
            redirect("/shoppingList/")
        }
    }


    const deleteRecipe = async function (e) {

        let data = await (await fetch("/api/ShoppingList/" + String(router.query.id) + "?EDGEtoken=" + localStorage.getItem('Token'), {
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

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

    }, [router.isReady, id]) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };



    return (
        <div>
            <Toolbar>
            </Toolbar>
            <div className={styles.container}>
                <Head>
                    <title>Create a new List</title>
                    <meta name="description" content="Generated by create next app" />
                    <link rel="icon" href="/avo.ico" />
                </Head>
                <main className={styles.main}>

                    <Container className={styles.centered}>
                        <h1>Create a new List</h1>
                        <GenericForm formInitialState={{ "name": { "value": "" }, "note": { "value": "" } }} handleSubmitProp={(e) => handleSubmit(e)}>hi</GenericForm>
                        {loading ? <>loading...<object type="image/svg+xml" data="/loading.svg">svg-animation</object></> : <></>}
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
