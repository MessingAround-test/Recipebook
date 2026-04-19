import React, { useEffect } from 'react'
import type { AppProps } from 'next/app'
import '../styles/tw-animate.css'
import '../styles/shadcn-tailwind.css'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
    useEffect(() => {
        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'dark'
        if (savedTheme === 'light') {
            document.documentElement.classList.add('light')
        } else {
            document.documentElement.classList.remove('light')
        }
    }, [])

    return <Component {...pageProps} />
}

export default MyApp
