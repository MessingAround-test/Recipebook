import React, { useState } from 'react';

function ImageList({ images, onImageChange }) {
  const [imageStates, setImageStates] = useState(
    images.reduce((acc, imageUrl) => {
      acc[imageUrl] = true; // Initially, all images are enabled
      return acc;
    }, {})
  );

  const toggleImageState = (imageUrl) => {
    const newImageStates = { ...imageStates };
    newImageStates[imageUrl] = !newImageStates[imageUrl];
    setImageStates(newImageStates);
    onImageChange(newImageStates);
  };

  const toggleImageEnabled = (imageUrl) => {
    if (!imageStates[imageUrl]) {
      toggleImageState(imageUrl);
    }
  };

  const imageListStyle = {
    display: 'flex',
    gap: '5px',
    borderRadius: '10px', // Set border radius to 10px
    background: '#1C2640', // Change the background color
    padding: '5px',
    overflow: 'hidden',
  };

  const imageStyle = {
    flex: '1',
    maxWidth: '100%',
    position: 'relative',
  };

  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    color: 'red', // Set the color to red
    fontSize: '24px',
    cursor: 'pointer', // Make the cursor a pointer
  };

  return (
    <div style={imageListStyle}>
      {images.map((imageUrl, index) => (
        <div key={index} style={imageStyle}>
          <img
            src={imageUrl}
            alt={`Image ${index + 1}`}
            style={{
              filter: imageStates[imageUrl] ? 'none' : 'grayscale(100%)',
              cursor: 'pointer',
              width: '100%',
              height: '100%',
            }}
            onClick={() => toggleImageState(imageUrl)}
          />
          {!imageStates[imageUrl] && (
            <div
              style={overlayStyle}
              onClick={() => toggleImageEnabled(imageUrl)}
            >
              X
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ImageList;
