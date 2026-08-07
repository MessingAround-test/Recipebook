export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type MealType = typeof MEALS[number];
export const MAX_DAYS = 14;

export interface PlannedRecipeItem {
    recipe_id?: string;
    recipe_name: string;
    servings: number;
    day: string; // YYYY-MM-DD date, or 'Undecided'
    mealType: string;
    carbType?: string;
    isLeftover?: boolean;
    // Placeholder counted at "average meal" values (1/3 macro + 15% micro targets) in analysis.
    isAverageMeal?: boolean;
    id?: string; // temporary client id
    _id?: string; // server id
}

export interface EverydayItem {
    name: string;
    quantity: number; // weekly total
    quantity_unit?: string;
    recipe_id?: string;
}

export interface Plan {
    defaultServings: number;
    plannedRecipes: PlannedRecipeItem[];
    everydayItems: EverydayItem[];
    numDays?: number;
    // Visual-only pantry pool placements: `${day}|${mealType}` -> everydayItems indexes
    pantryPlacements?: Record<string, number[]>;
}

export interface Recipe {
    _id: string;
    name: string;
    image?: string;
    genre?: string;
    mealTypes?: string[];
    carbType?: string;
    servings?: number;
    ingredients?: any[];
    time?: string;
    creator_username?: string;
}

export interface AnalysisRecipe {
    id?: string;
    recipe_id?: string;
    day?: string;
    mealType?: string;
    cost: number;
    isExpensive?: boolean;
    isLowNutrition?: boolean;
    costPercentage?: number;
}

export interface NutrientCoverageItem {
    key: string;
    label: string;
    unit: string;
    group: 'macro' | 'mineral' | 'vitamin';
    value: number;
    target: number;
    pct: number;
    weight: number;
    isLimit: boolean;
}

export interface SuggestionFood {
    name: string;
    pct: number;
}

export interface SuggestionRecipe {
    _id: string;
    name: string;
    image?: string;
    pct: number;
}

export interface NutrientSuggestion {
    key: string;
    label: string;
    pct: number;
    foods: SuggestionFood[];
    recipes: SuggestionRecipe[];
}

export interface PlanAnalysis {
    numDays: number;
    weeklyTotals: Record<string, number>;
    dailyAverages: Record<string, number>;
    dailyTargets: Record<string, number>;
    deficiencies: { key: string; pct: number }[];
    nutrientCoverage?: NutrientCoverageItem[];
    projectedScore?: number | null;
    healthScoreConfig?: any;
    suggestions?: NutrientSuggestion[];
    totalCost: number;
    averageDailyCost: number;
    totalCostPerPerson: number;
    averageDailyCostPerPerson: number;
    numMissingSlots: number;
    everydayCost: number;
    dailyEverydayCost: number;
    recipeAnalysis: AnalysisRecipe[];
}

export interface BrowseTarget {
    day: string | null;
    mealType: MealType | null;
    pantry?: boolean; // confirm should add selected recipes to the Pantry Pool
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DayCoverageItem {
    key: string;
    label: string;
    unit: string;
    pct: number;
    value: number;
    target: number;
}

export interface DaySuggestion {
    type: 'recipe' | 'pantry';
    recipe?: Recipe;
    pantryName?: string;
    // Grams per day for pantry items (added to the pool at this amount).
    quantity?: number;
    mealSlot: string | null;
    reason: string;
    // Per-person, per-day nutrient contribution as % of daily target.
    nutrientDelta?: { key: string; label: string; pct: number }[];
}

export interface DaySuggestionResponse {
    dayCoverage: DayCoverageItem[];
    plannedMeals: { mealType: string; name: string; carbType?: string }[];
    emptySlots: string[];
    recommendations: DaySuggestion[];
}

export interface GeneratedRecipe {
    name: string;
    ingredients: { Name: string; Amount: string | number; AmountType: string; Note?: string }[];
    instructions: { Text: string; Note?: string }[];
    time?: string;
    genre?: string;
    mealTypes?: string[];
    servings?: number;
    carbType?: string;
    suggestedSlot: string;
    // Per-person, per-day contribution as % of daily target (for preview).
    nutrientDelta?: { key: string; label: string; pct: number }[];
}
