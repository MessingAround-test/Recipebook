import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';
import Modal from 'react-modal';
import { IngredientSearchList } from './IngredientSearchList'
import IngredientCard from './IngredientCard'

function IngredientTable({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName, sortFunction, filters, enabledSuppliers=[] }) {
    const [ingredientData, setIngredientData] = useState(ingredients);
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")
    const [availableOptionalColumns, setAvailableOptionalColumns] = useState(availableColumns)
    const [essential, setEssential] = useState(true)


    function toggleEssentials() {
        setEssential(!essential)
        if (essential) {
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
            <Row xs={1} sm={2} md={2} l={4} xl={4}>

                {ingredientData.map((ingred, index) => (
                    <>
                        <IngredientCard ingredient={ingred} openModal={openModal} handleCheckboxChange={handleCheckboxChange} markAsIncorrect={markAsIncorrect} filters={filters} enabledSuppliers={enabledSuppliers}></IngredientCard>
                    </>

                ))}
            </Row>
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
                    <IngredientSearchList search_term={selectedIngred}></IngredientSearchList>
                </a>
            </Modal>
            {/* <h1>Total: ${calculateTotalOfList()}</h1> */}
            {/* <Button variant="primary" onClick={(e) => console.log(ingredientData)}>show state</Button> */}

            {/* <Button onClick={(e) => toggleEssentials()}>Hide Crap</Button> */}
        </div>
    );
}

IngredientTable.propTypes = {
    ingredients: PropTypes.array.isRequired,
};

export default IngredientTable;
