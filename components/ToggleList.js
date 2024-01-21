import React, { useState, useEffect, useRef } from 'react';
import { Dropdown, Form } from 'react-bootstrap';

const ToggleList = ({ inputList, onUpdateList, value, text= "Select Option" }) => {
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
    <div>
      
      <Dropdown>
        <Dropdown.Toggle variant="success" id="dropdown-basic">
          {text}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {inputList.map((item) => (
            <Dropdown.Item key={item} onClick={() => handleItemClick(item)}>
              <label>
                <Form.Check
                  type="checkbox"
                  label={item}
                  checked={activeItems.includes(item)}
                  onChange={() => {}}
                  ref={(el) => (checkboxRefs.current[item] = el)}
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
