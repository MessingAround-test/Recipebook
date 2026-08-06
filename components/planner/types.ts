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

export interface PlanAnalysis {
    numDays: number;
    weeklyTotals: Record<string, number>;
    dailyAverages: Record<string, number>;
    dailyTargets: Record<string, number>;
    deficiencies: { key: string; pct: number }[];
    nutrientCoverage?: NutrientCoverageItem[];
    projectedScore?: number | null;
    healthScoreConfig?: any;
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
