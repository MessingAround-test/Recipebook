import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

import Table from 'react-bootstrap/Table';

import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'



export function IngredientList(props) {
    const [allIngreds, setAllIngreds] = useState([])
    const [filteredIngreds, setFilteredIngreds] = useState([])
    const [Headers, setHeaders] = useState([])
    const [Suppliers, setSuppliers] = useState([])
    const [filtersObj, setFiltersObj] = useState({ "name": "", "supplier": "" })


    async function getAllIngredients() {
        var data = await (await fetch(`/api/Ingredients/?EDGEtoken=` + localStorage.getItem('Token'))).json()
        setAllIngreds(data.res)
        setFilteredIngreds(data.res)
        // console.log(data)
        // setRecipes(data.res)
    }

    async function deleteAllIngredients() {
        var data = await (await fetch(`/api/Ingredients/?EDGEtoken=` + localStorage.getItem('Token'), { method: "DELETE" })).json()
        setAllIngreds([])
    }

    async function getIngredient(e) {
        e.preventDefault();

        console.log(e)
        let IngredQuery = e.target.ingredName.value.toLowerCase()
        let supplierName = e.target.supplierName.value


        let data = await (await fetch(`/api/Ingredients/${IngredQuery}?supplier=${supplierName}&EDGEtoken=` + localStorage.getItem('Token'))).json()
        console.log(data)
        if (data.loadedSource === true) {
            data = await (await fetch(`/api/Ingredients/${IngredQuery}?supplier=${supplierName}&EDGEtoken=` + localStorage.getItem('Token'))).json()
            console.log(data)
        }

        setAllIngreds([...allIngreds.concat(data.res)])

        console.log(allIngreds)
        // setRecipes(data.res)
    }

    async function updateIngredsListForFilter(filter) {
        let name = filter.name.toUpperCase()
        let supplier = filter.supplier.toUpperCase()
        console.log(supplier)
        console.log(name)




        let result = allIngreds.filter(function (ingred) {
            if (ingred.source.toUpperCase() !== supplier && supplier !== "") {
                return false
            }

            if (!(ingred.name.toUpperCase().includes(name)) && name !== "") {
                return false
            }

            return true
        });

        setFilteredIngreds(result)

    }

    async function updateFilteredIngreds(e) {
        let filter
        let newfilter
        if (e.target.name === "ingredName") {
            filter = e.target.value
            newfilter = { ...filtersObj, "name": filter }
            await setFiltersObj(newfilter)
        } else {
            // filter = e.target.options[e.target.selectedIndex].text
            filter = e.target.value
            console.log(filter)
            console.log('YESYES')
            newfilter = { ...filtersObj, "supplier": filter }
            await setFiltersObj(newfilter)
        }
        updateIngredsListForFilter(newfilter)
    }



    useEffect(() => {
        getAllIngredients()
        setHeaders([
            // "_id",
            // "id",
            "name",
            "source",
            "price",
            "quantity",
            "quantity_type",
            "search_term",
            // "created_at",
            // "updated_at",
            // "__v"
        ])

        setSuppliers([
            "", "WW", "IGA", "Panetta", "Coles"
        ])
        // getRecipeDetails();
        // console.log(await data)
    }, []) // <-- empty dependency array


    const redirect = async function (page) {
        Router.push(page)
    };

    return (
        <div>
            <div >
                <Form onSubmit={(e) => getIngredient(e)}>
                    <Form.Group className="mb-3" id="formBasicEmail">
                        <Form.Label>Name</Form.Label>
                        <Form.Control name="ingredName" id="ingredName" type="text" placeholder="Enter ingredient Name" onChange={(e) => updateFilteredIngreds(e)} required />
                        <Form.Label>Supplier</Form.Label>
                        <Form.Select name="supplierName" id="supplierName" type="text" placeholder="Enter ingredient Name" onChange={(e) => updateFilteredIngreds(e)}>
                            {
                                Suppliers.map((supplier) => {
                                    return <option value={supplier}>{supplier}</option>
                                })
                            }
                        </Form.Select>

                    </Form.Group>


                    <Button variant="primary" type="submit">
                        Submit
                    </Button>
                    <Button variant="danger" style={{ "float": "right" }} onClick={(e) => deleteAllIngredients()}>
                        Delete all
                    </Button>
                </Form>
            </div>
            <br></br>
            <Table style={{ borderRadius: '5px', overflow: 'hidden', maxWidth: "100vw"}}>
                {Headers.map((key) => {
                    return (
                        <>
                            <th className={styles.th}>
                                {key}
                            </th>
                        </>
                    )
                })}
                {filteredIngreds.map((ingredient) => {
                    let res = Headers.map((key) => {
                        return (
                            <>
                                <td className={styles.td}>
                                    <a>
                                        {ingredient[key]}
                                    </a>
                                </td>
                            </>
                        )
                    })
                    return (
                        <>
                            <tr className={styles.tr} style={{ padding: "0.5vh" }}>
                                {res}
                            </tr>
                        </>
                    )

                })}

            </Table>

        </div>
    )
}
