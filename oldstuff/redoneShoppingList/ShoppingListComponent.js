// ShoppingListComponent.js

import React, { useEffect, useState } from 'react';
import  getGroceryStoreProducts from '../lib/commonAPIs';
import {groupByKeys} from '../lib/grouping';
import  ToggleList  from './ToggleList';
import ImageList  from './ImageList';
import  AddShoppingItem  from './AddShoppingItem';
import  NewIngredientTable  from './NewIngredientTable';

export function ShoppingListComponent({ ingredients }) {
  const [matchedListIngreds, setMatchedListIngreds] = useState([]);
  const [createNewIngredOpen, setCreateNewIngredOpen] = useState(false);
  const [enabledSuppliers, setEnabledSuppliers] = useState(["WW", "Panetta", "IGA", "Aldi", "Coles"]);
  const [filters, setFilters] = useState(["complete", "supplier"]);

  useEffect(() => {
    reloadAllIngredients();
  }, [ingredients]);

  async function reloadAllIngredients() {
    // While loading...
    let updatedListIngreds = ingredients.map((ingred) => ({
      ...ingred,
      options: [],
      loading: true,
    }));
    setMatchedListIngreds(updatedListIngreds);

    // Use a loop to update the state for each ingredient individually
    for (let i = 0; i < updatedListIngreds.length; i++) {
      try {
        const updatedIngredient = await getGroceryStoreProducts(
          updatedListIngreds[i],
          1,
          enabledSuppliers,
          localStorage.getItem('Token')
        );

        // Update the state for the specific ingredient
        updatedListIngreds[i] = {
          ...updatedIngredient,
          loading: false,
        };
        setMatchedListIngreds([...updatedListIngreds]);
      } catch (error) {
        // Handle errors if needed
        console.error(`Error updating ingredient: ${error.message}`);
      }
    }
  }

  const handleActiveSupplierChange = (e) => {
    // Handle changes to active suppliers
  };

  const handleCheckboxChange = (ingred) => {
    const updatedIngredients = [...matchedListIngreds];
    let index = updatedIngredients.findIndex(item => item._id === ingred._id);
    updatedIngredients[index].complete = !updatedIngredients[index].complete;
    setMatchedListIngreds(updatedIngredients);
    updateCompleteInDB(updatedIngredients[index]._id, updatedIngredients[index].complete);
  };

  const handleDeleteItem = (id) => {
    // Handle item deletion
  };

  const handleSubmitCreateNewItem = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`/api/ShoppingListItem/?EDGEtoken=${localStorage.getItem('Token')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(e.value),
      });

      if (response.ok) {
        e.resetForm();
        getRecipeDetails();
      } else {
        let error = await response.json();
        console.log(error);
        alert(error.message);
      }
    } catch (error) {
      alert(error);
    }
  };

  const updateCompleteInDB = async (id, complete) => {
    try {
      const response = await fetch(`/api/ShoppingListItem/${id}?EDGEtoken=${localStorage.getItem('Token')}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ "complete": complete }),
      });

      if (!response.ok) {
        let error = await response.json();
        console.log(error);
        alert(error.message);
      }
    } catch (error) {
      alert(error);
    }
  };

  const updateSupplierFromInputObject = (inputObject) => {
    const resultArray = Object.keys(inputObject).filter(key => inputObject[key]);
    const formattedResultArray = resultArray.map(key => key.replace(/^\/|\.png$/g, ''));
    setEnabledSuppliers(formattedResultArray);
  };

  useEffect(() => {
    // This code will run after the component renders and whenever enabledSuppliers changes
    reloadAllIngredients();
  }, [enabledSuppliers]);

  return (
    <div>
      <ToggleList inputList={["complete"]} onUpdateList={(currentState) => setFilters(currentState)} value={filters} text={"Group By"} />
      {filters.includes("supplier") ? <ImageList images={["/WW.png", "/Panetta.png", "/IGA.png", "/Aldi.png", "/Coles.png"]} onImageChange={(e) => handleActiveSupplierChange(e)} /> : null}
      {createNewIngredOpen ? <AddShoppingItem shoppingListId={id} handleSubmit={handleSubmitCreateNewItem} reload={getRecipeDetails}></AddShoppingItem> : null}
      {Object.keys(groupByKeys(matchedListIngreds, filters)).map((group) => (
        <div key={group}>
          <h3>{group}</h3>
          <NewIngredientTable reload={() => reloadAllIngredients()} ingredients={groupByKeys(matchedListIngreds, filters)[group].map((ingred) => ingred)} handleCheckboxChange={handleCheckboxChange} handleDeleteItem={handleDeleteItem} modifyColumnName="" filters={filters} />
        </div>
      ))}
    </div>
  );
}
