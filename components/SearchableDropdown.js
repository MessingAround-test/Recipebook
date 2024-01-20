import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/SearchableDropdown.module.css';

function SearchableDropdown({ options, placeholder, onChange, name, value, onComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [selectedOption, setSelectedOption] = useState(null);
  const optionSelectedRef = useRef(false);
  const dropdownRef = useRef(null);

  const filterOptions = () => {
    return options.filter((option) => {
      console.log(inputValue)
      if (inputValue.name=== undefined){
        return option.toLowerCase().includes(inputValue.toLowerCase())
      }
    }
      
    );
  };

  const toggleDropdown = () => {
    setIsOpen(true);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    onChange(e);
  };

  const handleInputBlur = () => {
    // Call onComplete only if an option is not selected using onMouseDown
    if (!optionSelectedRef.current && onComplete && inputValue.trim() !== '') {
      onComplete(inputValue.trim());
    }

    // Reset the ref
    optionSelectedRef.current = false;
  };

  const selectOption = (option) => {
    setSelectedOption(option);
    setInputValue(option);
    setIsOpen(false);
    let e = { target: { name: name, value: option } };
    onChange(e);
  
    // Triggering blur when an option is selected
    const inputElement = document.querySelector(`input[name=${name}]`);
    if (inputElement) {
      inputElement.blur();
    }
  };

  const filteredOptions = filterOptions();

  const closeDropdown = (e) => {
    if (dropdownRef.current === null) {
      setIsOpen(false);
      return;
    }

    if (!dropdownRef.current.contains(e.target) && e.target !== document.querySelector(`input[name=${name}]`)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    setInputValue(value || '');
    document.addEventListener('click', closeDropdown);
    return () => {
      document.removeEventListener('click', closeDropdown);
    };
  }, [value]);

  return (
    <div className={styles['searchable-dropdown']}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        name={name}
        onClick={toggleDropdown}
        placeholder={placeholder}
        className={styles.input}
        autoComplete="off"
      />
      {isOpen && (
        <ul className={styles['dropdown-list']} ref={dropdownRef}>
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onMouseDown={() => selectOption(option)}
              className={option === selectedOption ? styles.selected : ''}
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
