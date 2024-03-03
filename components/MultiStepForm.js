// MultiStepForm.jsx

import React, { useState } from 'react';
import styles from '../styles/MultiStepForm.module.css'; // Import the CSS module


const MultiStepForm = () => {
  const [questions, setQuestions] = useState([
    {
      id: 1,
      text: 'What type of malt would you like to use?',
      type: 'carousel',
      options: [
        { text: 'Pale Malt', additionalInfo: 'Light and mild flavor.' },
        { text: 'Crystal Malt', additionalInfo: 'Sweetness with caramel notes.' },
        { text: 'Chocolate Malt', additionalInfo: 'Dark color with chocolate/coffee flavors.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 2,
      text: 'Which hops flavor profile do you prefer?',
      type: 'carousel',
      options: [
        { text: 'Citrus', additionalInfo: 'Bright, zesty, and fruity notes.' },
        { text: 'Floral', additionalInfo: 'Flowery and aromatic character.' },
        { text: 'Spicy', additionalInfo: 'Peppery or herbal flavor.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 3,
      text: 'Choose a yeast strain for fermentation:',
      type: 'carousel',
      options: [
        { text: 'Ale Yeast', additionalInfo: 'Fruity and complex flavors.' },
        { text: 'Lager Yeast', additionalInfo: 'Clean and crisp profile.' },
        { text: 'Wheat Yeast', additionalInfo: 'Light and refreshing character.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 4,
      text: 'Select a beer style you want to brew:',
      type: 'carousel',
      options: [
        { text: 'IPA', additionalInfo: 'Hop-forward flavors and aromas.' },
        { text: 'Stout', additionalInfo: 'Dark and rich with roasted malt and chocolate notes.' },
        { text: 'Wheat Beer', additionalInfo: 'Light and refreshing with hints of citrus.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 5,
      text: 'Describe the flavor profile you\'re aiming for:',
      type: 'text',
      answer: '',
    },
    {
      id: 6,
      text: 'Preference for a more hoppy, malty, or balanced taste?',
      type: 'carousel',
      options: [
        { text: 'Hoppy', additionalInfo: 'Emphasizes hop bitterness and aroma.' },
        { text: 'Malty', additionalInfo: 'Focuses on the sweetness and richness of malt.' },
        { text: 'Balanced', additionalInfo: 'Harmonious blend of hop and malt characteristics.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 7,
      text: 'Target alcohol content level:',
      type: 'text',
      answer: '',
    },
    {
      id: 8,
      text: 'Preferred brewing method:',
      type: 'carousel',
      options: [
        { text: 'Extract', additionalInfo: 'Simplified method using malt extract.' },
        { text: 'Partial Mash', additionalInfo: 'Combines extract and mashing grains for added control.' },
        { text: 'All-Grain', additionalInfo: 'Involves mashing grains for complete brewing control.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 9,
      text: 'Do you have a preferred brewing system or equipment?',
      type: 'text',
      answer: '',
    },
    {
      id: 10,
      text: 'Brewing location (e.g., home, backyard):',
      type: 'text',
      answer: '',
    },
    {
      id: 11,
      text: 'Fermentation temperature range:',
      type: 'text',
      answer: '',
    },
    {
      id: 12,
      text: 'Preferred fermentation duration:',
      type: 'text',
      answer: '',
    },
    {
      id: 13,
      text: 'Additional ingredients for flavor enhancement:',
      type: 'text',
      answer: '',
    },
    {
      id: 14,
      text: 'Considered dry hopping or adding adjuncts?',
      type: 'carousel',
      options: [
        { text: 'Yes', additionalInfo: 'Dry Hopping: Adds hop aroma and flavor without increasing bitterness.\nAdjuncts: Additional ingredients for flavor enhancement.' },
        { text: 'No', additionalInfo: 'No additional processes considered.' },
      ],
      selectedOption: '',
      answer: '',
    },
    {
      id: 15,
      text: 'Packaging and carbonation preference:',
      type: 'carousel',
      options: [
        { text: 'Bottles', additionalInfo: 'Traditional packaging with individual servings.' },
        { text: 'Kegs', additionalInfo: 'Suitable for larger quantities and draft dispensing.' },
      ],
      selectedOption: '',
      answer: '',
    },
  ]);
  




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
    const selectedOption = currentQuestionData.options?currentQuestionData.options.find(option => option.text === currentQuestionData.selectedOption):null;
  
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
