// SamplePage.js
import React, { useState } from 'react';
import { Form, Button, Container, Card } from 'react-bootstrap';
import Head from 'next/head';
import IngredientResearchComponent from './ingredientResearchComponent';
import styles from '../styles/Login.module.css';

function SamplePage() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Searching for:", searchTerm);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Ingredient Explorer</title>
        <meta name="description" content="Explore a world of ingredients for your culinary and brewing adventures." />
        <link rel="icon" href="/avo.ico" />
      </Head>

      <main className={styles.main_flex}>
        <Card className="p-4" style={{ maxWidth: '80%', margin: '0 auto', borderRadius: '10px', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
          <Card.Body>
            <h1 className="text-center mb-4" style={{ color: '#007bff' }}>Ingredient Explorer</h1>
            <p className="text-center text-muted mb-4">
              Check out how much shit costs at either, "Woolworths", "Aldi", "Panetta" or "IGA". 
              First one to try is "Carrot"
              <br></br>
              You are restricted to only the ones which have already been searched unless bryn gives you an account. 
            </p>
            
            {/* Render Ingredient Research Component */}
            <div className="mt-4">
              <IngredientResearchComponent/>
            </div>
          </Card.Body>
        </Card>
      </main>
    </div>
  );
}

export default SamplePage;
