import React, { useRef, useEffect } from 'react';
import ClipboardJS from 'clipboard';
import { Button } from 'react-bootstrap';

const CopyToClipboard = ({ textToCopy }) => {
  const textToCopyRef = useRef(null);

  useEffect(() => {
    const clipboard = new ClipboardJS('.copy-button', {
      target: () => textToCopyRef.current,
    });

    return () => clipboard.destroy();
  }, [textToCopy]);

  // Dynamically generate an ID for the target element
  const targetId = `copyTarget_${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div>
      <div
        id={targetId}
        ref={textToCopyRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
        }}
      >
        {textToCopy}
      </div>
      <Button className="copy-button" data-clipboard-target={`#${targetId}`}>
        Copy to Clipboard
      </Button>
    </div>
  );
};

export default CopyToClipboard;
