import type { AppProps } from 'next/app'
import '../styles/tw-animate.css'
import '../styles/shadcn-tailwind.css'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
    return <Component {...pageProps} />
}

export default MyApp
