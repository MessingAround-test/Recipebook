import React, { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { Button } from './ui/button'
import Skeleton from './Skeleton'

interface IngredientSearchListProps {
    search_term?: string
    hideSearchForm?: boolean
}

export function IngredientSearchList(props: IngredientSearchListProps) {
    const [allIngreds, setAllIngreds] = useState<any[]>([])
    const [filteredIngreds, setFilteredIngreds] = useState<any[]>([])
    const [Headers, setHeaders] = useState<string[]>([])
    const [Suppliers, setSuppliers] = useState<string[]>([])
    const [filtersObj, setFiltersObj] = useState({ name: "", supplier: "" })
    const [isLoading, setIsLoading] = useState(false)

    async function getAllIngredients() {
        setIsLoading(true)
        if (props.search_term === undefined) {
            let res = await fetch(`/api/Ingredients/`, {
                headers: { 'edgetoken': localStorage.getItem('Token') || "" }
            })
            let data = await res.json()
            setAllIngreds(data.res || [])
            setFilteredIngreds(data.res || [])
        } else {
            let data = await getIngredient(props.search_term, "")
            setAllIngreds(data || [])
            setFilteredIngreds(data || [])
        }
        setIsLoading(false)
    }


    async function handleGetIngredient(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        const target = e.target as typeof e.target & {
            ingredName: { value: string }
            supplierName: { value: string }
        }
        let IngredQuery = target.ingredName.value.toLowerCase()
        let supplierName = target.supplierName.value
        let data = await getIngredient(IngredQuery, supplierName)
        setAllIngreds([...allIngreds, ...data])
        setIsLoading(false)
    }

    function objectToQueryString(obj: any) {
        const queryString = []
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key]
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            queryString.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`)
                        })
                    } else {
                        queryString.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    }
                }
            }
        }
        return queryString.join('&')
    }

    async function getIngredient(IngredQuery: string, supplierName: string) {
        let skipConversion = localStorage.getItem('skipConversion') === 'true';
        let queryObj = {
            name: IngredQuery,
            supplier: supplierName,
            skipConversion: skipConversion
        }
        let res = await fetch(`/api/Ingredients?${objectToQueryString(queryObj)}`, {
            headers: { 'edgetoken': localStorage.getItem('Token') || "" }
        })
        let data = await res.json()
        if (data.loadedSource === true) {
            let resLoaded = await fetch(`/api/Ingredients?name=${IngredQuery}&supplier=${supplierName}`, {
                headers: { 'edgetoken': localStorage.getItem('Token') || "" }
            })
            data = await resLoaded.json()
        }
        return data.res || []
    }

    function updateIngredsListForFilter(filter: { name: string, supplier: string }) {
        let name = filter.name.toUpperCase()
        let supplier = filter.supplier.toUpperCase()

        let result = allIngreds.filter(function (ingred) {
            if (ingred.source.toUpperCase() !== supplier && supplier !== "" && supplier !== "ALL SUPPLIERS") {
                return false
            }
            if (!(ingred.name.toUpperCase().includes(name)) && name !== "") {
                return false
            }
            return true
        })
        setFilteredIngreds(result)
    }

    async function updateFilteredIngreds(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        let filter
        let newfilter
        if (e.target.name === "ingredName") {
            filter = e.target.value
            newfilter = { ...filtersObj, name: filter }
            setFiltersObj(newfilter)
        } else {
            filter = e.target.value
            newfilter = { ...filtersObj, supplier: filter }
            setFiltersObj(newfilter)
        }
        updateIngredsListForFilter(newfilter)
    }

    useEffect(() => {
        getAllIngredients()
        setHeaders([
            "name",
            "source",
            "price",
            "unit_price",
            "quantity",
            "quantity_unit",
            "search_term",
            "rank"
        ])
        setSuppliers([
            "", "WW", "IGA", "Panetta", "Coles"
        ])
    }, [])

    return (
        <div className="flex flex-col gap-8 w-full">
            {!props.hideSearchForm && (
                <div className="glass-card">
                    <form onSubmit={handleGetIngredient} className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex flex-col w-full">
                                <label className="text-sm font-semibold mb-1">Ingredient Name</label>
                                <input
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    name="ingredName"
                                    id="ingredName"
                                    defaultValue={props.search_term}
                                    type="text"
                                    placeholder="e.g. Tomato"
                                    onChange={updateFilteredIngreds}
                                    required
                                />
                            </div>
                            <div className="flex flex-col w-full">
                                <label className="text-sm font-semibold mb-1">Supplier</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    name="supplierName"
                                    id="supplierName"
                                    onChange={updateFilteredIngreds}
                                >
                                    {Suppliers.map((supplier) => (
                                        <option className="text-black" key={supplier} value={supplier}>{supplier || 'All Suppliers'}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4">
                            <Button type="submit">
                                Search Ingredients
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="glass-card p-0 overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <div className="min-w-[800px]">
                        <div className="flex flex-row p-4 items-center bg-secondary border-b border-border font-bold text-xs uppercase tracking-widest text-muted-foreground">
                            {Headers.map((key) => (
                                <div key={key} className="flex-1">{key.replace('_', ' ')}</div>
                            ))}
                        </div>
                        {filteredIngreds.map((ingredient, idx) => (
                            <div key={idx} className={`flex flex-row p-4 items-center transition-colors hover:bg-accent/50 border-b border-border text-sm ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5'}`}>
                                {Headers.map((key) => (
                                    <div key={key} className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis px-1">
                                        {key === 'price' || key === 'unit_price' ? `$${Number(ingredient[key]).toFixed(2)}` : ingredient[key]}
                                    </div>
                                ))}
                            </div>
                        ))}
                        {isLoading && [1, 2, 3].map((i) => (
                            <div key={`skeleton-${i}`} className="flex flex-row p-4 items-center border-b border-border text-sm">
                                {Headers.map((key) => (
                                    <div key={key} className="flex-1 px-1">
                                        <Skeleton height="1.25rem" width="80%" />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                {filteredIngreds.length === 0 && !isLoading && (
                    <div className="p-8 text-center text-muted-foreground">
                        No ingredients found. Try a different search term.
                    </div>
                )}
            </div>
        </div>
    )
}
