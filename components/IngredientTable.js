import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';
import Modal from 'react-modal';
import { IngredientList } from './IngredientList'

function IngredientTable({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName }) {
  const [ingredientData, setIngredientData] = useState(ingredients);
  const [modalIsOpen, setIsOpen] = useState(false);
  const [selectedIngred, setSelectedIngred] = useState("")
  const [availableOptionalColumns, setAvailableOptionalColumns] = useState(availableColumns)

  function sortIngredients(ingredientList) {
    let sortedIngreds = ingredientList
    sortedIngreds.sort((a, b) => {
      // Check if one item is complete and the other is not
      if (a.complete && !b.complete) return 1;
      if (!a.complete && b.complete) return -1;

      // Extract "source" from the first option (if available)
      const sourceA = a.options.length > 0 ? a.options[0].source.toLowerCase() : '';
      const sourceB = b.options.length > 0 ? b.options[0].source.toLowerCase() : '';

      // Compare based on "source" property
      if (sourceA < sourceB) return -1;
      if (sourceA > sourceB) return 1;

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
    var data = await (await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + localStorage.getItem('Token'), {
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
    setIngredientData(sortIngredients(ingredients));
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
      <Row className={styles.Row}>

        <Col className={styles.col}><strong>Bought</strong></Col>
        <Col className={styles.col}><strong>Amount</strong></Col>
        <Col className={styles.col}><strong>Search Term</strong></Col>
        <Col className={styles.col}><strong>Product</strong></Col>
        <Col className={styles.col}><strong>Source</strong></Col>

        <Col className={styles.col}><strong>Total Price</strong></Col>

        {/* <Col className={styles.col}><strong>Unit Price</strong></Col> */}
        {
          modifyColumnName===""?<></>:<Col className={styles.col}><strong>{modifyColumnName}</strong></Col>
        }
        
        
        

      </Row>

      {ingredientData.map((ingred, index) => (
        <Row key={index} className={styles.Row} style={{ filter: ingred.complete ? 'grayscale(100%)' : 'none' }}>
          <Col className={styles.col}>
            <input
              type="checkbox"
              checked={ingred.complete}
              value={ingred.complete}
              onChange={() => handleCheckboxChange(ingred)}
            />
          </Col>
          <Col className={styles.col}>
            <div>
              {ingred.quantity + " " + ingred.quantity_type}
            </div>
          </Col>



          {
            ingred.options[0] !== undefined ?
              <>

                <Col className={[styles.col, styles.curvedEdge]} style={{ background: "#1C2640", "color": "white" }}>
                  <div onClick={() => openModal(ingred.name)}>
                    {ingred.complete ? <del>{ingred.name}</del> : ingred.name}
                  </div>
                </Col>
                <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }}>{ingred.options[0].name}</Col>
                <Col className={styles.col}>
                  <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                    <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/${ingred.options[0].source ? `${ingred.options[0].source}.png` : "loading.svg"}`} />

                  </a>
                </Col>
                <Col className={styles.col}>{(ingred.options[0].unit_price * ingred.quantity).toFixed(2)}</Col>
                {/* <Col className={styles.col}>{ingred.options[0].unit_price}</Col> */}
                
                {
                  modifyColumnName==="Incorrect"?
                  <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingred.options[0]._id, ingred.name)}>x</Button></Col>
                  :
                  modifyColumnName==="Remove"?
                  <Col className={styles.col}><Button variant="danger" onClick={(e) => handleDeleteItem(e, ingred._id)}>x</Button></Col>
                  :
                  <></>
                  
                }
                
                {/*  */}

              </>
              :
              <>
                <Col className={[styles.col, styles.curvedEdge]} style={{ background: "#1C2640", "color": "white" }}>
                  <div onClick={() => openModal(ingred.name)}>
                    {ingred.complete ? <del>{ingred.name}</del> : ingred.name}
                  </div>
                </Col>
                <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }}>{ingred.name}</Col>
                {ingred.loading ? <Col className={styles.col}><object type="image/svg+xml" data="/loading.svg"></object> </Col> 
                : 
                <Col className={styles.col}>
                  <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                    <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/cross.png`} />
                    {/* <img style={{ "maxWidth": "32px", "borderRadius": "5px" }} src={`/${((ingred.source)) ? ingred.source : "cross"}.png`} /> */}
                  </a>
                </Col>
                }
                

                <Col className={styles.col}></Col>
                {
                  modifyColumnName==="Incorrect"?
                  <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingred.options[0]._id, ingred.name)}>x</Button></Col>
                  :
                  modifyColumnName==="Remove"?
                  <Col className={styles.col}><Button variant="danger" onClick={(e) => handleDeleteItem(e, ingred._id)}>x</Button></Col>
                  :
                  <></>
                  
                }
                


              

              </>
          }
          

          {/* {ingred.loading ?
            
            :<Col className={styles.col}></Col>
            } */}


        </Row>

      ))}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="Example Modal"
        className={styles.modal}
      >
        <a>
          <button style={{ float: "right", "borderRadius": "5px" }} onClick={closeModal}><img style={{ "maxWidth": "32px", "maxHeight": "32px" }} src={"/cross.png"}></img></button>
          <h2>Ingredient Research</h2>
          <IngredientList search_term={selectedIngred}></IngredientList>
        </a>
      </Modal>
      <h1>Total: ${calculateTotalOfList()}</h1>
      {/* <Button variant="primary" onClick={(e) => console.log(ingredientData)}>show state</Button> */}
    </div>
  );
}

IngredientTable.propTypes = {
  ingredients: PropTypes.array.isRequired,
};

export default IngredientTable;
