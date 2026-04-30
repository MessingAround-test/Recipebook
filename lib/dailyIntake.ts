/**
 * Daily intake calculation utilities.
 * Uses Mifflin-St Jeor equation for BMR, multiplied by activity factor,
 * plus user's manually entered exercise KJ (converted to kcal).
 */

export interface UserProfile {
    age?: number;
    gender?: 'male' | 'female' | 'other';
    weight_kg?: number;
    height_cm?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    dietary_preference?: 'none' | 'vegetarian' | 'vegan' | 'pescetarian';
    daily_exercise_kj?: number;
}

export interface DailyIntakeTargets {
    // Macros (grams)
    energy_kcal: number;
    protein_g: number;
    fat_g: number;
    carbohydrates_g: number;
    fiber_g: number;
    // Minerals (mg unless noted)
    calcium_mg: number;
    iron_mg: number;
    magnesium_mg: number;
    phosphorus_mg: number;
    potassium_mg: number;
    sodium_mg: number;
    zinc_mg: number;
    // Vitamins
    vitamin_a_ug: number;
    vitamin_b1_mg: number;
    vitamin_b2_mg: number;
    vitamin_b3_mg: number;
    vitamin_b6_mg: number;
    vitamin_b12_ug: number;
    vitamin_c_mg: number;
    vitamin_d_ug: number;
    vitamin_e_mg: number;
    vitamin_k_ug: number;
}

const ACTIVITY_FACTORS: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

const KJ_TO_KCAL = 0.239006;

/**
 * Calculates BMR using Mifflin-St Jeor equation.
 * Returns kcal/day.
 */
function calculateBMR(profile: UserProfile): number {
    const { age = 30, gender = 'other', weight_kg = 70, height_cm = 170 } = profile;

    // Base formula (unisex average for 'other')
    let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;

    if (gender === 'male') {
        bmr += 5;
    } else if (gender === 'female') {
        bmr -= 161;
    } else {
        // 'other': average of male and female offsets
        bmr -= 78;
    }

    return Math.max(bmr, 1000); // floor at 1000 kcal
}

/**
 * Calculates TDEE (Total Daily Energy Expenditure) in kcal.
 * Adds exercise KJ converted to kcal on top of BMR × activity factor.
 */
function calculateTDEE(profile: UserProfile): number {
    const bmr = calculateBMR(profile);
    const activityFactor = ACTIVITY_FACTORS[profile.activity_level || 'sedentary'];
    const exerciseKcal = (profile.daily_exercise_kj || 0) * KJ_TO_KCAL;
    return Math.round(bmr * activityFactor + exerciseKcal);
}

/**
 * Derives recommended daily micronutrient targets from standard dietary reference values.
 * Some targets vary with gender; others are fixed.
 */
function getMicronutrientTargets(gender: 'male' | 'female' | 'other' = 'other'): Partial<DailyIntakeTargets> {
    const isMale = gender === 'male';
    return {
        // Minerals
        calcium_mg: 1000,
        iron_mg: isMale ? 8 : 18,
        magnesium_mg: isMale ? 420 : 320,
        phosphorus_mg: 700,
        potassium_mg: isMale ? 3400 : 2600,
        sodium_mg: 2300,
        zinc_mg: isMale ? 11 : 8,
        // Vitamins
        vitamin_a_ug: isMale ? 900 : 700,
        vitamin_b1_mg: isMale ? 1.2 : 1.1,
        vitamin_b2_mg: isMale ? 1.3 : 1.1,
        vitamin_b3_mg: isMale ? 16 : 14,
        vitamin_b6_mg: 1.3,
        vitamin_b12_ug: 2.4,
        vitamin_c_mg: isMale ? 90 : 75,
        vitamin_d_ug: 15,
        vitamin_e_mg: 15,
        vitamin_k_ug: isMale ? 120 : 90,
    };
}

/**
 * Main export. Calculates the full set of personalized daily intake targets
 * based on a user's profile. Uses sensible defaults for any missing fields.
 */
export function calculateDailyIntake(profile: UserProfile): DailyIntakeTargets {
    const tdee = calculateTDEE(profile);
    const gender = profile.gender || 'other';

    // Macros derived from TDEE:
    // Protein: 1.6g/kg body weight (performance target)
    // Fat: ~30% of energy (9 kcal/g)
    // Carbs: remaining calories (4 kcal/g)
    const weight_kg = profile.weight_kg || 70;
    const protein_g = Math.round(1.6 * weight_kg);
    const fat_g = Math.round((tdee * 0.30) / 9);
    const carbs_kcal = tdee - protein_g * 4 - fat_g * 9;
    const carbohydrates_g = Math.round(Math.max(carbs_kcal / 4, 100));
    const fiber_g = gender === 'male' ? 38 : 25;

    return {
        energy_kcal: tdee,
        protein_g,
        fat_g,
        carbohydrates_g,
        fiber_g,
        ...getMicronutrientTargets(gender),
    } as DailyIntakeTargets;
}

/**
 * Human-readable label map for display in the UI.
 */
export const NUTRIENT_LABELS: Record<keyof DailyIntakeTargets, { label: string; unit: string; group: 'macro' | 'mineral' | 'vitamin' }> = {
    energy_kcal:      { label: 'Energy',      unit: 'kcal', group: 'macro' },
    protein_g:        { label: 'Protein',      unit: 'g',    group: 'macro' },
    fat_g:            { label: 'Fat',          unit: 'g',    group: 'macro' },
    carbohydrates_g:  { label: 'Carbs',        unit: 'g',    group: 'macro' },
    fiber_g:          { label: 'Fiber',        unit: 'g',    group: 'macro' },
    calcium_mg:       { label: 'Calcium',      unit: 'mg',   group: 'mineral' },
    iron_mg:          { label: 'Iron',         unit: 'mg',   group: 'mineral' },
    magnesium_mg:     { label: 'Magnesium',    unit: 'mg',   group: 'mineral' },
    phosphorus_mg:    { label: 'Phosphorus',   unit: 'mg',   group: 'mineral' },
    potassium_mg:     { label: 'Potassium',    unit: 'mg',   group: 'mineral' },
    sodium_mg:        { label: 'Sodium',       unit: 'mg',   group: 'mineral' },
    zinc_mg:          { label: 'Zinc',         unit: 'mg',   group: 'mineral' },
    vitamin_a_ug:     { label: 'Vitamin A',    unit: 'μg',   group: 'vitamin' },
    vitamin_b1_mg:    { label: 'Vitamin B1',   unit: 'mg',   group: 'vitamin' },
    vitamin_b2_mg:    { label: 'Vitamin B2',   unit: 'mg',   group: 'vitamin' },
    vitamin_b3_mg:    { label: 'Vitamin B3',   unit: 'mg',   group: 'vitamin' },
    vitamin_b6_mg:    { label: 'Vitamin B6',   unit: 'mg',   group: 'vitamin' },
    vitamin_b12_ug:   { label: 'Vitamin B12',  unit: 'μg',   group: 'vitamin' },
    vitamin_c_mg:     { label: 'Vitamin C',    unit: 'mg',   group: 'vitamin' },
    vitamin_d_ug:     { label: 'Vitamin D',    unit: 'μg',   group: 'vitamin' },
    vitamin_e_mg:     { label: 'Vitamin E',    unit: 'mg',   group: 'vitamin' },
    vitamin_k_ug:     { label: 'Vitamin K',    unit: 'μg',   group: 'vitamin' },
};
