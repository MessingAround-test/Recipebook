// CardListModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from 'react-bootstrap';
import { Col } from 'react-bootstrap';
import { getGroceryStoreProducts, handleDeleteIngredient } from '../lib/commonAPIs';

const IngredientDetailCard = ({ ingredient, show, onHide }) => {
  const [selectableOptions, setSelectableOptions] = useState([]);

  useEffect(() => {
    // You can add additional logic or API calls here if needed
  }, [ingredient, show]);

  const renderIngredientDetails = () => {
    // Iterate through each property in the ingredient object and display it
    return Object.entries(ingredient).map(([key, value]) => (
      <div key={key} className="mb-2">
        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
      </div>
    ));
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>More details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {renderIngredientDetails()}
      </Modal.Body>
      
    </Modal>
  );
};

export default IngredientDetailCard;
