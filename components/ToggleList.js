import React, { useState, useEffect, useRef } from 'react';
import { Dropdown, Form } from 'react-bootstrap';

const ToggleList = ({ inputList, onUpdateList, value, text = "Select Option" }) => {
  const [activeItems, setActiveItems] = useState(value);
  const checkboxRefs = useRef({});

  const toggleItem = (item) => {
    const updatedItems = [...activeItems];
    const index = updatedItems.indexOf(item);

    if (index === -1) {
      updatedItems.push(item);
    } else {
      updatedItems.splice(index, 1);
    }

    setActiveItems(updatedItems);
  };

  const handleItemClick = (item) => {
    toggleItem(item);
    checkboxRefs.current[item].click();
  };

  useEffect(() => {
    onUpdateList(activeItems);
  }, [activeItems, onUpdateList]);

  return (
    <div style={{ fontFamily: 'var(--receipt-font)' }}>

      <Dropdown>
        <Dropdown.Toggle variant="outline-dark" id="dropdown-basic" style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
          {text}
        </Dropdown.Toggle>
        <Dropdown.Menu style={{ padding: '0.5rem', border: '1px solid black', borderRadius: '0' }}>
          {inputList.map((item) => (
            <Dropdown.Item key={item} onClick={() => handleItemClick(item)} style={{ padding: '0.2rem 1rem' }}>
              <label style={{ cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center' }}>
                <Form.Check
                  type="checkbox"
                  label={item.toUpperCase()}
                  checked={activeItems.includes(item)}
                  onChange={() => { }}
                  ref={(el) => (checkboxRefs.current[item] = el)}
                  style={{ accentColor: 'black' }}
                />
              </label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default ToggleList;
