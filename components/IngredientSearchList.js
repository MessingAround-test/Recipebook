import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'

import Table from 'react-bootstrap/Table';

import { useEffect, useState } from 'react'
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Router from 'next/router'



export function IngredientSearchList(props) {
    const [allIngreds, setAllIngreds] = useState([])
    const [filteredIngreds, setFilteredIngreds] = useState([])
    const [Headers, setHeaders] = useState([])
    const [Suppliers, setSuppliers] = useState([])
    const [filtersObj, setFiltersObj] = useState({ "name": "", "supplier": "" })


    async function getAllIngredients() {
        if (props.search_term === undefined) {
            let data = await (await fetch(`/api/Ingredients/?EDGEtoken=` + localStorage.getItem('Token'))).json()
            setAllIngreds(data.res)
            setFilteredIngreds(data.res)
        } else {
            let data = await getIngredient(props.search_term, undefined)
            setAllIngreds(data)
            setFilteredIngreds(data)
        }

        // console.log(data)
        // setRecipes(data.res)
    }

    async function deleteAllIngredients() {
        let data = await (await fetch(`/api/Ingredients/?EDGEtoken=` + localStorage.getItem('Token'), { method: "DELETE" })).json()
        setAllIngreds([])
    }

    async function handleGetIngredient(e) {
        e.preventDefault();

        console.log(e)
        let IngredQuery = e.target.ingredName.value.toLowerCase()
        let supplierName = e.target.supplierName.value
        let data = getIngredient(IngredQuery, supplierName)
        setAllIngreds([...allIngreds.concat(data)])
    }

    function objectToQueryString(obj) {
        const queryString = [];

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            queryString.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`);
                        });
                    } else {
                        queryString.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    }
                }
            }
        }

        return queryString.join('&');
    }


    async function getIngredient(IngredQuery, supplierName) {
        let queryObj = { "name": IngredQuery, "supplier": supplierName, "EDGEtoken": localStorage.getItem('Token') }
        let data = await (await fetch(`/api/Ingredients?${objectToQueryString(queryObj)}`)).json()
        console.log(data)
        if (data.loadedSource === true) {
            data = await (await fetch(`/api/Ingredients?name=${IngredQuery}&supplier=${supplierName}&EDGEtoken=` + localStorage.getItem('Token'))).json()
            console.log(data)
        }

        return data.res
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
            "unit_price",
            "quantity",
            // "quantity_type",
            "quantity_unit",
            "search_term",
            "rank"
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


    return (
        <div className="flex-col gap-8">
            <div className="glass-card">
                <form onSubmit={(e) => handleGetIngredient(e)} className="flex-col gap-4">
                    <div className="flex-row gap-4">
                        <div className="flex-col w-full">
                            <label className="label-modern">Ingredient Name</label>
                            <input
                                className="input-modern"
                                name="ingredName"
                                id="ingredName"
                                value={props.search_term}
                                type="text"
                                placeholder="e.g. Tomato"
                                onChange={(e) => updateFilteredIngreds(e)}
                                required
                            />
                        </div>
                        <div className="flex-col w-full">
                            <label className="label-modern">Supplier</label>
                            <select
                                className="input-modern"
                                name="supplierName"
                                id="supplierName"
                                onChange={(e) => updateFilteredIngreds(e)}
                                style={{ appearance: 'none' }}
                            >
                                {Suppliers.map((supplier) => (
                                    <option key={supplier} value={supplier}>{supplier || 'All Suppliers'}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-row justify-between align-center mt-4">
                        <button className="btn-modern" type="submit">
                            Search Ingredients
                        </button>
                        <button
                            className="btn-modern btn-danger"
                            type="button"
                            onClick={(e) => { if (confirm('Delete all cached ingredients?')) deleteAllIngredients() }}
                        >
                            Clear Cache
                        </button>
                    </div>
                </form>
            </div>

            <div className="glass-card p-0 overflow-hidden">
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: '800px' }}>
                        <Row className="p-4 align-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--glass-border)', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                            {Headers.map((key) => (
                                <Col key={key} style={{ flex: 1 }}>{key.replace('_', ' ')}</Col>
                            ))}
                        </Row>
                        {filteredIngreds.map((ingredient, idx) => (
                            <Row key={idx} className="p-4 align-center hover-accent" style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '0.95rem', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                {Headers.map((key) => (
                                    <Col key={key} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {key === 'price' || key === 'unit_price' ? `$${Number(ingredient[key]).toFixed(2)}` : ingredient[key]}
                                    </Col>
                                ))}
                            </Row>
                        ))}
                    </div>
                </div>
                {filteredIngreds.length === 0 && (
                    <div className="p-8 text-center text-secondary">
                        No ingredients found. Try a different search term.
                    </div>
                )}
            </div>
        </div>
    )
}
