import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/SearchableDropdown.module.css';

function SearchableDropdown({ options, placeholder, onChange, name, value, onComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [selectedOption, setSelectedOption] = useState(null);
  const optionSelectedRef = useRef(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const filterOptions = () => {
    if (!isOpen) return []; // Don't compute if closed
    if (!inputValue || typeof inputValue !== 'string' || inputValue.trim() === '') {
      return options;
    }
    
    const search = inputValue.toLowerCase();
    return options.filter((option) => {
      const label = (typeof option === 'string' ? option : (option.label || '')).toLowerCase();
      return label.includes(search);
    });
  };

  const toggleDropdown = () => {
    setIsOpen(true);
    setInputValue(''); // Show everything on click
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    // Only trigger onChange if it's a string-only dropdown, 
    // otherwise wait for selection for object-based ones
    if (typeof options[0] === 'string') {
        onChange(e);
    }
  };

  const handleInputBlur = () => {
    // Call onComplete only if an option is not selected using onMouseDown
    if (!optionSelectedRef.current && onComplete && inputValue.trim() !== '') {
      onComplete(inputValue.trim());
    }

    // Reset the ref
    optionSelectedRef.current = false;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  };

  const selectOption = (option) => {
    setSelectedOption(option);
    const displayValue = typeof option === 'string' ? option : option.label;
    setInputValue(displayValue);
    setIsOpen(false);
    
    const finalValue = typeof option === 'string' ? option : option.value;
    let e = { target: { name: name, value: finalValue, option: option } };
    onChange(e);
  
    // Triggering blur if name is provided
    if (name) {
      const inputElement = document.querySelector(`input[name=${name}]`);
      if (inputElement) {
        inputElement.blur();
      }
    }
  };

  const filteredOptions = filterOptions();

  const closeDropdown = (e) => {
    if (inputRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) {
      return;
    }
    setIsOpen(false);
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
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
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
              {typeof option === 'string' ? option : option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchableDropdown;
