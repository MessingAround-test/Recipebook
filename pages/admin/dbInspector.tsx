import React, { useEffect, useState } from 'react'
import { Layout } from '../../components/Layout'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { useAdminGuard } from '../../lib/useAdminGuard'
import Router from 'next/router'
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiChevronRight, FiChevronDown } from 'react-icons/fi'

export default function DbInspector() {
    const isAuthorized = useAdminGuard()
    const [collections, setCollections] = useState<string[]>([])
    const [selectedCollection, setSelectedCollection] = useState<string>('')
    const [documents, setDocuments] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState<string>('{}')
    const [loading, setLoading] = useState<boolean>(false)
    const [editingDoc, setEditingDoc] = useState<any>(null)
    const [editData, setEditData] = useState<string>('')

    useEffect(() => {
        if (isAuthorized) {
            fetchCollections()
        }
    }, [isAuthorized])

    useEffect(() => {
        if (selectedCollection) {
            fetchDocuments()
        }
    }, [selectedCollection])

    async function fetchCollections() {
        const token = localStorage.getItem('Token')
        const res = await fetch('/api/admin/dbInspector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
            body: JSON.stringify({ action: 'listCollections' })
        })
        const data = await res.json()
        if (data.success) {
            setCollections(data.collections)
            if (data.collections.length > 0) {
                setSelectedCollection(data.collections[0])
            }
        }
    }

    async function fetchDocuments() {
        if (!selectedCollection) return
        setLoading(true)
        const token = localStorage.getItem('Token')
        try {
            const res = await fetch('/api/admin/dbInspector', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    action: 'fetchDocuments',
                    collection: selectedCollection,
                    query: searchQuery
                })
            })
            const data = await res.json()
            if (data.success) {
                setDocuments(data.documents)
            } else {
                alert("Error: " + data.message)
            }
        } catch (e: any) {
            alert("Fetch failed: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this document?")) return
        const token = localStorage.getItem('Token')
        const res = await fetch('/api/admin/dbInspector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
            body: JSON.stringify({
                action: 'deleteDocument',
                collection: selectedCollection,
                id: id
            })
        })
        const data = await res.json()
        if (data.success) {
            fetchDocuments()
        } else {
            alert("Delete failed: " + data.message)
        }
    }

    async function handleSaveEdit() {
        try {
            const parsedData = JSON.parse(editData)
            const token = localStorage.getItem('Token')
            const action = editingDoc._id ? 'updateDocument' : 'createDocument'
            const res = await fetch('/api/admin/dbInspector', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'edgetoken': token || '' },
                body: JSON.stringify({
                    action: action,
                    collection: selectedCollection,
                    id: editingDoc._id,
                    data: parsedData
                })
            })
            const data = await res.json()
            if (data.success) {
                setEditingDoc(null)
                fetchDocuments()
            } else {
                alert("Save failed: " + data.message)
            }
        } catch (e: any) {
            alert("Invalid JSON: " + e.message)
        }
    }

    if (!isAuthorized) return null

    return (
        <Layout title="DB Inspector">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <PageHeader title="Database Inspector" />
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar: Collections */}
                    <div className="lg:col-span-1">
                        <div className="glass-card h-full">
                            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4">Collections</h3>
                            <div className="flex flex-col gap-2">
                                {collections.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setSelectedCollection(c)}
                                        className={`text-left px-4 py-3 rounded-lg transition-all border ${
                                            selectedCollection === c 
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold' 
                                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content: Document Viewer */}
                    <div className="lg:col-span-3">
                        <div className="glass-card mb-8">
                            <div className="flex flex-col md:flex-row gap-4 mb-2">
                                <div className="flex-grow">
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Search Query (JSON)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="input-modern pl-10 font-mono text-sm"
                                            placeholder='{"field": "value"}'
                                        />
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button onClick={fetchDocuments} className="whitespace-nowrap">
                                        Execute Query
                                    </Button>
                                    <Button variant="outline" onClick={() => {
                                        setEditingDoc({})
                                        setEditData('{\n  \n}')
                                    }}>
                                        <FiPlus className="mr-2" /> New
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-6">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold self-center mr-1">Examples:</span>
                                <button 
                                    onClick={() => setSearchQuery('{}')}
                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-muted-foreground border border-white/5"
                                >
                                    All ({'{}'})
                                </button>
                                <button 
                                    onClick={() => setSearchQuery('{"name": {"$regex": "findme", "$options": "i"}}')}
                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-muted-foreground border border-white/5"
                                >
                                    Regex Search
                                </button>
                                <button 
                                    onClick={() => setSearchQuery('{"status": "active"}')}
                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-muted-foreground border border-white/5"
                                >
                                    Field Equality
                                </button>
                                <button 
                                    onClick={() => setSearchQuery('{"quantity": {"$gt": 10}}')}
                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-muted-foreground border border-white/5"
                                >
                                    Greater Than
                                </button>
                            </div>

                            {loading ? (
                                <div className="py-20 text-center text-muted-foreground">Loading documents......</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    {documents.length === 0 ? (
                                        <div className="py-20 text-center text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                                            No documents found for this query in <strong>{selectedCollection}</strong>.
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="border-b border-white/10 text-muted-foreground text-[10px] uppercase font-black tracking-widest">
                                                    <th className="p-4 w-[80px]">Actions</th>
                                                    <th className="p-4">_id</th>
                                                    {Array.from(new Set(documents.flatMap(doc => Object.keys(doc))))
                                                        .filter(key => key !== '_id' && key !== '__v')
                                                        .slice(0, 8) // Limit columns to avoid horizontal overflow nightmare
                                                        .map(key => (
                                                            <th key={key} className="p-4">{key}</th>
                                                        ))
                                                    }
                                                </tr>
                                            </thead>
                                            <tbody className="text-xs">
                                                {documents.map(doc => {
                                                    const keys = Array.from(new Set(documents.flatMap(d => Object.keys(d))))
                                                        .filter(key => key !== '_id' && key !== '__v')
                                                        .slice(0, 8);
                                                    
                                                    return (
                                                        <tr key={doc._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                            <td className="p-4">
                                                                <div className="flex gap-1">
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingDoc(doc)
                                                                            setEditData(JSON.stringify(doc, null, 2))
                                                                        }}
                                                                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <FiEdit2 size={12} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDelete(doc._id)}
                                                                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <FiTrash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 font-mono text-[10px] text-emerald-500/60 truncate max-w-[120px]" title={doc._id}>
                                                                {doc._id}
                                                            </td>
                                                            {keys.map(key => {
                                                                const val = doc[key];
                                                                let displayVal = "";
                                                                if (val === null || val === undefined) displayVal = "-";
                                                                else if (typeof val === 'object') displayVal = JSON.stringify(val);
                                                                else displayVal = String(val);

                                                                return (
                                                                    <td key={key} className="p-4 max-w-[200px] truncate text-muted-foreground" title={displayVal}>
                                                                        {displayVal}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Edit/Create */}
            {editingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-emerald-500/30">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-emerald-400">
                                {editingDoc._id ? 'Edit Document' : 'New Document'}
                            </h2>
                            <button onClick={() => setEditingDoc(null)} className="text-muted-foreground hover:text-white">✕</button>
                        </div>
                        
                        <div className="flex-grow overflow-hidden flex flex-col mb-6">
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">JSON Data</label>
                            <textarea
                                value={editData}
                                onChange={(e) => setEditData(e.target.value)}
                                className="input-modern font-mono text-sm flex-grow min-h-[400px] resize-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex justify-end gap-4">
                            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancel</Button>
                            <Button onClick={handleSaveEdit}>Save Changes</Button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
