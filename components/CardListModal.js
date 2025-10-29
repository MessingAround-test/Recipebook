// CardListModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import IngredientCard from './IngredientCard';
import IngredientCardProduct from './IngredientCardProduct';
import { Col } from 'react-bootstrap';
import { getGroceryStoreProducts, handleDeleteIngredient } from '../lib/commonAPIs';
const CardListModal = ({ ingredient, show, onHide, filters, enabledSuppliers=[] }) => {
  const [selectableOptions, setselectableOptions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (ingredient && show === true) {
          // Assuming getGroceryStoreProducts is an asynchronous function
          console.log(filters)
          const response = await getGroceryStoreProducts(ingredient, 5, enabledSuppliers, localStorage.getItem('Token'));
          const resOptions = response.options;
          console.log(resOptions);
          setselectableOptions(resOptions);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData(); // Call the async function directly

  }, [ingredient, show]);

  const handleDelete = async (id_promise) => {
    // Find the index of the object with the matching _id
    const id = await id_promise
    const indexToDelete = selectableOptions.findIndex(option => option._id === id);

    // Make a copy of the array and remove the object at the found index
    const updatedSelectableOptions = [...selectableOptions];
    if (indexToDelete !== -1) {
      updatedSelectableOptions.splice(indexToDelete, 1);
      setselectableOptions(updatedSelectableOptions);

      // Fire API request after a card is deleted
      // Example: fireApiRequest();
    } else {
      console.error(`Object with _id ${id} not found in selectableOptions`);
    }
  };

  const handleSelect = () => {
    // Check if any selectableOptions are left
    if (selectableOptions.length > 0) {
      // Check if the selected option is at the top
      const selectedOption = selectableOptions[0];
      // Perform any action based on the selected option

      // Close the modal
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Alternative Options</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Please delete Options until a valid one is first
        <div className="card-list">
          {selectableOptions.map((option, index) => (
            <Col
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                margin: '0.2rem 0',
                padding: '1rem',
                backgroundColor: '#171f34',
              }}
            >
              <IngredientCardProduct ingredient={option} handleDeleteIngredient={handleDeleteIngredient} handleDelete={handleDelete} filters={filters}></IngredientCardProduct>
              {/* {index} {option} */}
              {/* <IngredientCard ingredient={selectableOptions[index]} modalVersion={true} filters={filters}></IngredientCard> */}
            </Col>
            // <Card key={index} option={option} onSwipe={() => handleSwipe(index)} />
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default CardListModal;
