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

const CARD_FIXTURE = `
<html><body>
<div class="card top-list-primary">
    <div class="card__visual">
        <a href="/zagorski-mlinci" class="card__visual-link"><img src="https://cdn.tasteatlas.com/images/dishes/aaa.jpg?w=1476"></a>
    </div>
    <div class="card__order">01</div>
    <a href="/zagorski-mlinci"><h3 class="secondary">Zagorski mlinci</h3></a>
    <div class="card__location"><a href="/zagorje" class="fw-600">Zagorje, Croatia</a></div>
    <div class="card__info flex"><span class="card__info-value fw-600">4.6</span></div>
    <div class="card__description"><p>Mlinci are a traditional Croatian cross between pasta and flatbread served with roasted meat dishes.</p></div>
    <div class="card__section"><div class="card__subtitle">Best restaurants</div><div><a href="verglec">Verglec (Croatia)</a></div></div>
</div>
<div class="card top-list-primary">
    <div class="card__visual">
        <a href="/hummus-beiruti" class="card__visual-link"><img src="https://cdn.tasteatlas.com/images/dishes/bbb.jpg?w=1476"></a>
    </div>
    <div class="card__order">02</div>
    <a href="/hummus-beiruti"><h3 class="secondary">Hummus Beiruti</h3></a>
    <div class="card__location"><a href="/lebanon" class="fw-600">Lebanon</a></div>
    <div class="card__info flex"><span class="card__info-value fw-600">4.4</span></div>
    <div class="card__description"><p>Hummus Beiruti is a Lebanese version of hummus made with extra garlic, cumin, and chili peppers.</p></div>
</div>
<div class="card top-list-secondary">
    <div class="flex-1">
        <div class="card__order">11</div>
        <a href="/aligot"><h3 class="secondary">Aligot</h3></a>
        <div class="card__location">
            <a href="/aubrac" class="fw-600">Aubrac, France</a>
            <img src="https://cdn.tasteatlas.com/Images/Emblems/emblem.png?w=26" class="card__location-emblem" alt="Aubrac, France">
        </div>
        <div class="card__info flex"><span class="card__info-value fw-600">4.3</span></div>
    </div>
    <div>
        <div class="card__visual">
            <a href="/aligot" class="card__visual-link"><img src="https://cdn.tasteatlas.com/Images/Dishes/aligot.jpg?w=604"></a>
        </div>
    </div>
</div>
</body></html>
`

describe('parseTasteAtlasList (current top-list cards)', () => {
    test('extracts rank, name, rating, location, description and image from primary cards', () => {
        const items = parseTasteAtlasList(CARD_FIXTURE)
        expect(items).toHaveLength(3)

        const mlinci = items.find(i => i.slug === 'zagorski-mlinci')
        expect(mlinci).toBeTruthy()
        expect(mlinci.name).toBe('Zagorski mlinci')
        expect(mlinci.rank).toBe(1)
        expect(mlinci.rating).toBeCloseTo(4.6)
        expect(mlinci.location.country).toBe('Croatia')
        expect(mlinci.location.region).toBe('Zagorje')
        expect(mlinci.description).toContain('Croatian cross between pasta and flatbread')
        expect(mlinci.imageOriginalUrl).toContain('aaa.jpg')
        expect(mlinci.sourceUrl).toBe('https://www.tasteatlas.com/zagorski-mlinci')
    })

    test('merges compact secondary cards and keeps them ordered by rank', () => {
        const items = parseTasteAtlasList(CARD_FIXTURE)
        expect(items.map(i => i.slug)).toEqual(['zagorski-mlinci', 'hummus-beiruti', 'aligot'])

        const aligot = items.find(i => i.slug === 'aligot')
        expect(aligot.rank).toBe(11)
        expect(aligot.rating).toBeCloseTo(4.3)
        expect(aligot.location.country).toBe('France')
        expect(aligot.location.region).toBe('Aubrac')
        // The dish photo follows the location emblem in compact cards.
        expect(aligot.imageOriginalUrl).toContain('aligot.jpg')
        expect(aligot.imageOriginalUrl).not.toContain('Emblems')
        expect(aligot.description).toBeUndefined()
    })

    test('ignores restaurant links inside a card', () => {
        const items = parseTasteAtlasList(CARD_FIXTURE)
        expect(items.map(i => i.slug)).not.toContain('verglec')
    })

    test('parses a bare "Load more" secondary fragment', () => {
        const fragment = `
            <div class="card top-list-secondary">
                <div class="flex-1">
                    <div class="card__order">11</div>
                    <a href="/bolani"><h3 class="secondary">Bolani</h3></a>
                    <div class="card__info flex"><span class="card__info-value">4.3</span></div>
                </div>
            </div>`
        const items = parseTasteAtlasList(fragment)
        expect(items).toHaveLength(1)
        expect(items[0].slug).toBe('bolani')
        expect(items[0].rank).toBe(11)
        expect(items[0].rating).toBeCloseTo(4.3)
    })
})

