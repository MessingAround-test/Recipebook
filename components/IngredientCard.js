import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-modal';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';

function IngredientCard({ ingredient, essential, openModal, handleCheckboxChange, markAsIncorrect }) {
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("");


    return (
        <div style={{ filter: ingredient.complete ? 'grayscale(100%)' : 'none' }}>
            <Col
                key={ingredient._id}
                style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    margin: '0.2rem 0',
                    padding: '1rem',
                    backgroundColor: '#171f34',
                }}
            >
                <Row>
                    <Col xs={2} className={styles.centered_vertical}>

                        <input
                            type="checkbox"
                            checked={ingredient.complete}
                            value={ingredient.complete}
                            onChange={() => handleCheckboxChange(ingredient)}
                            style={{ width: '2rem', height: '2rem' }}
                        />

                    </Col>
                    <Col>

                        <div onClick={() => openModal(ingredient.name)} style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {`${ingredient.name} - ${ingredient.quantity} ${ingredient.quantity_type}`}
                        </div>




                        {
                            ingredient.category ? <></> : <></>
                        }
                        {ingredient.loading ? <div className={styles.lds_circle}><div></div></div> : <></>}
                        {ingredient.options[0] !== undefined && (
                            <>
                                <Row>

                                    <Col xs={12} className={styles.centered} style={{ marginBottom: '1rem' }}>
                                        <img
                                            style={{
                                                maxWidth: '10%',
                                                height: 'auto',
                                                borderRadius: '5px',
                                            }}
                                            src={`/${ingredient.options[0].source ? ingredient.options[0].source : 'cross'}.png`}
                                            alt={ingredient.options[0].name}
                                        />
                                    </Col>
                                    <Col xs={12} className={styles.centered} style={{ marginBottom: '0.5rem' }}>
                                        <div style={{ fontSize: '1rem' }}>{ingredient.options[0] ? ingredient.options[0].name : ""}</div>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col xs={12} className={styles.centered} style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                        {ingredient.options[0] !== undefined ? `$${(ingredient.options[0].unit_price * ingredient.quantity).toFixed(2)}` : `${ingredient.quantity} ${ingredient.quantity_type}`}
                                        {/* `${ingredient.options[0].price} ${ingredient.options[0].quantity_type} - $${(ingredient.options[0].unit_price * ingredient.quantity).toFixed(2)}` : `${ingredient.quantity} ${ingredient.quantity_type}` */}
                                    </Col>
                                </Row>
                                <Row>
                                    <Col xs={12} className={styles.centered}>
                                        <Button variant="warning" onClick={(e) => markAsIncorrect(ingredient.options[0]._id, ingredient.name)}>
                                            Wrong Product
                                        </Button>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </Col>
                </Row>
            </Col>
        </div>
    );
}

IngredientCard.propTypes = {
    ingredient: PropTypes.object.isRequired,
    essential: PropTypes.bool.isRequired,
    openModal: PropTypes.func.isRequired,
    handleCheckboxChange: PropTypes.func.isRequired,
    markAsIncorrect: PropTypes.func.isRequired,
};

export default IngredientCard;
