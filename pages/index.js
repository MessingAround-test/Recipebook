import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react'
import { Toolbar } from './Toolbar'
import Router from 'next/router'

export default function Home() {

  const [pages, setPages] = useState([
    { "name": "Recipes", "_id": "/recipes", "image": "cookbook_oragami.png" },
    { "name": "Shopping List", "_id": "/shoppingList", "image": "shop_list_oragami.png" },
    { "name": "One Off Extracts", "_id": "/oneOffExtracts", "image": "forklift_oragami.png" }
  ])

  useEffect(() => {
    if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
      Router.push("/login")
    }
  }, []);

  const redirect = async function (page) {
    Router.push(page)
  };

  return (
    <div key={"index div"} className={styles.wrapper}>
      <Toolbar />
      <div className={styles.container} key={"main content div"}>
        <Head>
          <title>Recipebook | Collection</title>
          <meta name="description" content="Modern recipe and shopping management" />
          <link rel="icon" href="/avo.ico" />
        </Head>

        <main className={styles.main}>
          <div className={styles.card_grid}>
            {pages.map((page) => (
              <div
                key={page._id}
                className={styles.paperCard}
                onClick={() => redirect(page._id)}
              >
                <div className={styles.card_image_wrapper}>
                  <img src={page.image} alt={page.name} />
                </div>
                <div className={styles.card_body}>
                  <div className={styles.card_title}>{String(page.name)}</div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <footer className={styles.footer}>
          &copy; {new Date().getFullYear()} Recipebook &bull; Premium Culinary Management
        </footer>
      </div>
    </div>
  )
}
