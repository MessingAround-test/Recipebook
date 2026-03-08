import Router from 'next/router'
import styles from '../styles/Login.module.css'
import Head from 'next/head'
import { useState } from 'react';

export default function signup() {
    const onSubmit = async function (e) {
        e.preventDefault();

        let data = await (await fetch("/api/signup", {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "email": e.target.email.value,
                "password": e.target.password.value,
                "username": e.target.username.value,
            })
        })).json()

        if (data.success === false) {
            alert(await data.message)
        } else if (data.success === true) {
            localStorage.setItem('Token', data.data.token);
            Router.push('/login')
        }
    };

    const redirect = async function (page) {
        Router.push(page)
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Register | Bryns Garbage</title>
                <link rel="icon" href="/avo.ico" />
            </Head>

            <main className={styles.main_flex} >
                <div className="receipt" style={{ width: '380px', padding: '2rem' }}>
                    <h2 className="text-center bold uppercase mb-4" style={{ borderBottom: '2px dashed black', paddingBottom: '0.5rem' }}>Sign Up</h2>

                    <form onSubmit={(e) => onSubmit(e)}>
                        <div className="mb-3">
                            <label className="label-paper">Username</label>
                            <input
                                name="username"
                                id="username"
                                type="text"
                                placeholder="Enter username"
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="label-paper">Email address</label>
                            <input
                                name="email"
                                id="email"
                                type="email"
                                placeholder="Enter email"
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
                                className="input-paper"
                                required
                            />
                        </div>

                        <div className="flex-col gap-2 mt-4">
                            <button className="btn-paper w-full" type="submit">
                                Create Account
                            </button>
                            <button className="btn-paper btn-sm mt-2 w-full" type="button" onClick={() => redirect("/login")}>
                                Return to Login
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}
