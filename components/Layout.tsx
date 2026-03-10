import Head from 'next/head'
import { ReactNode } from 'react'
import { Toolbar } from '../pages/Toolbar'
import styles from '../styles/Home.module.css'

interface LayoutProps {
    title: string
    description?: string
    children: ReactNode
}

export function Layout({ title, description = 'Premium Culinary Management', children }: LayoutProps) {
    return (
        <div className={styles.wrapper}>
            <Toolbar />
            <div className={styles.container}>
                <Head>
                    <title>{`${title} | Recipebook`}</title>
                    <meta name="description" content={description} />
                    <link rel="icon" href="/avo.ico" />
                </Head>

                <main className={styles.main}>
                    {children}
                </main>

                <footer className={styles.footer}>
                    &copy; {new Date().getFullYear()} Recipebook &bull; Premium Culinary Management
                </footer>
            </div>
        </div>
    )
}
