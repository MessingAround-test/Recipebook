import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'



import { Toolbar } from './Toolbar'
import { useEffect } from 'react'

import Router from 'next/router'
import Button from 'react-bootstrap/Button';


export default function Home() {
  
  useEffect(() => {
    if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
        alert("please re-log in")
        Router.push("/login")
    }  
});
  
const redirect = async function(page) {
  Router.push(page)
};

  return (
    <div>
    <Toolbar>
    </Toolbar>
    <div className={styles.container}>
      <Head>
        <title>Edge Charting Application</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      
      
      
      
      
      {/* sudo useradd -m edgeApp vgx3I5Q0cfMH0_oBw2rkry9nE */}
      
      <main className={styles.main}>
      {/* <DataTable></DataTable> */}
        {/* <StackedBarchart></StackedBarchart> */}
        
        <Button onClick={()=>redirect("/recipes")}>Recipes</Button>
        
        {/* <GoogleChart></GoogleChart>
        <Barchart></Barchart> */}
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span> */}
        </a>
      </footer>
    </div>
    </div>
  )
}
