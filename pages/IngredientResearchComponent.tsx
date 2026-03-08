import React, { useState } from 'react';
import { quantity_unit_conversions } from "../lib/conversion";
import { Button } from "../components/ui/button"

export default function IngredientResearchComponent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientData, setIngredientData] = useState<any[]>([]);
    const [quantity, setQuantity] = useState<number | string>(1);
    const [quantityUnit, setQuantityUnit] = useState('any');
    const [loading, setLoading] = useState(false);

    async function handleGetIngredient(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const res = await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`);
        const data = await res.json();
        setLoading(false);

        if (data.loadedSource === true) {
            const resLoaded = await fetch(`/api/Ingredients/?name=${searchTerm}&qType=${quantityUnit}&quantity=${quantity}&EDGEtoken=${localStorage.getItem('Token')}`);
            const dataLoaded = await resLoaded.json();
            setIngredientData(dataLoaded.res || []);
        } else {
            setIngredientData(data.res || []);
        }
    }

    function getTopProducts() {
        const sortedProducts = [...ingredientData].sort((a, b) => a.rank - b.rank);
        return sortedProducts.slice(0, 3);
    }

    return (
        <div className="w-full">
            <form onSubmit={handleGetIngredient} className="flex flex-col gap-4 mb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="text-sm font-semibold mb-1 block">Ingredient</label>
                        <input
                            name="ingredName"
                            value={searchTerm}
                            type="text"
                            placeholder="Enter ingredient name"
                            onChange={(e) => setSearchTerm(e.target.value)}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            autoComplete='off'
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="w-24">
                            <label className="text-sm font-semibold mb-1 block">Qty</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-sm font-semibold mb-1 block">Unit</label>
                            <select
                                name="quantity_type"
                                onChange={(e) => setQuantityUnit(e.target.value)}
                                value={quantityUnit}
                                required
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option className="text-black" value="any">any</option>
                                {Object.keys(quantity_unit_conversions).map((item) => (
                                    <option className="text-black" key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" className="h-10">Search</Button>
                        </div>
                    </div>
                </div>
            </form>

            {loading && (
                <div className="flex justify-center my-8 text-primary">
                    <object type="image/svg+xml" data="/loading.svg" className="w-12 h-12">loading...</object>
                </div>
            )}

            {ingredientData.length > 0 && (
                <div className="mb-12">
                    <h3 className="text-xl font-bold mb-6 text-foreground">Top 3 Products</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {getTopProducts().map((product, index) => {
                            const barColors = ['bg-yellow-400', 'bg-slate-300', 'bg-amber-600'];
                            const rankColor = barColors[index] || 'bg-border';
                            return (
                                <div key={index} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden relative">
                                    <div className={`h-2 w-full ${rankColor}`}></div>
                                    <div className="p-6">
                                        <div className="flex flex-col gap-1 mb-4">
                                            <span className="text-2xl font-bold opacity-80">#{index + 1}</span>
                                            <h5 className="text-xl font-semibold leading-none tracking-tight pr-12">{product.name}</h5>
                                        </div>
                                        <div className="absolute top-6 right-4 w-12 h-12 bg-white rounded-md p-1 border border-border flex items-center justify-center">
                                            <img
                                                src={`/${product.source}.png`}
                                                alt={product.source}
                                                className="max-w-full max-h-full object-contain"
                                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                            />
                                        </div>
                                        <div className="text-sm text-muted-foreground text-center mb-6">{product.source}</div>
                                        <div className="space-y-2 text-center text-sm">
                                            <div className="flex justify-between border-b border-border pb-2">
                                                <strong className="text-muted-foreground">Price:</strong>
                                                <span className="font-medium">${Number(product.price).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-border pb-2">
                                                <strong className="text-muted-foreground">Unit Price:</strong>
                                                <span className="font-medium">
                                                    {product.unit_price_converted < 1
                                                        ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                                        : `$${Number(product.unit_price_converted).toFixed(2)}`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between pb-2">
                                                <strong className="text-muted-foreground">Quantity:</strong>
                                                <span className="font-medium">{product.quantity} {product.quantity_unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {ingredientData.length > 0 && (
                <div className="rounded-md border border-border overflow-x-auto w-full">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Product Name</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Price</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Unit Price</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Quantity</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Source</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Rank</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ingredientData.map((product, idx) => (
                                <tr key={idx} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle">{product.name}</td>
                                    <td className="p-4 align-middle">${Number(product.price).toFixed(2)}</td>
                                    <td className="p-4 align-middle">
                                        {product.unit_price_converted < 1
                                            ? `${(product.unit_price_converted * 100).toFixed(2)}¢`
                                            : `$${Number(product.unit_price_converted).toFixed(2)}`}
                                    </td>
                                    <td className="p-4 align-middle">{product.quantity} {product.quantity_unit}</td>
                                    <td className="p-4 align-middle">{product.source}</td>
                                    <td className="p-4 align-middle">{product.rank}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
