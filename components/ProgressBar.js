// components/ProgressBar.js

import React from 'react';

const ProgressBar = ({ completionPercentage }) => {
  const progressStyle = {
    width: `${completionPercentage}%`,
    height: '100%',
    backgroundColor: 'green',
    position: 'absolute',
    top: 0,
    left: 0,
  };

  const labelStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'white',
  };

  return (
    <div style={{ width: '300px', height: '20px', border: '1px solid #ccc', position: 'relative' }}>
      <div style={progressStyle}></div>
      <div style={labelStyle}>{completionPercentage}%</div>
    </div>
  );
};

export default ProgressBar;
