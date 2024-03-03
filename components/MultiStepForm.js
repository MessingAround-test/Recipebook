// MultiStepForm.jsx

import React, { useState } from 'react';
import styles from '../styles/MultiStepForm.module.css'; // Import the CSS module


const MultiStepForm = ({ questions }) => {

  const [questions, setQuestions] = useState(questions)

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && questions[currentQuestion].type !== 'carousel') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleInputChange = (e) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestion].answer = e.target.value;
    setQuestions(updatedQuestions);
  };

  const handleSelectOption = (option) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestion].selectedOption = option;
    setQuestions(updatedQuestions);
  };

  const handleGoBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // All questions are complete, you can now handle the form data
      const formData = questions.reduce((data, question) => {
        data[question.id] = question.answer || question.selectedOption;
        return data;
      }, {});

      // Do something with the formData, for example, log it to the console
      console.log(formData);
    }
  };

  const renderCarouselOptions = () => {
    const currentQuestionData = questions[currentQuestion];
    return (
      <div className={styles.carousel}>
        {currentQuestionData.options.map((option, index) => (
          <div
            key={index}
            onClick={() => handleSelectOption(option.text)}
            className={`${styles.carouselItem} ${option.text === currentQuestionData.selectedOption ? styles.selected : ''}`}
          >
            {option.text}
          </div>
        ))}
      </div>
    );
  };
  const renderNavigationButtons = () => {
    const percentageComplete = calculatePercentageComplete();
    return (
      <>
        <div className={styles.navigationButtons}>
          {currentQuestion > 0 && (
            <button onClick={handleGoBack} className={styles.goBackButton}>
              Go Back
            </button>
          )}

          <button onClick={handleNext} className={styles.nextButton}>
            {currentQuestion < questions.length - 1 ? 'Next' : 'Submit'}
          </button>
        </div>
        <br></br>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBar} style={{ width: `${percentageComplete}%` }}>
          </div>
        </div>
      </>
    );
  };
  const renderAdditionalInfo = () => {
    const currentQuestionData = questions[currentQuestion];
    const selectedOption = currentQuestionData.options ? currentQuestionData.options.find(option => option.text === currentQuestionData.selectedOption) : null;

    if (selectedOption && selectedOption.additionalInfo) {
      return (
        <div className={styles.additionalInfo}>
          <p>{selectedOption.additionalInfo}</p>
        </div>
      );
    }
    return null;
  };


  const calculatePercentageComplete = () => {
    const totalQuestions = questions.length;
    const answeredQuestions = questions.slice(0, currentQuestion + 1).filter(question => question.answer || question.selectedOption).length;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };


  return (
    <div className={styles.centeredContainer}>
      <div className={styles.multistepFormContainer}>
        {/* <h2>Question {currentQuestion + 1}</h2> */}
        <p>{questions[currentQuestion].text}</p>
        {questions[currentQuestion].type === 'text' && (
          <input
            type="text"
            value={questions[currentQuestion].answer}
            onChange={handleInputChange}
            className={styles.inputField}
            onKeyPress={handleKeyPress}
          />
        )}
        {questions[currentQuestion].type === 'number' && (
          <input
            type="number"
            value={questions[currentQuestion].answer}
            onChange={handleInputChange}
            className={styles.inputField}
            onKeyPress={handleKeyPress}
          />
        )}
        {questions[currentQuestion].type === 'carousel' && renderCarouselOptions()}
        {renderAdditionalInfo()}
        {renderNavigationButtons()}
      </div>
    </div>
  );
};

export default MultiStepForm;
