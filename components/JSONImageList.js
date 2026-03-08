import styles from '../styles/Home.module.css';
import { getColorForCategory, getLightColorForCategory } from '../lib/colors';


// Legacy image mappings kept for possible external uses, but we won't use them for banners anymore
const imageMapping = {
    // ... we don't need this for the new UI, but keeping it just in case
};

export const JSONImageList = ({ children, data }) => {
    const renderImages = () => {
        if (data === undefined) {
            return <></>
        }
        const keys = Object.keys(data);

        return keys.map((key) => {
            const subKey = data[key];

            // Always use a sleek colored badge approach
            const accentColor = getColorForCategory(subKey || key);
            const lightColor = getLightColorForCategory(subKey || key);

            if (key === "complete" || subKey !== undefined) {
                const displayText = key === "complete" ? key : subKey;

                // If it doesn't match a color, just show text of the category
                if (!accentColor) {
                    return (
                        <div key={key} className="flex items-center">
                            <span className="font-bold text-sm tracking-widest uppercase">{displayText}</span>
                            {children && <div className="ml-3">{children}</div>}
                        </div>
                    );
                }

                return (
                    <div key={key} className="flex items-center">
                        <div
                            className="px-4 py-2 rounded-full font-bold text-sm tracking-widest uppercase shadow-lg inline-flex items-center gap-2"
                            style={{
                                backgroundColor: `${lightColor}20`, // 20% opacity background
                                color: accentColor,
                                border: `1px solid ${accentColor}40`
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                            />
                            {displayText}
                        </div>
                        {children && <div className="ml-3">{children}</div>}
                    </div>
                );
            }
            return <h3 className="text-white font-bold">{JSON.stringify(data)}</h3>;
        });
    };

    return <div className="flex flex-row items-center gap-3">{renderImages()}</div>;
};

