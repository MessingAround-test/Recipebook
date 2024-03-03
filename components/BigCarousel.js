// components/BigCarousel.js

import React, { useEffect, useRef } from 'react';
import Slider from 'react-slick';
import PropTypes from 'prop-types';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import styles from '../styles/BigCarousel.module.css';

const BigCarousel = ({ images }) => {
  const sliderRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      sliderRef.current.slickNext();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1
  };

  return (
    <div className={styles.carouselContainer}>
      <Slider ref={sliderRef} {...settings}>
        {images.map((image, index) => (
          <div key={index} className={styles.carouselItem}>
            <img src={image.url} alt={`${image.name}`} style={{ width: '80vw', height: '80vh', objectFit: 'cover' }}/>
          </div>
        ))}
      </Slider>
    </div>
  );
};

BigCarousel.propTypes = {
  images: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default BigCarousel;
