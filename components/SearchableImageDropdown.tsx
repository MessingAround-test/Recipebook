import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/SearchableDropdown.module.css';

function SearchableImageDropdown({ options, placeholder, onChange, name, value }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || {});
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);

    const filterOptions = () => {
        return options.filter((option: any) => {
            if (inputValue === undefined) return false;
            if (!inputValue.name) {
                return option.name.toLowerCase().includes("");
            } else {
                return option.name.toLowerCase().includes(inputValue.name.toLowerCase());
            }
        });
    };

    const toggleDropdown = () => {
        setIsOpen(true);
    };

    const handleInputChange = (e: any) => {
        setInputValue({ ...inputValue, name: e.target.value });
        setIsOpen(true);
        onChange(e);
    };

    const selectOption = (option: any) => {
        setSelectedOption(option);
        setInputValue(option);
        setIsOpen(false);
        let e = { target: { name: name, value: option } };
        onChange(e);
    };

    const filteredOptions = filterOptions();

    const closeDropdown = (e: any) => {
        if (dropdownRef.current === null) {
            setIsOpen(false);
            return;
        }
        if (!dropdownRef.current.contains(e.target) && e.target !== document.querySelector(`input[name=${name}]`)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        setInputValue(value || {});
        document.addEventListener('click', closeDropdown);
        document.addEventListener('touchstart', closeDropdown);

        return () => {
            document.removeEventListener('click', closeDropdown);
            document.removeEventListener('touchstart', closeDropdown);
        };
    }, [value]);

    return (
        <div className={styles['searchable-dropdown']}>
            <input
                type="text"
                value={inputValue.name || ''}
                onChange={handleInputChange}
                name={name}
                onClick={toggleDropdown}
                onTouchStart={toggleDropdown}
                placeholder={placeholder}
                className={styles.input}
                autoComplete="off"
            />
            {isOpen && (
                <ul className={styles['dropdown-list']} ref={dropdownRef}>
                    {filteredOptions.map((option: any) => (
                        <li
                            key={option.id || option.name}
                            onClick={() => selectOption(option)}
                            className={option === selectedOption ? styles.selected : ''}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 flex-shrink-0">
                                    <img
                                        src={`/categories/${option.image}`}
                                        alt={option.name}
                                        className="max-w-[48px] h-auto"
                                    />
                                </div>
                                <div className="flex-grow">{option.name}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SearchableImageDropdown;
