import React from 'react';

const CategoryList = ({ categoryString }) => {
  const categoryArray = categoryString.split('|').map((item) => {
    const [key, value] = item.split('=');
    return { [key]: value };
  });

  // Extract unique categories
  const uniqueCategories = Array.from(
    new Set(categoryArray.map((category) => Object.values(category)[0]))
  );

  if (uniqueCategories.length === 0) {
    // No unique categories, don't render anything
    return null;
  }

  return (
    <div>
      
      <h3>{uniqueCategories[0]}</h3>
    </div>
  );
};

export default CategoryList;
