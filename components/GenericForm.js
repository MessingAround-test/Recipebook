import React, { useState } from 'react';
import SearchableDropdown from './SearchableDropdown';

function GenericForm({ formInitialState, handleSubmitProp, children = null }) {
    const [formData, setFormData] = useState(formInitialState);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let currentVal = formData[name]
        currentVal.value = value

        setFormData({ ...formData, [name]: currentVal });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let keyValuePairs = {};
        Object.keys(formData).forEach((key) => {
            keyValuePairs[key] = formData[key].value;
        });

        e.value = keyValuePairs

        handleSubmitProp(e)
    };

    return (
        <div className="w-full max-w-md mx-auto rounded-2xl bg-card shadow-sm p-4 sm:p-6 my-2">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {Object.keys(formData).map((key) => {
                    // Fields start empty; the initial value is only ever shown as
                    // the placeholder, so typing always starts from scratch.
                    const placeholderValue = formData[key].placeholder ?? formData[key].value ?? key
                    if (Array.isArray(formData[key].options)) {
                        return (
                            <div className="flex flex-col gap-2" key={key}>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{key}</label>
                                <SearchableDropdown options={formData[key].options} placeholder={key} onChange={handleChange} name={key}></SearchableDropdown>
                            </div>
                        )
                    } else {
                        return (
                            <div className="flex flex-col gap-2" key={key}>
                                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{key}</label>
                                <input
                                    name={key}
                                    id={key}
                                    type="text"
                                    placeholder={placeholderValue}
                                    value={formData[key].value ?? ''}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base font-bold tracking-tight text-foreground caret-water outline-none transition-colors focus:border-water/50 focus:ring-2 focus:ring-water/30 placeholder:font-semibold placeholder:text-muted-foreground"
                                />
                            </div>
                        )
                    }
                })}

                {children}

                <button className="mt-2 flex w-full items-center justify-center rounded-xl bg-water py-3 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-water/20 transition-all hover:bg-water/85 active:scale-[0.99]" type="submit">
                    Create list
                </button>
            </form>
        </div>
    );
}

export default GenericForm;
