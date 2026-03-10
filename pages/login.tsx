import { useState, FormEvent } from 'react'
import Router from 'next/router'
import Head from 'next/head'
import { FormField } from '../components/FormField'
import { Button } from '../components/ui/button'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const res = await fetch("/api/login", {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (data.success === false) {
            alert(data.message)
        } else if (data.success === true) {
            localStorage.setItem('Token', data.data.token)
            Router.push('/')
        } else {
            alert(String(data))
        }
    }

    const redirect = (page: string) => {
        Router.push(page)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <Head>
                <title>Login | Bryns Garbage</title>
                <link rel="icon" href="/avo.ico" />
            </Head>

            <main className="flex justify-center items-center w-full">
                <div className="receipt w-[380px] p-8 max-w-[90vw]">
                    <h2 className="text-center font-bold uppercase mb-4 border-b-2 border-dashed border-black pb-2 text-black">Login</h2>

                    <form onSubmit={onSubmit}>
                        <div className="mb-4">
                            <label className="label-paper">Email Address</label>
                            <input
                                name="email"
                                id="email"
                                type="email"
                                placeholder="Enter email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="label-paper">Password</label>
                            <input
                                name="password"
                                id="password"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-4">
                            <Button type="submit" className="w-full font-bold uppercase">
                                Submit
                            </Button>
                            <div className="flex flex-row justify-between gap-2 mt-3">
                                <Button variant="outline" className="w-full text-black border-black hover:bg-black hover:text-white" type="button" onClick={() => redirect("/register")}>
                                    Register
                                </Button>
                                <Button variant="outline" className="w-full text-black border-black hover:bg-black hover:text-white" type="button" onClick={() => redirect("/SamplePage")}>
                                    Sample
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
