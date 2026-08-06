import { useCallback, useState } from 'react';
import { fetchRecipes } from './dataLayer';
import { Recipe } from './types';

export function useRecipes() {
    const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);

    const loadRecipes = useCallback(async () => {
        try {
            setAllRecipes(await fetchRecipes());
        } catch (err) {
            console.error(err);
        }
    }, []);

    return { allRecipes, loadRecipes };
}
