export const getColorForCategory = (categoryName) => {
    // A curated, dynamic palette of modern, rich colors
    const categoryColors = {
        'Fresh Produce': '#10b981', // Emerald
        'International Foods': '#f59e0b', // Amber
        'Bakery': '#d97706', // Yellow-Amber
        'Baking Supplies': '#b45309', // Darker amber
        'Beverages': '#0ea5e9', // Sky Blue
        'Canned Goods': '#64748b', // Slate
        'Cereal and Breakfast Foods': '#fbbf24', // Yellow
        'Condiments and Sauces': '#ef4444', // Red
        'Dairy and Eggs': '#fcd34d', // Light Yellow
        'Deli and Prepared Foods': '#f43f5e', // Rose
        'Frozen Foods': '#38bdf8', // Light Blue
        'Health and Wellness': '#14b8a6', // Teal
        'Home and Garden': '#84cc16', // Lime
        'Household and Cleaning': '#06b6d4', // Cyan
        'Meat and Seafood': '#ef4444', // Red
        'Pasta and Grains': '#d97706', // Amber
        'Personal Care': '#c084fc', // Purple
        'Snacks': '#f97316', // Orange
        'Staple Food': '#8b5cf6', // Violet
        'Fridge': '#60a5fa', // Blue
        'Freezer': '#93c5fd', // Light Blue
        'Staple Other': '#a855f7', // Purple
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
