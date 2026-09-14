const {
    parseTasteAtlasList,
    parseDishUrlList,
    parseLocationText,
    slugFromUrl,
    resolveTasteAtlasUrl
} = require('../lib/dishLists/tasteAtlas.ts')

const FIXTURE = `
<html><head><base href="/"></head><body>
<div class="box-holder top-row-no-margin">
    <div class="top-container">
        <a class="img-holder" href="pizza-napoletana" target="_blank">
            <img class="img-hover" src="https://cdn.tasteatlas.com/images/dishes/785295d4ab6f4f0bab43d5fcf2e123b6.jpg?m=awards_desk_m">
            <div class="order">2</div>
        </a>
    </div>
    <a class="content-holder content" href="pizza-napoletana" target="_blank">
        <div class="subtitle">Pizza</div>
        <div class="title">Pizza Napoletana</div>
        <div class="rating"><i class="ta-star"></i><span>4.58</span></div>
        <div class="text flex">
            <img src="https://cdn.tasteatlas.com/Images/Emblems/8f1e450866be477a91351ac2d986e8ef.png?m=awards_flag_xs">
            <span>Italy</span>
        </div>
    </a>
    <div class="content-bottom">
        <div class="label">Most Iconic</div>
        <a class="bottom-cta" href="pizza-napoletana/recipe" target="_blank">View Authentic Recipe</a>
    </div>
</div>
<div class="box-holder top-row-no-margin">
    <div class="top-container">
        <a class="img-holder" href="quesabirria" target="_blank">
            <img class="img-hover" src="https://cdn.tasteatlas.com/images/dishes/abc.jpg?m=awards_desk_m">
            <div class="order">9</div>
        </a>
    </div>
    <a class="content-holder content" href="quesabirria" target="_blank">
        <div class="subtitle">Street Food</div>
        <div class="title">Quesabirria</div>
        <div class="rating"><span>4.49</span></div>
        <div class="text flex"><span>Oaxaca, Mexico</span></div>
    </a>
</div>
</body></html>
`

describe('parseTasteAtlasList', () => {
    test('parses rank, name, category, rating, country, image and source', () => {
        const items = parseTasteAtlasList(FIXTURE)
        expect(items).toHaveLength(2)

        const pizza = items.find(i => i.slug === 'pizza-napoletana')
        expect(pizza).toBeTruthy()
        expect(pizza.name).toBe('Pizza Napoletana')
        expect(pizza.category).toBe('Pizza')
        expect(pizza.rank).toBe(2)
        expect(pizza.rating).toBeCloseTo(4.58)
        expect(pizza.location.country).toBe('Italy')
        expect(pizza.imageOriginalUrl).toContain('785295d4ab6f4f0bab43d5fcf2e123b6.jpg')
        expect(pizza.sourceUrl).toBe('https://www.tasteatlas.com/pizza-napoletana')
        expect(pizza.recipeSourceUrl).toBe('https://www.tasteatlas.com/pizza-napoletana/recipe')
    })

    test('splits a "city, country" location line', () => {
        const items = parseTasteAtlasList(FIXTURE)
        const birria = items.find(i => i.slug === 'quesabirria')
        expect(birria.location.country).toBe('Mexico')
        expect(birria.location.city).toBe('Oaxaca')
        expect(birria.recipeSourceUrl).toBeUndefined()
    })

    test('returns empty for empty / junk input', () => {
        expect(parseTasteAtlasList('')).toEqual([])
        expect(parseTasteAtlasList('<html><body>nothing</body></html>')).toEqual([])
    })
})

describe('parseLocationText', () => {
    test('single part is the country', () => {
        expect(parseLocationText('Italy')).toEqual({ country: 'Italy' })
    })
    test('two parts split place and country', () => {
        expect(parseLocationText('Oaxaca, Mexico')).toEqual({ country: 'Mexico', region: 'Oaxaca', city: 'Oaxaca' })
    })
    test('blank yields empty object', () => {
        expect(parseLocationText('')).toEqual({})
    })
})

describe('slug + url helpers', () => {
    test('slugFromUrl strips origin, query and slash', () => {
        expect(slugFromUrl('https://www.tasteatlas.com/pizza-napoletana/')).toBe('pizza-napoletana')
        expect(slugFromUrl('pizza-napoletana/recipe')).toBe('recipe')
    })
    test('resolveTasteAtlasUrl resolves against root', () => {
        expect(resolveTasteAtlasUrl('bori-bori/recipe')).toBe('https://www.tasteatlas.com/bori-bori/recipe')
        expect(resolveTasteAtlasUrl('https://cdn.tasteatlas.com/x.jpg')).toBe('https://cdn.tasteatlas.com/x.jpg')
    })
})

describe('parseDishUrlList', () => {
    test('builds named items from pasted urls/slugs and dedupes', () => {
        const items = parseDishUrlList('https://www.tasteatlas.com/pizza-napoletana\npizza-napoletana\ncarbonara')
        expect(items).toHaveLength(2)
        expect(items[0].name).toBe('Pizza Napoletana')
        expect(items[0].sourceUrl).toBe('https://www.tasteatlas.com/pizza-napoletana')
        expect(items[1].name).toBe('Carbonara')
    })
})

const STANDARD_FIXTURE = `
<html><body>
<div class="item">
  <a class="img-link" href="banh-mi"><img src="https://cdn.tasteatlas.com/images/dishes/banh.jpg"></a>
  <h3><a href="banh-mi">Bánh mì</a></h3>
  <div class="subtitle">Sandwich</div>
  <div class="rating">4.5</div>
  <div class="location"><span>South Central Coast</span><a href="/vietnam">Vietnam</a></div>
  <p class="description">Bánh mì is a traditional Vietnamese sandwich made with a baguette and savoury fillings.</p>
  <a class="recipe-link" href="banh-mi/recipe">View Authentic Recipe</a>
</div>
<div class="item">
  <a class="img-link" href="pho-bo"><img src="https://cdn.tasteatlas.com/images/dishes/pho.jpg"></a>
  <h3><a href="pho-bo">Phở bò</a></h3>
  <div class="rating">4.4</div>
  <div class="location"><a href="/vietnam">Vietnam</a></div>
  <p class="description">Phở bò is a beef noodle soup with a clear, aromatic broth.</p>
</div>
</body></html>
`

describe('parseTasteAtlasList (standard template)', () => {
    test('extracts name, category, rating, region, country, description and image', () => {
        const items = parseTasteAtlasList(STANDARD_FIXTURE)
        expect(items).toHaveLength(2)

        const banh = items.find(i => i.slug === 'banh-mi')
        expect(banh.name).toBe('Bánh mì')
        expect(banh.category).toBe('Sandwich')
        expect(banh.rating).toBeCloseTo(4.5)
        expect(banh.location.country).toBe('Vietnam')
        expect(banh.location.region).toBe('South Central Coast')
        expect(banh.description).toContain('traditional Vietnamese sandwich')
        expect(banh.imageOriginalUrl).toContain('banh.jpg')
        expect(banh.recipeSourceUrl).toBe('https://www.tasteatlas.com/banh-mi/recipe')
    })

    test('does not create phantom items from country links', () => {
        const items = parseTasteAtlasList(STANDARD_FIXTURE)
        expect(items.map(i => i.slug).sort()).toEqual(['banh-mi', 'pho-bo'])
    })
})

