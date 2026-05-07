import { DailyIntakeTargets } from './dailyIntake';

export interface NutrientInsight {
    label: string;
    symptoms: string[];
    foods: string[];
}

export const NUTRIENT_INSIGHTS: Record<keyof DailyIntakeTargets, NutrientInsight> = {
    energy_kcal: {
        label: 'Energy (Calories)',
        symptoms: ['Persistent fatigue', 'Brain fog', 'Poor physical performance', 'Feeling cold', 'Irritability'],
        foods: ['Whole grains', 'Healthy fats', 'Starchy vegetables', 'Legumes']
    },
    protein_g: {
        label: 'Protein',
        symptoms: ['Muscle weakness', 'Hair loss', 'Brittle nails', 'Frequent infections', 'Edema (swelling)'],
        foods: ['Lean meats', 'Eggs', 'Lentils', 'Tofu', 'Greek yogurt', 'Quinoa']
    },
    fat_g: {
        label: 'Fats',
        symptoms: ['Dry, scaly skin', 'Impaired wound healing', 'Hormonal imbalances', 'Dry eyes'],
        foods: ['Avocado', 'Nuts', 'Seeds', 'Olive oil', 'Fatty fish']
    },
    carbohydrates_g: {
        label: 'Carbohydrates',
        symptoms: ['Fatigue', 'Dizziness', 'Headaches', 'Low stamina', 'Poor concentration'],
        foods: ['Fruits', 'Vegetables', 'Whole grains', 'Sweet potatoes']
    },
    fiber_g: {
        label: 'Fiber',
        symptoms: ['Constipation', 'Irregular bowel movements', 'Blood sugar fluctuations', 'Feeling hungry soon after eating'],
        foods: ['Beans', 'Oats', 'Chia seeds', 'Berries', 'Broccoli']
    },
    calcium_mg: {
        label: 'Calcium',
        symptoms: ['Muscle spasms', 'Numbness in fingers', 'Brittle bones', 'Tooth decay'],
        foods: ['Dairy products', 'Leafy greens', 'Tofu', 'Fortified milks', 'Almonds']
    },
    iron_mg: {
        label: 'Iron',
        symptoms: ['Extreme fatigue', 'Pale skin', 'Shortness of breath', 'Cold hands and feet', 'Brittle nails'],
        foods: ['Red meat', 'Spinach', 'Lentils', 'Pumpkin seeds', 'Quinoa']
    },
    magnesium_mg: {
        label: 'Magnesium',
        symptoms: ['Muscle cramps', 'Insomnia', 'Fatigue', 'High blood pressure', 'Irregular heartbeat'],
        foods: ['Dark chocolate', 'Spinach', 'Pumpkin seeds', 'Almonds', 'Black beans']
    },
    phosphorus_mg: {
        label: 'Phosphorus',
        symptoms: ['Bone pain', 'Stiff joints', 'Loss of appetite', 'Anxiety'],
        foods: ['Chicken', 'Pork', 'Dairy', 'Nuts', 'Beans']
    },
    potassium_mg: {
        label: 'Potassium',
        symptoms: ['Muscle weakness', 'Cramps', 'Heart palpitations', 'Digestive issues'],
        foods: ['Bananas', 'Potatoes', 'Spinach', 'Avocado', 'Coconut water']
    },
    sodium_mg: {
        label: 'Sodium',
        symptoms: ['Headaches', 'Nausea', 'Confusion', 'Muscle cramps (usually from excess loss, not deficiency)'],
        foods: ['Salt', 'Beets', 'Celery', 'Processed foods (usually adequate)']
    },
    zinc_mg: {
        label: 'Zinc',
        symptoms: ['Loss of taste or smell', 'Poor wound healing', 'Hair loss', 'Diarrhea', 'Skin rashes'],
        foods: ['Oysters', 'Beef', 'Chickpeas', 'Cashews', 'Pumpkin seeds']
    },
    vitamin_a_ug: {
        label: 'Vitamin A',
        symptoms: ['Night blindness', 'Dry eyes', 'Frequent infections', 'Dry skin'],
        foods: ['Carrots', 'Sweet potatoes', 'Spinach', 'Eggs', 'Cod liver oil']
    },
    vitamin_b1_mg: {
        label: 'Vitamin B1 (Thiamine)',
        symptoms: ['Pins and needles', 'Muscle weakness', 'Confusion', 'Short-term memory loss'],
        foods: ['Pork', 'Sunflower seeds', 'Whole grains', 'Legumes']
    },
    vitamin_b2_mg: {
        label: 'Vitamin B2 (Riboflavin)',
        symptoms: ['Cracks at mouth corners', 'Sore tongue', 'Light sensitivity', 'Skin rashes'],
        foods: ['Eggs', 'Organ meats', 'Milk', 'Mushrooms', 'Almonds']
    },
    vitamin_b3_mg: {
        label: 'Vitamin B3 (Niacin)',
        symptoms: ['Indigestion', 'Fatigue', 'Canker sores', 'Skin inflammation'],
        foods: ['Chicken breast', 'Tuna', 'Peanuts', 'Mushrooms', 'Green peas']
    },
    vitamin_b6_mg: {
        label: 'Vitamin B6',
        symptoms: ['Mood changes', 'Weakened immune system', 'Skin rashes', 'Tingling hands/feet'],
        foods: ['Chickpeas', 'Salmon', 'Chicken', 'Bananas', 'Potatoes']
    },
    vitamin_b12_ug: {
        label: 'Vitamin B12',
        symptoms: ['Anemia', 'Numbness or tingling', 'Difficulty walking', 'Cognitive decline'],
        foods: ['Beef', 'Clams', 'Fortified nutritional yeast', 'Eggs', 'Salmon']
    },
    vitamin_c_mg: {
        label: 'Vitamin C',
        symptoms: ['Bleeding gums', 'Slow wound healing', 'Easy bruising', 'Joint pain', 'Dry skin'],
        foods: ['Oranges', 'Strawberries', 'Bell peppers', 'Kiwi', 'Broccoli']
    },
    vitamin_d_ug: {
        label: 'Vitamin D',
        symptoms: ['Bone pain', 'Muscle weakness', 'Mood changes (seasonal depression)', 'Hair loss'],
        foods: ['Fatty fish', 'Egg yolks', 'Mushrooms (UV exposed)', 'Fortified foods']
    },
    vitamin_e_mg: {
        label: 'Vitamin E',
        symptoms: ['Muscle pain', 'Vision problems', 'Immune system issues', 'Tingling/numbness'],
        foods: ['Almonds', 'Sunflower seeds', 'Spinach', 'Avocado', 'Olive oil']
    },
    vitamin_k_ug: {
        label: 'Vitamin K',
        symptoms: ['Excessive bleeding', 'Easy bruising', 'Small blood clots under nails'],
        foods: ['Kale', 'Spinach', 'Brussels sprouts', 'Cabbage', 'Broccoli']
    }
};
