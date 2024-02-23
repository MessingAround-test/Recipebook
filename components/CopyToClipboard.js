import React, { useRef, useEffect } from 'react';
import ClipboardJS from 'clipboard';
import { Button } from 'react-bootstrap';

const CopyToClipboard = ({ listIngreds }) => {
  const textToCopyRef = useRef(null);

  useEffect(() => {
    const clipboard = new ClipboardJS('.copy-button', {
      target: () => textToCopyRef.current,
    });

    return () => clipboard.destroy();
  }, [listIngreds]);

  const generateChecklistText = (ingredients) => {
    if (ingredients === undefined) {
      return "";
    }
    
    return (
      <>
        {ingredients

          .filter((ingred) => !ingred.complete)
          .map((ingred, index) => (
            <li key={index}>
              -{ingred.quantity} {ingred.quantity_type_shorthand} {ingred.name}
            </li>
          ))}
      </>
    );
  };

  const checklist = generateChecklistText(listIngreds);

  return (
    <div>
      <div id="copyTarget" ref={textToCopyRef} style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
        }}>
        {checklist}
      </div>
      <Button className="copy-button" data-clipboard-target="#copyTarget">
        Copy to Clipboard
      </Button>
    </div>
  );
};

export default CopyToClipboard;
