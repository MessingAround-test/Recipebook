import styles from '../styles/Home.module.css'; // Import CSS module


const imageMapping = {
    supplier: {
        Coles: '/Coles.png',
        IGA: '/IGA.png',
        Panetta: '/Panetta.png',
        WW: '/WW.png',
        '': '/unknown.jpg'

        // Add more suppliers if needed
    },
    category: {
        'Fresh Produce': '/categories2/FreshProduce.jpg',
        'International Foods': '/images/international_foods.jpg',
        'Bakery': '/categories2/Bakery.jpg',
        'Baking Supplies': '/categories2/BakingSupplies.jpg',
        'Beverages': '/categories2/Beverages.jpg',
        'Canned Goods': '/categories2/CannedGoods.jpg',
        'Cereal and Breakfast Foods': '/categories2/CerealandBreakfastFoods.jpg',
        'Condiments and Sauces': '/categories2/CondimentsandSauces.jpg',
        'Dairy and Eggs': '/categories2/DairyandEggs.jpg',
        'Deli and Prepared Foods': '/categories2/DeliandPreparedFoods.jpg',
        'Fresh Produce': '/categories2/FreshProduce.jpg',
        'Frozen Foods': '/categories2/FrozenFoods.jpg',
        'Health and Wellness': '/categories2/HealthandWellness.jpg',
        'Home and Garden': '/categories2/HomeandGarden.jpg',
        'Household and Cleaning': '/categories2/HouseholdandCleaning.jpg',
        'International Foods': '/categories2/InternationalFoods.jpg',
        'Meat and Seafood': '/categories2/MeatandSeafood.jpg',
        'Pasta and Grains': '/categories2/PastaandGrains.jpg',
        'Personal Care': '/categories2/PersonalCare.jpg',
        'Snacks': '/categories2/Snacks.jpg',
        'undefined': '/unknown.jpg'
        // Add more categories if needed
    },
    complete: {
        "true": "/complete.jpg"
    }
    // Add more main keys and subkeys as needed
};

export const JSONImageList = ({ data }) => {
    const renderImages = () => {
        if (data === undefined) {
            return <></>
        }
        const keys = Object.keys(data);

        return keys.map((key) => {
            const subKey = data[key];
            const subKeyMapping = imageMapping[key];
            if (key === "complete"){
                return (
                    <div key={key} className={styles.banner}>
                        <div
                            className={styles.bannerImage}
                            style={{ backgroundImage: `url(${subKeyMapping[subKey]})` }}
                        >
                            <div className={styles.overlayContainer}>
                                <p className={styles.overlayText}>{key}</p>
                            </div>
                        </div>
                    </div>
                );
            }
            if (subKeyMapping && subKeyMapping[subKey]) {
                return (
                    <div key={key} className={styles.banner}>
                        <div
                            className={styles.bannerImage}
                            style={{ backgroundImage: `url(${subKeyMapping[subKey]})` }}
                        >
                            <div className={styles.overlayContainer}>
                                <p className={styles.overlayText}>{subKey}</p>
                            </div>
                        </div>
                    </div>
                );
            }
            return <h3>{JSON.stringify(data)}</h3>;
        });
    };

    return <div>{renderImages()}</div>;
};

