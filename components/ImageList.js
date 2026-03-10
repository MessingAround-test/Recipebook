import React, { useState } from 'react';

function ImageList({ images, onImageChange, value }) {
  const [internalStates, setInternalStates] = useState(
    images.reduce((acc, imageUrl) => {
      acc[imageUrl] = true;
      return acc;
    }, {})
  );

  const imageStates = value || internalStates;

  const toggleImageState = (imageUrl) => {
    const newImageStates = { ...imageStates };
    newImageStates[imageUrl] = !newImageStates[imageUrl];
    if (!value) setInternalStates(newImageStates);
    onImageChange(newImageStates);
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      {images.map((imageUrl, index) => {
        const isEnabled = imageStates[imageUrl];

        return (
          <div
            key={index}
            className={`
              relative flex items-center justify-center p-2 rounded-lg cursor-pointer
              transition-all duration-200 border-2 select-none
              ${isEnabled
                ? 'border-transparent bg-white/5 hover:bg-white/10 shadow-sm'
                : 'border-white/5 bg-transparent opacity-50 grayscale hover:opacity-75'
              }
            `}
            style={{ width: '80px', height: '48px' }}
            onClick={() => toggleImageState(imageUrl)}
            title={isEnabled ? "Disable Supplier" : "Enable Supplier"}
          >
            <img
              src={imageUrl}
              alt={`Supplier ${index + 1}`}
              className="max-w-full max-h-full object-contain pointer-events-none"
            />
          </div>
        );
      })}
    </div>
  );
}

export default ImageList;
