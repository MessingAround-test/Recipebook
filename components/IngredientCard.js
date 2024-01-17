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
    const [availableOptionalColumns, setAvailableOptionalColumns] = useState(availableColumns)
    



    return (
        <div>
HI AGAIN
            <Row key={index} className={styles.Row} style={{ filter: ingred.complete ? 'grayscale(100%)' : 'none' }} name="bought">
                <Col className={styles.col}>
                    <input
                        type="checkbox"
                        checked={ingred.complete}
                        value={ingred.complete}
                        onChange={() => handleCheckboxChange(ingred)}
                    />
                </Col>
                <Col className={styles.col} name="amount">
                    <div>
                        {ingred.quantity + " " + ingred.quantity_type}
                    </div>
                </Col>




                {
                    ingred.options[0] !== undefined ?
                        <>
                            <Col className={[styles.col, styles.curvedEdge]} style={{ background: "#1C2640", "color": "white" }} name="Search Term">
                                <div onClick={() => openModal(ingred.name)}>
                                    {ingred.complete ? <del>{ingred.name}</del> : <div style={{ "font-size": "2em" }}>{ingred.name}</div>}
                                </div>
                            </Col>
                            {
                                essential ? <></> : <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }} name="Product">{ingred.options[0].name}</Col>
                            }
                            {
                                essential ? <></>
                                    :
                                    <Col className={styles.col} name="Source">
                                        <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                                            <img style={{ maxWidth: "40%", borderRadius: "15%" }} src={`/${ingred.options[0].source ? `${ingred.options[0].source}.png` : "broken.svg"}`} />
                                        </a>
                                    </Col>
                            }
                            {ingred.openFilter ? <></> : <></>}

                            <Col className={styles.col} name="category">{(ingred.category)}
                                {
                                    ingred.category ? <img src={`/categories/${ingred.category.replace(/\s/g, '')}.png`} style={{ "maxWidth": "40%" }} /> : <></>
                                }
                            </Col>
                            {
                                essential ? <></>
                                    :
                                    <Col className={styles.col}>{(ingred.options[0].unit_price * ingred.quantity).toFixed(2)}</Col>
                            }
                            {/* <Col className={styles.col}>{ingred.options[0].unit_price}</Col> */}

                            {
                                modifyColumnName === "Incorrect" ?
                                    <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingred.options[0]._id, ingred.name)}>x</Button></Col>
                                    :
                                    modifyColumnName === "Remove" ?
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
                                    {ingred.complete ? <del className={styles.bigtext}>{ingred.name}</del> : <div style={{ "font-size": "2em" }}>{ingred.name}</div>}
                                </div>
                            </Col>
                            {
                                essential ? <></> : <Col className={[styles.col, styles.curvedEdge]} style={{ background: "" }} name="Product">{ingred.name}</Col>
                            }
                            {/* Change the below to an <object> instead of <img> to get animation working */}
                            {
                                essential ?
                                    <></>
                                    :
                                    ingred.loading ? <Col className={styles.col}><div className={styles.lds_circle}><div></div></div></Col>
                                        :
                                        <Col className={styles.col}>
                                            <a onClick={ingred.source ? () => console.log("nothing") : () => alert("hi there")}>
                                                <img style={{ maxWidth: "40%", borderRadius: "15%" }} src={`/cross.png`} />
                                                {/* <img style={{ "maxWidth": "32px", "borderRadius": "5px" }} src={`/${((ingred.source)) ? ingred.source : "cross"}.png`} /> */}
                                            </a>
                                        </Col>
                            }

                            <Col className={styles.col} name={"category"}>{(ingred.category)}
                                {
                                    ingred.category ? <img src={`/categories/${ingred.category.replace(/\s/g, '')}.png`} style={{ "maxWidth": "40%" }} /> : <></>
                                }
                            </Col>
                            {
                                essential ? <></> : <Col className={styles.col}></Col>
                            }

                            {
                                modifyColumnName === "Incorrect" ?
                                    <Col className={styles.col}><Button variant="warning" onClick={(e) => markAsIncorrect(ingred.options[0]._id, ingred.name)}>x</Button></Col>
                                    :
                                    modifyColumnName === "Remove" ?
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
        </div>

    );
}



export default ingredientCard;
