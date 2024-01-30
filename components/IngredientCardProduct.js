import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-modal';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';
import { ProgressBar } from 'react-bootstrap';
import IngredientDetailCard from './IngredientDetailCard';
import { BsFillInfoCircleFill } from "react-icons/bs";

function IngredientCardProduct({ ingredient, handleDeleteIngredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, handleDelete, showSupplierImage = true }) {
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("");



    return (
        <div style={{ filter: ingredient.complete ? 'grayscale(100%)' : 'none' }}>
            <Row>
                {
                    showSupplierImage ?
                        <Col xs={12} className={styles.centered} style={{ marginBottom: '1rem' }}>
                            <img
                                style={{
                                    maxWidth: '10%',
                                    height: 'auto',
                                    borderRadius: '5px',
                                }}
                                src={`/${ingredient.source ? ingredient.source : 'cross'}.png`}
                                alt={ingredient.name}
                            />
                        </Col> : <></>
                }

                <Col xs={12} className={styles.centered} style={{ marginBottom: '0.5rem', 'color': 'white' }}>
                    {/* <BsFillInfoCircleFill onClick={() => setIsOpen(true)} /> */}
                    <IngredientDetailCard ingredient={ingredient} show={modalIsOpen} onHide={() => setIsOpen(false)}></IngredientDetailCard>
                    <div style={{ fontSize: '1rem' }} onClick={() => setIsOpen(true)}>{ingredient ? ingredient.name : ""}</div>
                </Col>
            </Row>
            <Row>


                {/* <Col xs={12} className={styles.centered} style={{ fontSize: '1.2rem', marginBottom: '0.5rem', 'color': 'white' }}>
                {`${ingredient.quantity} ${ingredient.quantity_unit} - $${(ingredient.unit_price * ingredient.quantity).toFixed(2)}`}
                </Col> */}
                <Col xs={12} className={styles.centered} style={{ fontSize: '1.2rem', marginBottom: '0.5rem', 'color': 'white' }}>
                    {`$${(ingredient.total_price).toFixed(2)}`}

                    {/* {JSON.stringify(ingredient)} */}
                </Col>
            </Row>



            <Row>
                <Col xs={12} className={styles.centered} style={{ fontSize: '1.2rem', marginBottom: '0.5rem', 'color': 'white' }}>
                    {ingredient !== undefined ? ingredient.match_efficiency < 100 ? <ProgressBar now={ingredient.match_efficiency} label={`${ingredient.match_efficiency}% efficiency`} variant="success" /> : <></> : <></>}
                </Col>
                {handleDeleteIngredient !== undefined ? <Col xs={12} className={styles.centered} style={{ fontSize: '1.2rem', marginBottom: '0.5rem', 'color': 'white' }}><Button onClick={() => handleDelete(handleDeleteIngredient(ingredient._id, localStorage.getItem('Token')))} variant={'warning'}>Delete</Button>
                </Col> : <></>}


            </Row>
        </div>

    );
}



export default IngredientCardProduct;
