export const getColorForCategory = (categoryName) => {
    // A curated, dynamic palette of modern, rich colors
    const categoryColors = {
        'Fresh Produce': '#34d399', // Bright Emerald
        'International Foods': '#fbbf24', // Bright Amber
        'Bakery': '#f59e0b', // Amber
        'Baking Supplies': '#eab308', // Yellow
        'Beverages': '#38bdf8', // Sky Blue
        'Canned Goods': '#94a3b8', // Lighter Slate
        'Cereal and Breakfast Foods': '#facc15', // Bright Yellow
        'Condiments and Sauces': '#f87171', // Light Red
        'Dairy and Eggs': '#fde047', // Bright Yellow
        'Deli and Prepared Foods': '#fb7185', // Light Rose
        'Frozen Foods': '#7dd3fc', // Lighter Sky
        'Health and Wellness': '#2dd4bf', // Bright Teal
        'Home and Garden': '#a3e635', // Bright Lime
        'Household and Cleaning': '#22d3ee', // Bright Cyan
        'Meat and Seafood': '#f87171', // Light Red
        'Pasta and Grains': '#fbbf24', // Bright Amber
        'Personal Care': '#d8b4fe', // Light Purple
        'Snacks': '#fb923c', // Light Orange
        'Staple Food': '#a78bfa', // Light Violet
        'Fridge': '#60a5fa', // Blue
        'Freezer': '#93c5fd', // Light Blue
        'Staple Other': '#c084fc', // Light Purple
        // Suppliers can get their own colors too
        'WW': '#16a34a', // Green
        'Coles': '#dc2626', // Red
        'Aldi': '#0369a1', // Sky
        'IGA': '#b91c1c', // Dark Red
        'Panetta': '#f59e0b', // Amber
        'Other (No Match)': '#ef4444', // Red / Warning
    };

    // If we have a mapped color, use it. Otherwise, return null to signify unmapped.
    if (categoryColors[categoryName]) {
        return categoryColors[categoryName];
    }

    return null; // Used to return a random fallback color
};

// Also provides a slight tint/background-compatible color using an opacity equivalent
export const getLightColorForCategory = (categoryName) => {
    // Hex to RGBA conversion is possible but for simplicity we return the hex 
    // and rely on CSS custom properties or manual opacity styling later
    return getColorForCategory(categoryName);
};
