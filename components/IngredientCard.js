import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-modal';
import styles from '../styles/Home.module.css';
import { IngredientSearchList } from './IngredientSearchList';
import { Card, ProgressBar } from 'react-bootstrap';
import CardListModal from './CardListModal';
import IngredientCardProduct from './IngredientCardProduct';


function IngredientCard({ ingredient, essential, openModal, handleCheckboxChange, markAsIncorrect, filters, modalVersion, enabledSuppliers = [] }) {
    const [otherOptionsModalIsOpen, setOtherOptionsModalIsOpen] = useState(false);
    const [moreInfoModalIsOpen, setMoreInfoModalIsOpen] = useState(false)
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
                    {handleCheckboxChange !== undefined ? <Col xs={2} className={styles.centered_vertical}>
                        <input
                            type="checkbox"
                            checked={ingredient.complete}
                            value={ingredient.complete}
                            onChange={() => handleCheckboxChange(ingredient)}
                            style={{ width: '2rem', height: '2rem' }}
                        />

                    </Col> : <></>
                    }

                    <Col className={styles.centered}>

                        <div onClick={() => openModal(ingredient.name)} style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                            {`${ingredient.name} - ${ingredient.quantity} ${ingredient.quantity_type}`}
                        </div>




                        {/* <Col>
                            {
                                ingredient.category ? <img src={`/categories/${ingredient.category.replace(/\s/g, '')}.png`} style={{ "maxWidth": "40%" }} /> : <></>
                            }
                        </Col>  */}

                        {ingredient.loading ? <div className={styles.lds_circle}><div></div></div> : <></>}
                        {/* {ingredient.options[0] !== undefined && ( */}
                        {ingredient.options[0] !== undefined && filters.includes("supplier") && (
                            <>
                                <IngredientCardProduct ingredient={ingredient.options[0]} showSupplierImage={false}></IngredientCardProduct>
                                <Button onClick={() => setOtherOptionsModalIsOpen(true)} variant={'warning'}>Other Options</Button>
                                {/* <BsFillInfoCircleFill onClick={()=>setMoreInfoModalIsOpen(true)}/> */}

                                {/* <Button  variant={'info'}><BsFillInfoCircleFill /></Button> */}
                                <CardListModal filters={filters} ingredient={ingredient} show={otherOptionsModalIsOpen} onHide={() => setOtherOptionsModalIsOpen(false)} enabledSuppliers={enabledSuppliers}></CardListModal>
                                {/* <IngredientDetailCard ingredient={ingredient} show={moreInfoModalIsOpen} onHide={()=>setMoreInfoModalIsOpen(false)}></IngredientDetailCard> */}
                            </>
                        )}
                    </Col>
                </Row>
            </Col >
        </div >
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
