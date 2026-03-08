import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import Modal from 'react-modal';
import { IngredientSearchList } from './IngredientSearchList'
import IngredientCard from './IngredientCard'

function IngredientTable({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName, sortFunction, filters, enabledSuppliers = [] }) {
    const [ingredientData, setIngredientData] = useState(ingredients);
    const [modalIsOpen, setIsOpen] = useState(false);
    const [selectedIngred, setSelectedIngred] = useState("")

    function sortIngredientsSimple(ingredientList) {
        let sortedIngreds = [...ingredientList]
        sortedIngreds.sort((a, b) => {
            if (a.complete && !b.complete) return 1;
            if (!a.complete && b.complete) return -1;
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
            "backgroundColor": "#fdfaf0",
            "border": "2px solid black",
            "borderRadius": "0"
        }
    }

    const markAsIncorrect = async function (ingredientId, ingredName) {
        let data = await (await fetch("/api/Ingredients/?id=" + ingredientId + "&EDGEtoken=" + localStorage.getItem('Token'), {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })).json()
        if (data.success) {
            reload()
        } else {
            alert(data.message || "failed, unexpected error")
        }
    }

    useEffect(() => {
        if (sortFunction === undefined) {
            setIngredientData(sortIngredientsSimple(ingredients));
        } else {
            sortFunction(ingredients)
        }
    }, [ingredients, sortFunction]);

    return (
        <div className="w-full">
            <div className="flex-col gap-0">
                {ingredientData.map((ingred, index) => (
                    <IngredientCard
                        key={ingred._id || index}
                        ingredient={ingred}
                        openModal={openModal}
                        handleCheckboxChange={handleCheckboxChange}
                        markAsIncorrect={markAsIncorrect}
                        filters={filters}
                        enabledSuppliers={enabledSuppliers}
                    />
                ))}
            </div>

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                style={customStyles}
                contentLabel="Ingredient Research"
                className={styles.modal}
            >
                <div className="flex-col">
                    <button
                        style={{ alignSelf: "flex-end", background: "none", border: "none", cursor: "pointer" }}
                        onClick={closeModal}
                    >
                        <img style={{ "maxWidth": "32px", "maxHeight": "32px" }} src={"/cross.png"} alt="close"></img>
                    </button>
                    <h2 className="uppercase bold text-center mb-3">Ingredient Research</h2>
                    <IngredientSearchList search_term={selectedIngred}></IngredientSearchList>
                </div>
            </Modal>
        </div>
    );
}

IngredientTable.propTypes = {
    ingredients: PropTypes.array.isRequired,
};

export default IngredientTable;
