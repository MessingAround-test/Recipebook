import Head from 'next/head'
import Image from 'next/image'
import styles from '../../styles/Home.module.css'
import { Toolbar } from '../../components/Toolbar'
import { useEffect, useState } from 'react'
import Router from 'next/router'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

export default function Home() {
    const [userData, setUserData] = useState({})
    const [recipeName, setRecipeName] = useState("")
    const [imageData, setImageData] = useState()

    async function getUserDetails() {
        let res = await fetch("/api/UserDetails", {
            headers: { 'edgetoken': localStorage.getItem('Token') || '' }
        })
        let data = await res.json()
        setUserData(data.res)
    }

    function getBase64(file, cb) {
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            cb(reader.result)
        };
        reader.onerror = function (error) {
            console.log('Error: ', error);
        };
    }

    const onSubmitRecipe = async () => {
        // Placeholder for onSubmitRecipe logic
        console.log("Submitting recipe:", recipeName);
    }

    useEffect(() => {
        if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
            Router.push("/login")
        }
        getUserDetails();
    }, [])

    const redirect = async function (page) {
        Router.push(page)
    };

    return (
        <div>
            <Toolbar />
            <div className={styles.container}>
                <Head>
                    <title>Create Game</title>
                    <meta name="description" content="Create a new game" />
                    <link rel="icon" href="/avo.ico" />
                </Head>

                <main className={styles.main}>
                    <div className="max-w-4xl mx-auto w-full px-4 text-black dark:text-white">
                        <h1 className="text-3xl font-bold mb-6">General</h1>
                        <div className="grid grid-cols-1 gap-6">
                            <Card className="text-black dark:text-white border border-border">
                                <CardContent className="pt-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="gameName">Game Name</Label>
                                            <Input
                                                name="gameName"
                                                id="gameName"
                                                placeholder="Enter Game Name"
                                                onChange={(e) => setRecipeName(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="ingredAmount">Measure</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    name="ingredAmount"
                                                    id="ingredAmount"
                                                    placeholder="Enter Amount"
                                                    required
                                                />
                                                <select
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    name="ingredAmountType"
                                                    id="ingredAmountType"
                                                    required
                                                >
                                                    <option value="x">Amount (xN)</option>
                                                    <option value="g">Grams</option>
                                                    <option value="c">Cups</option>
                                                    <option value="tbs">Tablespoon</option>
                                                    <option value="tsp">Teaspoon</option>
                                                    <option value="L">Litres</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            <div>
                                <h1 className="text-2xl font-bold mb-4">Add Image</h1>
                                <Input
                                    accept="image/*"
                                    type="file"
                                    onChange={(e) => {
                                        if (e.target.files[0]) {
                                            getBase64(e.target.files[0], (data) => setImageData(data))
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex justify-end">
                                <Card className="w-full max-w-[20rem] p-0 overflow-hidden border border-border">
                                    {imageData ? (
                                        <img src={imageData} className="w-full h-auto object-contain max-h-[20rem]" alt="Preview" />
                                    ) : (
                                        <div className="h-[20rem] flex items-center justify-center text-muted-foreground">
                                            No image selected
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button className="w-full md:w-auto px-8" onClick={() => onSubmitRecipe()}> Save </Button>
                        </div>
                    </div>
                </main>

                <footer className={styles.footer}>
                    &copy; {new Date().getFullYear()} Recipebook
                </footer>
            </div>
        </div>
    )
}
