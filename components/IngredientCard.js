import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';
import Modal from 'react-modal';
import { IngredientSearchList } from './IngredientSearchList'

function ingredientCard({ ingredient, essential }) {
    const [ingredientData, setIngredientData] = useState(ingredient);
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")
    // const [availableOptionalColumns, setAvailableOptionalColumns] = useState(availableColumns)




    return (
        <div>
            <Row key={ingredient.id} className={styles.Row} style={{ filter: ingredient.complete ? 'grayscale(100%)' : 'none' }} name="bought">
                <Col className={styles.col}>
                    <input
                        type="checkbox"
                        checked={ingredient.complete}
                        value={ingredient.complete}
                        onChange={() => handleCheckboxChange(ingred)}
                    />
                </Col>
                <Col className={styles.col} name="amount">
                    <div>
                        {ingredient.quantity + " " + ingredient.quantity_type}
                    </div>
                </Col>




                {
                    ingredient.options[0] !== undefined ?
                        <>
                            <Col className={[styles.col, styles.curvedEdge]} style={{ background: "#1C2640", "color": "white" }} name="Search Term">
                                <div onClick={() => openModal(ingredient.name)}>
                                    {ingredient.complete ? <del>{ingredient.name}</del> : <div style={{ "font-size": "2em" }}>{ingredient.name}</div>}
                                </div>
                            </Col>
                            {
                                essential ? <></> : <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }} name="Product">{ingredient.options[0].name}</Col>
                            }
                            {
                                essential ? <></>
                                    :
                                    <Col className={styles.col} name="Source">
                                        <a onClick={ingredient.source ? () => console.log("nothing") : () => alert("hi there")}>
                                            <img style={{ maxWidth: "40%", borderRadius: "15%" }} src={`/${ingredient.options[0].source ? `${ingredient.options[0].source}.png` : "broken.svg"}`} />
                                        </a>
                                    </Col>
                            }
                            {ingredient.openFilter ? <></> : <></>}

                            <Col className={styles.col} name="category">{(ingredient.category)}
                                {
                                    ingredient.category ? <img src={`/categories/${ingredient.category.replace(/\s/g, '')}.png`} style={{ "maxWidth": "40%" }} /> : <></>
                                }
                            </Col>
                            {
                                essential ? <></>
                                    :
                                    <Col className={styles.col}>{(ingredient.options[0].unit_price * ingredient.quantity).toFixed(2)}</Col>
                            }



                            {/* <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingredient.options[0]._id, ingredient.name)}>x</Button></Col>

                            <Col className={styles.col}><Button variant="danger" onClick={(e) => handleDeleteItem(e, ingredient._id)}>x</Button></Col>
 */}


                        </>
                        :
                        <>
                            <Col className={[styles.col, styles.curvedEdge]} style={{ background: "#1C2640", "color": "white" }}>
                                <div onClick={() => openModal(ingredient.name)}>
                                    {ingredient.complete ? <del className={styles.bigtext}>{ingredient.name}</del> : <div style={{ "font-size": "2em" }}>{ingredient.name}</div>}
                                </div>
                            </Col>
                            {
                                essential ? <></> : <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }} name="Product">{ingredient.name}</Col>
                            }
                            {/* Change the below to an <object> instead of <img> to get animation working */}
                            {
                                essential ?
                                    <></>
                                    :
                                    ingredient.loading ? <Col className={styles.col}><div className={styles.lds_circle}><div></div></div></Col>
                                        :
                                        <Col className={styles.col}>
                                            <a onClick={ingredient.source ? () => console.log("nothing") : () => alert("hi there")}>
                                                <img style={{ maxWidth: "40%", borderRadius: "15%" }} src={`/cross.png`} />
                                                {/* <img style={{ "maxWidth": "32px", "borderRadius": "5px" }} src={`/${((ingredient.source)) ? ingredient.source : "cross"}.png`} /> */}
                                            </a>
                                        </Col>
                            }

                            <Col className={styles.col} name={"category"}>{(ingredient.category)}
                                {
                                    ingredient.category ? <img src={`/categories/${ingredient.category.replace(/\s/g, '')}.png`} style={{ "maxWidth": "40%" }} /> : <></>
                                }
                            </Col>
                            {
                                essential ? <></> : <Col className={styles.col}></Col>
                            }


                            <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingredient.options[0]._id, ingredient.name)}>x</Button></Col>


                            <Col className={styles.col}><Button variant="danger" onClick={(e) => handleDeleteItem(e, ingredient._id)}>x</Button></Col>






                        </>
                }





            </Row>
        </div>

    );
}



export default ingredientCard;
