import React from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import { useRouter } from 'next/router';


const ImageCard = ({ recipe, allowDelete, onDelete, onRedirect, cardHeight = '15rem' }) => {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <div style={{ padding: '0.5vh' }}>
      <Card className="glass-card" style={{ height: cardHeight, cursor: 'pointer', overflow: 'hidden' }}>
        {allowDelete && (
          <Button
            variant="danger"
            onClick={(e) => { e.stopPropagation(); onDelete(recipe._id); }}
            style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}
          >
            x
          </Button>
        )}
        <div
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          onClick={() => onRedirect(`${currentPath}/${recipe._id}`)}
        >
          {recipe.image ? (
            <Card.Img
              style={{ height: '70%', objectFit: 'cover' }}
              variant="top"
              src={recipe.image}
            />
          ) : (
            <div style={{ height: '70%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>No Image</span>
            </div>
          )}
          <Card.Body style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <Card.Title style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'inherit', textAlign: 'center' }}>
              {recipe.name}
            </Card.Title>
          </Card.Body>
        </div>
      </Card>
    </div>
  );
};

export default ImageCard;
