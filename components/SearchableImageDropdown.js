import React, { useState, useEffect, useRef } from 'react';
import { Col, Row } from 'react-bootstrap';
import styles from '../styles/SearchableDropdown.module.css'

function SearchableImageDropdown({ options, placeholder, onChange,name,value}) {
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
        console.log(inputValue)
        if (!inputValue.name){
            return (option.name.toLowerCase().includes(inputValue.toLowerCase()))    
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
    document.addEventListener('click', closeDropdown);
    document.addEventListener('touchstart', closeDropdown);

    return () => {
      document.removeEventListener('click', closeDropdown);
      document.removeEventListener('touchstart', closeDropdown);
    };
  }, []);

  
  return (
    <div className={styles['searchable-dropdown']}>
      <input
        type="text"
        value={inputValue?inputValue.name:undefined}
        onChange={handleInputChange}
        name={name}
        onClick={toggleDropdown}
        placeholder={placeholder}
        className={styles.input}
        onTouchStart={toggleDropdown}
        autocomplete="off"
      />
      {isOpen && (
        <ul className={styles['dropdown-list']} ref={dropdownRef}>
          {filteredOptions.map((option, index) => (
            <>
            
            <li
              key={index}
              onClick={(e) => selectOption(option)}
              className={
                option === selectedOption
                  ? styles.selected
                  : ''
              }
            >
                <Row>
                <Col>
                <img src={`/categories/${option.image}`} style={{"maxWidth": "48px"}}></img>
                </Col>
                <Col>
              {option.name}
              </Col>
              <Col></Col>
              </Row>
            </li>
            </>
          ))}
        </ul>
      )}
    </div>
  );

}

export default SearchableImageDropdown;
