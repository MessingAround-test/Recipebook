const {
  RECIPE_FILE_FORMAT,
  RECIPE_FILE_VERSION,
  buildRecipeExport,
  parseRecipeImport,
  mapRecipeFileToEditor,
  toFileIngredient,
  toFileInstruction,
  sanitizeRecipeFilename
} = require('../lib/recipeFile.ts')

const baseRecipe = require('./fixtures/recipeFileFixtures.json').baseRecipe

const buildWrapped = (overrides = {}) => ({
  format: RECIPE_FILE_FORMAT,
  version: RECIPE_FILE_VERSION,
  exportedAt: new Date().toISOString(),
  recipe: { ...baseRecipe, ...overrides }
})

describe('recipeFile export/import round-trip', () => {
  test('building an export produces the wrapper format marker', () => {
    const payload = buildRecipeExport(baseRecipe)
    expect(payload.format).toBe(RECIPE_FILE_FORMAT)
    expect(payload.version).toBe(RECIPE_FILE_VERSION)
    expect(payload.exportedAt).toBeTruthy()
    expect(payload.recipe.name).toBe(baseRecipe.name)
    expect(payload.recipe.image).toBe(baseRecipe.image)
  })

  test('export -> parse returns the same recipe data', () => {
    const payload = buildRecipeExport(baseRecipe)
    const result = parseRecipeImport(JSON.stringify(payload))
    expect(result.ok).toBe(true)
    expect(result.recipe).toEqual(buildWrapped().recipe)
  })

  test('prefilled details survive the round-trip', () => {
    const withDetails = {
      ...baseRecipe,
      time: 'medium',
      genre: 'Comfort Food',
      mealTypes: ['Dinner'],
      carbType: 'Pasta/Noodles',
      servings: 4,
      sourceUrl: 'https://example.com/recipe'
    }
    const result = parseRecipeImport(JSON.stringify(buildRecipeExport(withDetails)))
    expect(result.ok).toBe(true)
    expect(result.recipe.time).toBe('medium')
    expect(result.recipe.genre).toBe('Comfort Food')
    expect(result.recipe.mealTypes).toEqual(['Dinner'])
    expect(result.recipe.carbType).toBe('Pasta/Noodles')
    expect(result.recipe.servings).toBe(4)
    expect(result.recipe.sourceUrl).toBe('https://example.com/recipe')
  })
})

describe('recipeFile import validation', () => {
  test('rejects invalid JSON', () => {
    const result = parseRecipeImport('not json {')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  test('rejects JSON that is not an object', () => {
    expect(parseRecipeImport('[]').ok).toBe(false)
    expect(parseRecipeImport('"hi"').ok).toBe(false)
    expect(parseRecipeImport('123').ok).toBe(false)
  })

  test('rejects recipes without a name', () => {
    const result = parseRecipeImport(JSON.stringify({ format: RECIPE_FILE_FORMAT, version: 1, recipe: { ingredients: baseRecipe.ingredients } }))
    expect(result.ok).toBe(false)
  })

  test('rejects files with no usable ingredients or instructions', () => {
    expect(parseRecipeImport(JSON.stringify({ format: RECIPE_FILE_FORMAT, version: 1, recipe: { name: 'No data' } })).ok).toBe(false)
    const blankIngreds = parseRecipeImport(JSON.stringify({ name: 'Empty', ingredients: [{}, { Name: '  ' }], instructions: [{ Text: 'Boil' }] }))
    expect(blankIngreds.ok).toBe(false)
  })

  test('all-empty ingredients blank', () => {
    const result = parseRecipeImport(JSON.stringify({ name: 'Empty', ingredients: [] }))
    expect(result.ok).toBe(false)
  })

  test('rejects newer file versions', () => {
    const result = parseRecipeImport(JSON.stringify({ format: RECIPE_FILE_FORMAT, version: RECIPE_FILE_VERSION + 1, recipe: baseRecipe }))
    expect(result.ok).toBe(false)
  })

  test('accepts bare (unwrapped) recipe objects', () => {
    const result = parseRecipeImport(JSON.stringify(baseRecipe))
    expect(result.ok).toBe(true)
    expect(result.recipe.name).toBe(baseRecipe.name)
    expect(result.recipe.ingredients).toHaveLength(baseRecipe.ingredients.length)
  })
})

describe('recipeFile field mapping', () => {
  test('maps API-shaped ingredients to the canonical file shape', () => {
    expect(toFileIngredient({ name: 'Flour', quantity: 2, quantity_type: 'cups', note: 'sifted' })).toEqual({
      Name: 'Flour', Amount: 2, AmountType: 'cups', note: 'sifted'
    })
    expect(toFileIngredient({ Name: 'Salt', Amount: 1, AmountType: 'tsp' })).toEqual({
      Name: 'Salt', Amount: 1, AmountType: 'tsp'
    })
  })

  test('maps both note casings and keeps step time', () => {
    expect(toFileInstruction({ text: 'Boil water' })).toEqual({ Text: 'Boil water' })
    expect(toFileInstruction({ Text: 'Simmer', time: 10, note: 'covered' })).toEqual({ Text: 'Simmer', time: 10, note: 'covered' })
    expect(toFileInstruction({ Text: 'Simmer', Note: 'covered' })).toEqual({ Text: 'Simmer', note: 'covered' })
  })

  test('mapToEditor converts lowercase note to capital Note', () => {
    const parsed = parseRecipeImport(JSON.stringify(buildRecipeExport(baseRecipe)))
    expect(parsed.ok).toBe(true)
    const editor = mapRecipeFileToEditor(parsed.recipe)
    expect(editor.name).toBe(baseRecipe.name)
    expect(editor.ingredients[0]).toEqual({ Name: 'Spaghetti', Amount: 200, AmountType: 'grams', Note: 'dried' })
    expect(editor.instructions[0]).toEqual({ Text: 'Boil the pasta', Note: 'salt the water' })
    expect(editor.servings).toBe('')
    expect(editor.time).toBe('')
  })

  test('mapToEditor empties missing optional fields', () => {
    const result = { ok: true, recipe: { name: 'X', ingredients: [{ Name: 'A', Amount: 1, AmountType: 'each' }], instructions: [{ Text: 'B' }] } }
    const editor = mapRecipeFileToEditor(result.recipe)
    expect(editor.time).toBe('')
    expect(editor.genre).toBe('')
    expect(editor.mealTypes).toEqual([])
    expect(editor.carbType).toBe('')
    expect(editor.servings).toBe('')
    expect(editor.sourceUrl).toBe('')
  })
})

describe('recipeFile filename sanitization', () => {
  test('strips filesystem-unsafe characters', () => {
    expect(sanitizeRecipeFilename('My: Recipe? *v2/')).toBe('My Recipe v2')
  })
  test('falls back for empty names', () => {
    expect(sanitizeRecipeFilename('')).toBe('recipe')
  })
})
