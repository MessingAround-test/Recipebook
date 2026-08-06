import { createContext, useContext } from 'react';

export interface PlannerApi {
    isAuthed: boolean;
    loading: boolean;
    saving: boolean;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    exporting: boolean;
    analyzing: boolean;
    analysis: any;
    allRecipes: any[];
    recipeOptions: { label: string; value: string }[];
    plan: any;
    startDate: string;
    numDays: number;
    dates: string[];
    endDate: string;
    draftStart: string;
    setDraftStart: (v: string) => void;
    draftEnd: string;
    setDraftEnd: (v: string) => void;
    rangeError: boolean;
    setRangeError: (v: boolean) => void;
    changeStart: (n: number) => void;
    applyPreset: (d: string, days?: number) => void;
    applyDraftRange: () => void;
    onRangeKeyDown: (e: any) => void;
    handleSave: () => void;
    handleExport: () => void;
    addEverydayItem: (recipeId: string) => void;
    updateEverydayQty: (idx: number, qty: number) => void;
    removeEverydayItem: (idx: number) => void;
    togglePantryPlacement: (itemIndex: number, day: string, mealType: string) => void;
    newEverydayQty: number;
    setNewEverydayQty: (v: number) => void;
    showRecipeModal: boolean;
    openModal: (onlySnacks?: boolean, target?: { day: string | null; mealType: string | null; pantry?: boolean } | null) => void;
    closeModal: () => void;
    modalOnlySnacks: boolean;
    setModalOnlySnacks: (v: boolean) => void;
    modalGroupBy: string;
    setModalGroupBy: (v: any) => void;
    modalMealFilters: Set<string>;
    setModalMealFilters: (v: any) => void;
    toggleMealFilter: (m: string) => void;
    modalSearch: string;
    setModalSearch: (v: string) => void;
    modalSelectedRecipeIds: Set<string>;
    handleToggleModalRecipe: (id: string) => void;
    confirmModalRecipes: () => void;
    browseTarget: { day: string | null; mealType: string | null; pantry?: boolean } | null;
    removePlannedRecipe: (id: string) => void;
    addAverageMeal: () => void;
    mergeTwoItems: (a: string, b: string) => void;
    splitRecipe: (id: string, amount?: number) => void;
    combinePendingId: string | null;
    setCombinePendingId: (v: string | null) => void;
    pendingItem: any;
    isPendingCard: (r: any) => boolean;
    handleDragStart: (e: any, item: any) => void;
    handleDragOver: (e: any) => void;
    handleDrop: (e: any, day: string, meal?: string | null) => void;
    handleSplitDrop: (e: any) => void;
    handleCombineDrop: (e: any) => void;
    carbSuggestions: any[];
    undecidedRecipes: any[];
    mobilePoolOpen: boolean;
    setMobilePoolOpen: (v: boolean) => void;
    setPlan: (v: any) => void;
}

export const PlannerContext = createContext<PlannerApi | null>(null);

export function usePlanner(): PlannerApi {
    const ctx = useContext(PlannerContext);
    if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
    return ctx;
}
