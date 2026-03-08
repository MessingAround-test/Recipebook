import React, { useState, useEffect } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css';
import { Button } from 'react-bootstrap';
import Modal from 'react-modal';
import { IngredientSearchList } from './IngredientSearchList'

function IngredientTable({ ingredients, handleCheckboxChange, reload, availableColumns, handleDeleteItem, modifyColumnName, sortFunction }) {
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

      // for for


      // Extract "source" from the first option (if available)
      const sourceA = a.category ? a.category.toLowerCase() : '';
      const sourceB = b.category ? b.category.toLowerCase() : '';

      // Compare based on "source" property
      if (sourceA < sourceB) return -1;
      if (sourceA > sourceB) return 1;

      // If "source" properties are equal and both items are complete or incomplete, maintain current order
      const searchTermA = a.name ? a.name.toLowerCase() : '';
      const searchTermB = b.name ? b.name.toLowerCase() : '';

      if (searchTermA < searchTermB) return -1;
      if (searchTermA > searchTermB) return 1;

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

      // Extract "source" from the first option (if available)
      const sourceA = a.options.length > 0 ? a.options[0].source.toLowerCase() : '';
      const sourceB = b.options.length > 0 ? b.options[0].source.toLowerCase() : '';

      // Compare based on "source" property
      if (sourceA < sourceB) return -1;
      if (sourceA > sourceB) return 1;

      const catA = a.category ? a.category.toLowerCase() : '';
      const catB = b.category ? b.category.toLowerCase() : '';

      // Compare based on "source" property
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      const searchTermA = a.name ? a.name.toLowerCase() : '';
      const searchTermB = b.name ? b.name.toLowerCase() : '';

      if (searchTermA < searchTermB) return -1;
      if (searchTermA > searchTermB) return 1;


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
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--glass-border)',
      borderRadius: '1.5rem',
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      inset: '40px',
      overflow: 'auto',
      backdropFilter: 'var(--glass-blur)',
      background: 'var(--bg-card)'
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 2000
    }
  }

  return (
    <div className="flex-col gap-4">
      <div className="glass-card p-0 overflow-hidden" style={{ border: 'none', background: 'transparent' }}>
        <Row className="align-center mb-4 p-2" style={{ background: 'var(--bg-secondary)', borderRadius: '0.5rem', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Col xs={1} className="text-center">Bought</Col>
          <Col xs={2}>Amount</Col>
          <Col xs={essential ? 6 : 3}>Search Term</Col>
          {essential ? (
            <Col xs={3}>Category</Col>
          ) : (
            <>
              <Col xs={2}>Product</Col>
              <Col xs={1} className="text-center">Source</Col>
              <Col xs={2}>Category</Col>
              <Col xs={1}>Total</Col>
            </>
          )}
          {modifyColumnName && <Col xs={1} className="text-center">{modifyColumnName}</Col>}
        </Row>

        {ingredientData.map((ingred, index) => (
          <div key={index} className="mb-3">
            <Row
              className="align-center glass-card p-3"
              style={{
                margin: 0,
                opacity: ingred.complete ? 0.6 : 1,
                filter: ingred.complete ? 'grayscale(0.8)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              <Col xs={1} className="text-center">
                <input
                  type="checkbox"
                  checked={ingred.complete}
                  onChange={() => handleCheckboxChange(ingred)}
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                />
              </Col>

              <Col xs={2} style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                {ingred.quantity} {ingred.quantity_type}
              </Col>

              <Col xs={essential ? 6 : 3}>
                <div
                  onClick={() => openModal(ingred.name)}
                  style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
                  className="hover-accent"
                >
                  {ingred.complete ? (
                    <del style={{ color: 'var(--text-secondary)' }}>{ingred.name}</del>
                  ) : (
                    <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>{ingred.name}</span>
                  )}
                </div>
              </Col>

              {!essential && (
                <>
                  <Col xs={2} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {ingred.options[0]?.name || ingred.name}
                  </Col>

                  <Col xs={1} className="text-center">
                    {ingred.loading ? (
                      <div className={styles.lds_circle} style={{ transform: 'scale(0.5)' }}><div></div></div>
                    ) : (
                      ingred.options[0]?.source && (
                        <img
                          style={{ maxWidth: '24px', borderRadius: '4px' }}
                          src={`/${ingred.options[0].source}.png`}
                          alt={ingred.options[0].source}
                        />
                      )
                    )}
                  </Col>
                </>
              )}

              <Col xs={essential ? 3 : 2} className="flex-row align-center gap-2">
                {ingred.category && (
                  <>
                    <img
                      src={`/categories/${ingred.category.replace(/\s/g, '')}.png`}
                      style={{ maxWidth: '24px', opacity: 0.8 }}
                      alt={ingred.category}
                    />
                    <span style={{ fontSize: '0.9rem' }}>{ingred.category}</span>
                  </>
                )}
              </Col>

              {!essential && (
                <Col xs={1} style={{ fontWeight: '600' }}>
                  ${(ingred.options[0] ? ingred.options[0].unit_price * ingred.quantity : 0).toFixed(2)}
                </Col>
              )}

              {modifyColumnName && (
                <Col xs={1} className="text-center">
                  {modifyColumnName === "Incorrect" ? (
                    <button className="btn-modern btn-danger p-1" style={{ minWidth: '32px' }} onClick={() => markAsIncorrect(ingred.options[0]?._id, ingred.name)}>
                      &times;
                    </button>
                  ) : modifyColumnName === "Remove" ? (
                    <button className="btn-modern btn-danger p-1" style={{ minWidth: '32px' }} onClick={(e) => handleDeleteItem(e, ingred._id)}>
                      &times;
                    </button>
                  ) : null}
                </Col>
              )}
            </Row>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="Ingredient Research"
      >
        <div className="flex-col gap-4">
          <div className="flex-row justify-between align-center">
            <h2 className="m-0">Ingredient Research</h2>
            <button
              className="btn-modern btn-outline p-2"
              onClick={closeModal}
              style={{ borderRadius: '50%', width: '40px', height: '40px' }}
            >
              &times;
            </button>
          </div>
          <IngredientSearchList search_term={selectedIngred} />
        </div>
      </Modal>

      <div className="flex-row justify-between align-center mt-8 glass-card p-6">
        <h2 className="m-0">Total: <span style={{ color: 'var(--accent)' }}>${calculateTotalOfList()}</span></h2>
        <button className="btn-modern" onClick={toggleEssentials}>
          {essential ? 'Show All Details' : 'Hide Extra Crap'}
        </button>
      </div>
    </div>
  );
}

IngredientTable.propTypes = {
  ingredients: PropTypes.array.isRequired,
};

export default IngredientTable;
