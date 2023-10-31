import React, { useState } from 'react';
import styles from '../styles/ExpenseForm.module.css'; // Import CSS module

function ExpenseForm() {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    frequency: '',
    frequency_type: 'Monthly',
    start_date: '',
    finish_date: '',
    user_id: 'user123',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/ASDASDapi/Transactionsasdsd/?EDGEtoken=${localStorage.getItem('Token')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // alert(response)
        // Handle success, e.g., show a success message or redirect
      } else {
        // alert(response)
        // Handle errors, e.g., show an error message
      }
    } catch (error) {
        alert(error)
      // Handle network or other errors
    }
  };

  return (
    <div className={styles['expense-form-container']}>
      <h2>Add New Transaction</h2>
      <form className={styles['expense-form']} onSubmit={handleSubmit}>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Description:</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Amount:</label>
          <input
            type="number"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Category:</label>
          <input
            type="text"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Frequency:</label>
          <input
            type="number"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Frequency Type:</label>
          <select
            name="frequency_type"
            value={formData.frequency_type}
            onChange={handleChange}
            required
          >
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
            <option value="Daily">Daily</option>
          </select>
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Start Date:</label>
          <input
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
          />
        </div>
        <div className={styles['form-group']}>
          <label className={styles['label']}>Finish Date:</label>
          <input
            type="date"
            name="finish_date"
            value={formData.finish_date}
            onChange={handleChange}
          />
        </div>
        <button className={styles['submit-button']} type="submit">
          Submit
        </button>
      </form>
    </div>
  );
}

export default ExpenseForm;
