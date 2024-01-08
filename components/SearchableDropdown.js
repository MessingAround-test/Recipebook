import React, { useState, useEffect, useRef } from 'react';

import styles from '../styles/SearchableDropdown.module.css'

function SearchableDropdown({ options, placeholder, onChange,name,value}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [selectedOption, setSelectedOption] = useState(null);
  const dropdownRef = useRef(null);

  const filterOptions = () => {
    return options.filter((option) =>
      {
        if (inputValue=== undefined){
          return false
        }
        return (option.toLowerCase().includes(inputValue.toLowerCase()))
      }
      
    );
  };

  const toggleDropdown = () => {
    // setIsOpen(!isOpen);
    setIsOpen(true);
    console.log(isOpen)
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsOpen(true); // Open the dropdown when typing in the input
    onChange(e)
  };

  const selectOption = (option) => {
    setSelectedOption(option);
    setInputValue(option);
    setIsOpen(false);
    let e = {target: {name: name, value: option}}
    onChange(e)
  };

  const filteredOptions = filterOptions();

  const closeDropdown = (e) => {
    if (dropdownRef.current === null){
      setIsOpen(false);
      return
    }
    if (!dropdownRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', closeDropdown);
    return () => {
      document.removeEventListener('click', closeDropdown);
    };
  }, []);

  
  return (
    <div className={styles['searchable-dropdown']}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        name={name}
        onClick={toggleDropdown}
        placeholder={placeholder}
        className={styles.input}
        autocomplete="off"
      />
      {isOpen && (
        <ul className={styles['dropdown-list']} ref={dropdownRef}>
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={(e) => selectOption(option)}
              className={
                option === selectedOption
                  ? styles.selected
                  : ''
              }
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

}

export default SearchableDropdown;
