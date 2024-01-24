// Home.js

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Toolbar } from '../../Toolbar';
import { getRecipeDetails, getShoppingListItems } from '../../../lib/commonAPIs'; // Adjust the import paths based on your project structure
import { ShoppingListComponent } from '../../../components/ShoppingListComponent'; // Adjust the import path based on your project structure
import {Button} from 'react-bootstrap/Button';
import {Row} from 'react-bootstrap/Row';
import {Col} from 'react-bootstrap/Col';

import styles from '../../../styles/Home.module.css';

export default function Home() {
  const [userData, setUserData] = useState({});
  const router = useRouter();
  const { id } = router.query;
  const [list, setList] = useState({});
  const [listIngreds, setListIngreds] = useState([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('Token') === null || localStorage.getItem('Token') === undefined) {
      alert("please re-log in");
      Router.push("/login");
    }
    if (id) {
      getRecipeDetails();
    }
  }, [id]);

  useEffect(() => {
    if (list._id !== undefined) {
      getShoppingListItems();
    }
  }, [list]);

  const getRecipeDetails = async () => {
    try {
      const data = await fetch(`/api/ShoppingList/${id}?EDGEtoken=${localStorage.getItem('Token')}`);
      const result = await data.json();
      setList(result.res);
    } catch (error) {
      console.error(`Error getting recipe details: ${error.message}`);
    }
  };

  const getShoppingListItems = async () => {
    try {
      const data = await fetch(`/api/ShoppingListItem/?shoppingListId=${id}&EDGEtoken=${localStorage.getItem('Token')}`);
      const result = await data.json();
      setListIngreds(result.res);
    } catch (error) {
      console.error(`Error getting shopping list items: ${error.message}`);
    }
  };

  const redirect = async function (page) {
    Router.push(page);
  };

  return (
    <div>
      <Toolbar />
      <div className={styles.container}>
        {/* ... (rest of your JSX code) */}
        <main className={styles.main}>
          {/* Use the ShoppingListComponent with ingredients as a prop */}
          <ShoppingListComponent ingredients={listIngreds} />
          {/* ... (rest of your JSX code) */}
        </main>
        <footer className={styles.footer}>
          {/* ... (rest of your JSX code) */}
        </footer>
      </div>
    </div>
  );
}
