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
        var data = await (await fetch("/api/UserDetails?EDGEtoken=" + localStorage.getItem('Token'))).json()
        console.log(data)
        setUserData(data.res)
    }

    async function ExtractFromAldi(e) {
        e.preventDefault();
        var data = await (await fetch("/api/Ingredients/Aldi?EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([])
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

                <Button onClick={(e)=>ExtractFromAldi(e)}> Extract Aldi </Button>


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
