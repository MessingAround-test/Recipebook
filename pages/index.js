import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react'
import { AiFillPlusCircle } from "react-icons/ai";
import Card from 'react-bootstrap/Card'
import {Row, Col} from 'react-bootstrap'

import { Toolbar } from './Toolbar'


import Router from 'next/router'
import Button from 'react-bootstrap/Button';


export default function Home() {

  // , { "name": "Game", "_id": "/game" }
  const [pages, setPages] = useState([{ "name": "Recipes", "_id": "/recipes", "image": "cookbook_oragami.png" }, { "name": "Shopping List", "_id": "/shoppingList", "image": "shop_list_oragami.png" }, { "name": "One Off Extracts", "_id": "/oneOffExtracts", "image": "forklift_oragami.png" }])
  // , {"name": "Beer Crap", "_id": "/beer", "image": "beers/LOUIS.jpg"}

  useEffect(() => {
    if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
      alert("please re-log in")
      Router.push("/login")
    }
  });

  const redirect = async function (page) {
    Router.push(page)
  };

  return (
    <div key={"index div"}>
      <Toolbar>
      </Toolbar>
      <div className={styles.container} key={"main content div"}>
        <Head>
          <title>Bryns Garbage</title>
          <meta name="description" content="Some garbage" />
          <link rel="icon" href="/avo.ico" />
        </Head>
        {/* sudo useradd -m edgeApp vgx3I5Q0cfMH0_oBw2rkry9nE */}
        <main className={styles.main}>
          <div className={styles.cardGroup}>
            <Row xl={5} lg={4} md={3} sm={2} xs={1}>
              {pages.map((page) => {
                return (
                  <Col>
                    <div style={{ padding: "0.5vh" }}>
                      <Card style={{ color: "black", "alignItems": "center", "justifyContent": "center" }} >


                        <Card.Body style={{ overflow: "hidden" }} onClick={() => (redirect("/" + page._id))}>


                          <Card.Title>{String(page.name)}</Card.Title>
                          <Card.Img variant="top" src={page.image} />
                        </Card.Body>

                      </Card>
                    </div>
                  </Col>
                )

              })}
            </Row>
            {/* {pages.map((recipe) => {
              return (
                <div style={{ padding: "0.5vh" }}>
                  <Card style={{ maxWidth: '45vw', minWidth: "45vw", maxHeight: "45vw", minHeight: "45vw", color: "black" }} onClick={() => (redirect("/" + recipe._id))}>
                    <Card.Body style={{ overflow: "hidden" }}>
                      <Card.Title>{String(recipe.name)}</Card.Title>
                      <Card.Img variant="top" src={recipe.image} />
                    </Card.Body>

                  </Card>
                </div>
              )

            })} */}
          </div>
          {/* <Button onClick={() => console.log(pages)}> show pages</Button> */}
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
