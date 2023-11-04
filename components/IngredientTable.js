import React, { useState } from 'react';

function IngredientTable({ ingredients }) {
  const [ingredientData, setIngredientData] = useState(ingredients);

  const handleCheckboxChange = (index) => {
    const updatedIngredients = [...ingredientData];
    updatedIngredients[index].bought = !updatedIngredients[index].bought;
    setIngredientData(updatedIngredients);
  };

  return (
    <div>
      <Row>
        <Col className={styles.col}><strong>Extract</strong></Col>
        <Col className={styles.col}><strong>Amount</strong></Col>
        <Col className={styles.col}><strong>Search Term</strong></Col>
        <Col className={styles.col}><strong>Source</strong></Col>
        <Col className={styles.col}><strong>Name</strong></Col>
        <Col className={styles.col}><strong>Not Right?</strong></Col>
        <Col className={styles.col}><strong>Price</strong></Col>
      </Row>

      {ingredientData.map((ingred, index) => (
        <Row key={index} style={{ filter: ingred.bought ? 'grayscale(100%)' : 'none' }}>
          <Col className={styles.col}>
            <input
              type="checkbox"
              checked={ingred.bought}
              onChange={() => handleCheckboxChange(index)}
            />
          </Col>
          <Col className={styles.col}>{ingred.Amount} {ingred.AmountType}</Col>
          <Col className={styles.col}>{ingred.search_term}</Col>
          <Col className={styles.col}>
            <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
              <img style={{ maxWidth: "32px", borderRadius: "5px" }} src={`/${ingred.source ? ingred.source : "cross"}.png`} />
            </a>
          </Col>
          <Col className={[styles.curvedEdge, styles.centered]} style={{ background: "grey" }}>
            <div onClick={() => openModal(ingred.name)}>
              {ingred.name}
            </div>
          </Col>
          <Col className={styles.col}>
            <Button variant="warning" onClick={(e) => markAsIncorrect(ingred._id, ingred.name)}>Not right?</Button>
          </Col>
          <Col className={styles.col}>
            ${ingred.price} / {ingred.quantity} {ingred.quantity_unit} = ${(ingred.unit_price * ingred.Amount).toFixed(2)}
          </Col>
        </Row>
      ))}
    </div>
  );
}

export default IngredientTable;
