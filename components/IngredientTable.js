import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';

function IngredientTable({ ingredients, handleCheckboxChange, reload }) {
  const [ingredientData, setIngredientData] = useState(ingredients);

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
      reload()
    }
  }

  useEffect(() => {
    setIngredientData(ingredients);
  }, [ingredients]);



  return (
    <div>
      <Row>
        <Col className={styles.col}><strong>Bought</strong></Col>
        <Col className={styles.col}><strong>Amount</strong></Col>
        <Col className={styles.col}><strong>Product</strong></Col>
        <Col className={styles.col}><strong>Source</strong></Col>
        <Col className={styles.col}><strong>Search Term</strong></Col>
        <Col className={styles.col}><strong>Price</strong></Col>
        <Col className={styles.col}><strong>Unit Price</strong></Col>
        <Col className={styles.col}><strong>Not Right?</strong></Col>
      </Row>

      {ingredientData.map((ingred, index) => (
        <Row key={index} style={{ filter: ingred.bought ? 'grayscale(100%)' : 'none' }}>
          <Col className={styles.col}>
            <input
              type="checkbox"
              checked={ingred.bought}
              value={ingred.bought}
              onChange={() => handleCheckboxChange(index)}
            />
          </Col>
          <Col className={styles.col}>{ingred.quantity} {ingred.quantity_type}</Col>
          {ingred.options[0] !== undefined
            ?
            <Col className={styles.col}>{ingred.options[0].name}</Col>
            :
            <Col className={styles.col}></Col>
          }


          {
            ingred.options[0] !== undefined ?
              <>
                <Col className={styles.col}>
                  <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                    <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/${ingred.options[0].source ? `${ingred.options[0].source}.png` : "loading.svg"}`} />
                  </a>
                </Col>
                <Col className={[styles.curvedEdge, styles.centered]} style={{ background: "grey" }}>
                  <div onClick={() => openModal(ingred.name)}>
                    {ingred.bought ? <del>{ingred.name}</del> : ingred.name}
                  </div>
                </Col>
                <Col className={styles.col}>{(ingred.options[0].unit_price * ingred.quantity).toFixed(2)}</Col>
                <Col className={styles.col}>{ingred.options[0].unit_price}</Col>
                <Col className={styles.col}>
                  <Button variant="warning" onClick={(e) => markAsIncorrect(ingred.options[0]._id, ingred.name)}>Not right?</Button>
                </Col>
              </>
              :
              <>
                <Col className={styles.col}>
                  <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                    <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/${ingred.source ? `${ingred.source}.png` : "loading.svg"}`} />
                  </a>
                </Col>
                <Col className={[styles.curvedEdge, styles.centered]} style={{ background: "grey" }}>
                  <div onClick={() => openModal(ingred.name)}>
                    {ingred.bought ? <del>{ingred.name}</del> : ingred.name}
                  </div>
                </Col>
                <Col className={styles.col}></Col>
                <Col className={styles.col}></Col>
                <Col className={styles.col}>No match found</Col>
              </>
          }

        </Row>
      ))}
    </div>
  );
}

IngredientTable.propTypes = {
  ingredients: PropTypes.array.isRequired,
};

export default IngredientTable;
