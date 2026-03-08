import React, { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css'; // Import CSS module
import { quantity_unit_conversions } from "../lib/conversion"
import SearchableDropdown from './SearchableDropdown';

function GenericForm({ formInitialState, handleSubmitProp }) {
    const [formData, setFormData] = useState(formInitialState);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let currentVal = formData[name]
        currentVal.value = value

        setFormData({ ...formData, [name]: currentVal });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.formData = formData
        let keyValuePairs = {};
        Object.keys(formData).forEach((key) => {
            keyValuePairs[key] = formData[key].value;
        });

        e.value = keyValuePairs

        handleSubmitProp(e)
    };

    return (
        <div className="glass-card" style={{ maxWidth: '500px', margin: '1.5rem auto', padding: '2rem' }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <h3 className="text-center font-bold uppercase text-2xl tracking-tight text-white mb-4 border-b border-[var(--glass-border)] pb-4">Entry</h3>
                {Object.keys(formData).map((key) => {
                    if (Array.isArray(formData[key].options)) {
                        return (
                            <div className="flex flex-col gap-2" key={key}>
                                <label className="label-modern text-white">{key}</label>
                                <SearchableDropdown options={formData[key].options} placeholder={key} onChange={handleChange} name={key}></SearchableDropdown>
                            </div>
                        )
                    } else {
                        return (
                            <div className="flex flex-col gap-2" key={key}>
                                <label className="label-modern text-white">{key}</label>
                                <input
                                    name={key}
                                    id={key}
                                    type="text"
                                    placeholder={key}
                                    onChange={handleChange}
                                    className="input-modern"
                                />
                            </div>
                        )
                    }
                })}

                <div className="flex flex-col gap-4 mt-6">
                    <button className="btn-modern !bg-emerald-500 hover:!bg-emerald-400 !text-black w-full py-4 text-base tracking-wider uppercase" type="submit">
                        Submit
                    </button>
                    <button className="btn-modern btn-outline text-sm w-full py-2" type="button" onClick={() => console.log(formData)}>
                        Show State (Debug)
                    </button>
                </div>
            </form>
        </div>
    );
}

export default GenericForm;
