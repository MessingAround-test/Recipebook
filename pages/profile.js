import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'



import { Toolbar } from './Toolbar'
import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'



export default function Home() {
    const [userData, setUserData] = useState({})

    async function getUserDetails() {
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function UpdateUserDetails(e) {
        e.preventDefault();
        let data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        })).json()
        console.log(data)
        if (data.success === false || data.success === undefined){
            if (data.message !== undefined){
                alert(data.message)
            } else {
                alert("failed, unexpected error")
            }
            
        }
    }


    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            alert("please re-log in")
            Router.push("/login")
        }

        getUserDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array







    return (
        <div>
            <Toolbar>
            </Toolbar>
            <div className={styles.container}>
                <Head>
                    <title>Profile</title>
                    <meta name="description" content="Generated by create next app" />
                    <link rel="icon" href="/avo.ico" />
                </Head>








                <main className={styles.main}>

                    <Form onSubmit={(e) => UpdateUserDetails(e)}>
                        {
                            Object.keys(userData).map((item, i) => (
                                // <h1>{item} : { userData[item] } </h1>
                                <Form.Group className="mb-3" id="formBasicPassword">
                                    <Form.Label>{item}</Form.Label>
                                    <Form.Control value={userData[item]} onChange={(e) => setUserData(
                                        Object.assign(
                                            {},
                                            userData,
                                            { [item]: e.target.value }
                                        )
                                    )} />
                                </Form.Group>

                            ))
                        }
                        <Button variant="primary" type="submit">
                            Submit
                        </Button>
                    </Form>


                    <Button onClick={() => console.log(userData)}>SHow state</Button>
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
