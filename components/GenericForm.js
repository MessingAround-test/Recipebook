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
        <div className="receipt" style={{ maxWidth: '450px', margin: '1rem auto' }}>
            <form onSubmit={handleSubmit}>
                <h3 className="text-center bold uppercase mb-3" style={{ borderBottom: '2px dashed black', paddingBottom: '0.5rem' }}>Entry</h3>
                {Object.keys(formData).map((key) => {
                    if (Array.isArray(formData[key].options)) {
                        return (
                            <div className="mb-3" key={key}>
                                <label className="label-paper">{key}</label>
                                <SearchableDropdown options={formData[key].options} placeholder={key} onChange={handleChange} name={key}></SearchableDropdown>
                            </div>
                        )
                    } else {
                        return (
                            <div className="mb-3" key={key}>
                                <label className="label-paper">{key}</label>
                                <input
                                    name={key}
                                    id={key}
                                    type="text"
                                    placeholder={key}
                                    onChange={handleChange}
                                    className="input-paper"
                                />
                            </div>
                        )
                    }
                })}

                <div className="flex-col gap-2 mt-4">
                    <button className="btn-paper w-full" type="submit">
                        Submit
                    </button>
                    <button className="btn-paper btn-sm w-full" type="button" onClick={() => console.log(formData)}>
                        Show State (Debug)
                    </button>
                </div>
            </form>
        </div>
    );
}

export default GenericForm;
