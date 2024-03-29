import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';
import Modal from 'react-modal';
import { IngredientCard } from './IngredientCard'

function IngredientListComp({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName, sortFunction}) {
  const [ingredientData, setIngredientData] = useState(ingredients);
  const [modalIsOpen, setIsOpen] = useState(false);
  const [selectedIngred, setSelectedIngred] = useState("")
  const [availableOptionalColumns, setAvailableOptionalColumns] = useState(availableColumns)
  const [essential, setEssential] = useState(true)

  function toggleEssentials() {
    setEssential(!essential)
    if (essential){
      setIngredientData(sortIngredients(ingredients));
    } else {
      setIngredientData(sortIngredientsSimple(ingredients));
    }
  }

  function sortIngredientsSimple(ingredientList) {
    let sortedIngreds = ingredientList
    sortedIngreds.sort((a, b) => {
      // Check if one item is complete and the other is not
      if (a.complete && !b.complete) return 1;
      if (!a.complete && b.complete) return -1;

      // for for
      

      // Extract "source" from the first option (if available)
      const sourceA = a.category ? a.category.toLowerCase() : '';
      const sourceB = b.category ? b.category.toLowerCase() : '';

      // Compare based on "source" property
      if (sourceA < sourceB) return -1;
      if (sourceA > sourceB) return 1;

      // If "source" properties are equal and both items are complete or incomplete, maintain current order
      const searchTermA = a.name ? a.name.toLowerCase() : '';
      const searchTermB = b.name ? b.name.toLowerCase() : '';

      if (searchTermA < searchTermB) return -1;
      if (searchTermA > searchTermB) return 1;

      return 0;
    });

    return sortedIngreds

  }

  function sortIngredients(ingredientList) {
    let sortedIngreds = ingredientList
    sortedIngreds.sort((a, b) => {
      // Check if one item is complete and the other is not
      if (a.complete && !b.complete) return 1;
      if (!a.complete && b.complete) return -1;

      // for for

      // Extract "source" from the first option (if available)
      const sourceA = a.options.length > 0 ? a.options[0].source.toLowerCase() : '';
      const sourceB = b.options.length > 0 ? b.options[0].source.toLowerCase() : '';

      // Compare based on "source" property
      if (sourceA < sourceB) return -1;
      if (sourceA > sourceB) return 1;

      const catA = a.category ? a.category.toLowerCase() : '';
      const catB = b.category ? b.category.toLowerCase() : '';

      // Compare based on "source" property
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      const searchTermA = a.name ? a.name.toLowerCase() : '';
      const searchTermB = b.name ? b.name.toLowerCase() : '';

      if (searchTermA < searchTermB) return -1;
      if (searchTermA > searchTermB) return 1;


      // If "source" properties are equal and both items are complete or incomplete, maintain current order
      return 0;
    });

    return sortedIngreds

  }

  async function openModal(ingredName) {
    setIsOpen(true);
    setSelectedIngred(ingredName)
  }

  async function closeModal() {
    setIsOpen(false);
  }

  const customStyles = {
    content: {
      "backgroundColor": "grey"
    }
  }



  const markAsIncorrect = async function (ingredientId, ingredName) {
    let data = await (await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + localStorage.getItem('Token'), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
      })
    })).json()
    console.log(data)
    if (data.success === false || data.success === undefined) {
      if (data.message !== undefined) {
        alert(data.message)
      } else {
        alert("failed, unexpected error")
      }

    } else {
      // Ran successfully
      console.log("RELAODED")
      reload()
    }
  }

  useEffect(() => {
    if (sortFunction === undefined) {
      setIngredientData(sortIngredientsSimple(ingredients));
    } else {
      sortFunction(ingredients)
    }
    
  }, [ingredients]);




  const calculateTotalOfList = () => {
    const total = ingredientData.map((ingred, index) => {
      if (ingred.options[0] !== undefined) {
        return ingred.options[0].unit_price * ingred.quantity;
      }
      return 0;
    });

    const sum = total.reduce((accumulator, currentValue) => accumulator + currentValue, 0);


    return sum.toFixed(2);
  };



  return (
    <div>

      <Row className={[styles.Row]} style={{ "backgroundColor": "grey" }}>


        {essential ?
          <>
           <Col className={styles.col}><strong>Bought</strong></Col>
            <Col className={styles.col}><strong>Amount</strong></Col>
            <Col className={styles.col}><strong>Search Term</strong></Col>
            <Col className={styles.col}><strong>Category</strong></Col>
            
          </>
          : <>
           <Col className={styles.col}><strong>Bought</strong></Col>
            <Col className={styles.col}><strong>Amount</strong></Col>
            <Col className={styles.col}><strong>Search Term</strong></Col>
            <Col className={styles.col}><strong>Product</strong></Col>
            <Col className={styles.col}><strong>Source</strong></Col>
            <Col className={styles.col}><strong>Category</strong></Col>
            <Col className={styles.col}><strong>Total Price</strong></Col>
          </>
        }

        {/* <Col className={styles.col}><strong>Unit Price</strong></Col> */}
        {
          modifyColumnName === "" ? <></> : <Col className={styles.col}><strong>{modifyColumnName}</strong></Col>
        }




      </Row>

      {ingredientData.map((ingred, index) => (
            <IngredientCard ingredient={ingred}></IngredientCard>
      ))}
      

    </div>
  );
}



export default IngredientListComp;
