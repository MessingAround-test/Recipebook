import Head from 'next/head'
import { ReactNode } from 'react'
import { Toolbar } from './Toolbar'
import styles from '../styles/Home.module.css'

import versionData from '../version.json'

interface LayoutProps {
    title: string
    description?: string
    hideMobileToolbar?: boolean
    children: ReactNode
}

export function Layout({ title, description = 'Premium Culinary Management', hideMobileToolbar = false, children }: LayoutProps) {
    return (
        <div className={styles.wrapper}>
            <Toolbar hideMobile={hideMobileToolbar} />
            <div className={`${styles.container} ${hideMobileToolbar ? styles.noMobileToolbar : ''}`}>
                <Head>
                    <title>{`${title} | Recipebook`}</title>
                    <meta name="description" content={description} />
                    <link rel="icon" href="/avo.ico" />
                    <link rel="manifest" href="/manifest.json" />
                    <meta name="theme-color" content="#000000" />
                    <meta name="apple-mobile-web-app-capable" content="yes" />
                    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                    <meta name="apple-mobile-web-app-title" content="Recipebook" />
                </Head>


                <main className={styles.main}>
                    {children}
                </main>

                <footer className={styles.footer}>
                    &copy; {new Date().getFullYear()} Recipebook &bull; v{versionData.version}
                </footer>
            </div>
        </div>
    )
}
