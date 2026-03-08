import Router from 'next/router'
import styles from '../styles/Login.module.css'
import Head from 'next/head'
import homeStyles from '../styles/Home.module.css'
import { useState } from 'react';

export default function login() {
    const [email, setEmail] = useState()
    const [password, setPassword] = useState()

    const onSubmit = async function (e) {
        e.preventDefault();
        let data = await (await fetch("/api/login", {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "email": e.target.email.value,
                "password": e.target.password.value
            })
        })).json()
        if (data.success === false) {
            alert(await data.message)
        } else if (data.success === true) {
            localStorage.setItem('Token', data.data.token);
            Router.push('/')
        } else {
            alert(await String(data))
        }
    };

    const redirect = async function (page) {
        Router.push(page)
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Login | Bryns Garbage</title>
                <link rel="icon" href="/avo.ico" />
            </Head>

            <main className={styles.main_flex}>
                <div className="receipt" style={{ width: '380px', padding: '2rem' }}>
                    <h2 className="text-center bold uppercase mb-4" style={{ borderBottom: '2px dashed black', paddingBottom: '0.5rem' }}>Login</h2>

                    <form onSubmit={(e) => onSubmit(e)}>
                        <div className="mb-3">
                            <label className="label-paper">Email Address</label>
                            <input
                                name="email"
                                id="email"
                                type="email"
                                placeholder="Enter email"
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="label-paper">Password</label>
                            <input
                                name="password"
                                id="password"
                                type="password"
                                placeholder="Password"
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="flex-col gap-2 mt-4">
                            <button className="btn-paper w-full" type="submit">
                                Submit
                            </button>
                            <div className="flex-row justify-between gap-1 mt-3">
                                <button className="btn-paper btn-sm w-full" type="button" onClick={() => redirect("/register")}>
                                    Register
                                </button>
                                <button className="btn-paper btn-sm w-full" type="button" onClick={() => redirect("/SamplePage")}>
                                    Sample
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
