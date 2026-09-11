import React, { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Lora, Dancing_Script } from 'next/font/google'
import '../styles/tw-animate.css'
import '../styles/shadcn-tailwind.css'
import '../styles/globals.css'

// Reading font for instruction steps — serif stays crisp at cooking distance
const lora = Lora({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-reading'
})

// Cursive font for recipe titles over the hashed-colour hero banner
const dancingScript = Dancing_Script({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-cursive'
})

function MyApp({ Component, pageProps }: AppProps) {
    useEffect(() => {
        // Register the reading font family at :root so html/body/indexed
        // portals all inherit it (the variable class alone only covers the
        // wrapper div's subtree)
        document.documentElement.style.setProperty('--font-reading', lora.style.fontFamily)
        document.documentElement.style.setProperty('--font-cursive', dancingScript.style.fontFamily)
    }, [])

    useEffect(() => {
        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'dark'
        if (savedTheme === 'light') {
            document.documentElement.classList.add('light')
        } else {
            document.documentElement.classList.remove('light')
        }
    }, [])

    return (
        <div className={`${lora.variable} ${dancingScript.variable}`}>
            <Component {...pageProps} />
        </div>
    )
}

export default MyApp
