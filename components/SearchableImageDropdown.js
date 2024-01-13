import React, { useState, useEffect, useRef } from 'react';
import { Col, Row } from 'react-bootstrap';
import styles from '../styles/SearchableDropdown.module.css'

function SearchableImageDropdown({ options, placeholder, onChange,name,value}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const dropdownRef = useRef(null);

  const filterOptions = () => {
    return options.filter((option) =>
      {
        if (inputValue=== undefined){
          return false
        }
        console.log(inputValue)
        if (!inputValue.name){
            return (option.name.toLowerCase().includes(""))    
        } else {
            return (option.name.toLowerCase().includes(inputValue.name.toLowerCase()))
        }
        
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
    if (dropdownRef.current === null) {
      setIsOpen(false);
      return;
    }
  
    // Check if the click occurred inside the input
    if (!dropdownRef.current.contains(e.target) && e.target !== document.querySelector(`input[name=${name}]`)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    // Use both click and touch events to close the dropdown
    setInputValue(value || '');
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
        onTouchStart={toggleDropdown} // Handle touch events
        placeholder={placeholder}
        className={styles.input}
        autoComplete="off"
      />
      {isOpen && (
        <ul className={styles['dropdown-list']} ref={dropdownRef}>
          {filteredOptions.map((option) => (
            <li
              key={option.id} // Assuming there's an 'id' property in the option
              onClick={() => selectOption(option)}
              className={option === selectedOption ? styles.selected : ''}
            >
              <Row>
                <Col>
                  <img
                    src={`/categories/${option.image}`}
                    alt={option.name} // Add alt attribute for accessibility
                    style={{ maxWidth: "48px" }}
                  />
                </Col>
                <Col>{option.name}</Col>
                <Col></Col>
              </Row>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchableImageDropdown;
