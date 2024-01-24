import React from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import { useRouter } from 'next/router';


const ImageCard = ({ recipe, allowDelete, onDelete, onRedirect, cardHeight='15rem' }) => {
  // const cardHeight = '15rem';
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div style={{ padding: '0.5vh' }}>
      <Card style={{ color: 'black', alignItems: 'center', justifyContent: 'center', height: cardHeight }}>
        {allowDelete && (
          <Button variant="danger" onClick={() => onDelete(recipe._id)} style={{ float: 'right' }}>
            x
          </Button>
        )}
        <Card.Body
          style={{
            overflow: 'hidden',
            height: cardHeight,
          }}
          onClick={() => onRedirect(`${currentPath}/${recipe._id}`)}
        >
          <Card.Title>{String(recipe.name)}</Card.Title>
          {recipe.image && (
            <Card.Img
              style={{ height: cardHeight, objectFit: 'cover', maxHeight: cardHeight }}
              variant="top"
              src={recipe.image}
            />
          )}
          {!recipe.image && <div style={{ height: cardHeight, backgroundColor: 'white' }}></div>}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ImageCard;
