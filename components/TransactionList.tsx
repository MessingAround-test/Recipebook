import { useEffect, useState } from 'react'
import Router from 'next/router'
import { Button } from './ui/button'

export function TransactionList(props: any) {
    const [allIngreds, setAllIngreds] = useState<any[]>([])
    const [filteredIngreds, setFilteredIngreds] = useState<any[]>([])
    const [Headers, setHeaders] = useState<string[]>([])
    const [Suppliers, setSuppliers] = useState<string[]>([])
    const [filtersObj, setFiltersObj] = useState({ "name": "", "supplier": "" })

    async function getAllIngredients() {
        if (props.search_term === undefined) {
            let res = await fetch(`/api/Transactions/?EDGEtoken=` + localStorage.getItem('Token'))
            let data = await res.json()
            setAllIngreds(data.res || [])
            setFilteredIngreds(data.res || [])
        } else {
            let data = await getIngredient(props.search_term, undefined)
            setAllIngreds(data)
            setFilteredIngreds(data)
        }
    }

    async function deleteAllIngredients() {
        let res = await fetch(`/api/Transactions/?EDGEtoken=` + localStorage.getItem('Token'), { method: "DELETE" })
        let data = await res.json()
        setAllIngreds([])
        setFilteredIngreds([])
    }

    async function handleGetIngredient(e: any) {
        e.preventDefault();
        let IngredQuery = e.target.ingredName.value.toLowerCase()
        let data = await getIngredient(IngredQuery, "")
        setAllIngreds([...allIngreds, ...data])
    }

    function objectToQueryString(obj: any) {
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

    async function getIngredient(IngredQuery: string, supplierName: string | undefined) {
        let queryObj = { "name": IngredQuery, "supplier": supplierName || "", "EDGEtoken": localStorage.getItem('Token') }
        let res = await fetch(`/api/Transactions?${objectToQueryString(queryObj)}`)
        let data = await res.json()
        if (data.loadedSource === true) {
            let resLoaded = await fetch(`/api/Transactions?name=${IngredQuery}&supplier=${supplierName || ""}&EDGEtoken=` + localStorage.getItem('Token'))
            data = await resLoaded.json()
        }
        return data.res || []
    }

    async function updateIngredsListForFilter(filter: any) {
        let name = filter.name.toUpperCase()
        let supplier = filter.supplier.toUpperCase()

        let result = allIngreds.filter(function (ingred) {
            if (ingred.source && ingred.source.toUpperCase() !== supplier && supplier !== "") {
                return false
            }
            if (ingred.name && !(ingred.name.toUpperCase().includes(name)) && name !== "") {
                return false
            }
            return true
        });
        setFilteredIngreds(result)
    }

    async function updateFilteredIngreds(e: any) {
        let filter
        let newfilter
        if (e.target.name === "ingredName") {
            filter = e.target.value
            newfilter = { ...filtersObj, "name": filter }
            setFiltersObj(newfilter)
        } else {
            filter = e.target.value
            newfilter = { ...filtersObj, "supplier": filter }
            setFiltersObj(newfilter)
        }
        updateIngredsListForFilter(newfilter)
    }

    useEffect(() => {
        getAllIngredients()
        setHeaders([
            'description',
            'amount',
            'category',
            'frequency',
            'frequency_type',
            'start_date',
            'finish_date',
            'user_id',
        ])
        setSuppliers(["", "WW", "IGA", "Panetta", "Coles"])
    }, [])

    return (
        <div className="w-full">
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm mb-8">
                <form onSubmit={handleGetIngredient} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-semibold mb-2 block">Name</label>
                            <input
                                name="ingredName"
                                id="ingredName"
                                defaultValue={props.search_term}
                                type="text"
                                placeholder="Enter ingredient Name"
                                onChange={updateFilteredIngreds}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                        <Button type="submit">Submit</Button>
                        <Button variant="destructive" onClick={deleteAllIngredients} type="button">
                            Delete all
                        </Button>
                    </div>
                </form>
            </div>

            <div className="rounded-md border border-border overflow-x-auto w-full bg-card">
                <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            {Headers.map((key) => (
                                <th key={key} className="h-10 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap capitalize">
                                    {key.replace('_', ' ')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredIngreds.map((ingredient, idx) => (
                            <tr key={idx} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                {Headers.map((key) => (
                                    <td key={key} className="p-4 align-middle whitespace-nowrap">
                                        {ingredient[key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
