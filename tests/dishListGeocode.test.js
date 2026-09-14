const {
    buildGeocodeQuery,
    countryMatches,
    locationPatch,
    buildBatchGuessMessages,
    buildOriginGuessMessages
} = require('../lib/dishLists/geocode.ts')

describe('buildGeocodeQuery', () => {
    test('joins city, region, country in order', () => {
        expect(buildGeocodeQuery({ city: 'Naples', region: 'Campania', country: 'Italy' }))
            .toBe('Naples, Campania, Italy')
    })
    test('drops duplicate place parts', () => {
        expect(buildGeocodeQuery({ city: 'Oaxaca', region: 'Oaxaca', country: 'Mexico' }))
            .toBe('Oaxaca, Mexico')
    })
    test('country only', () => {
        expect(buildGeocodeQuery({ country: 'Japan' })).toBe('Japan')
    })
    test('empty when nothing supplied', () => {
        expect(buildGeocodeQuery({})).toBe('')
    })
})

describe('countryMatches', () => {
    test('accepts a Nominatim result inside the country', () => {
        expect(countryMatches('Naples, Metropolitan City of Naples, Campania, Italy', 'Italy')).toBe(true)
    })
    test('rejects a result outside the country (ambiguous guess)', () => {
        expect(countryMatches('Naples, New York, United States', 'Italy')).toBe(false)
    })
    test('always true without a country', () => {
        expect(countryMatches('Anywhere', undefined)).toBe(true)
    })
    test('matches via the structured address country when the display name lacks it', () => {
        expect(countryMatches('Campania', 'Italy', 'Italy')).toBe(true)
        expect(countryMatches('四川省', 'China', 'China')).toBe(true)
    })
    test('matches known country aliases', () => {
        expect(countryMatches('Texas, United States', 'United States of America')).toBe(true)
        expect(countryMatches('Ankara, Türkiye', 'Turkiye')).toBe(true)
    })
    test('is case and accent insensitive', () => {
        expect(countryMatches('Oaxaca, México', 'Mexico')).toBe(true)
    })
})

describe('locationPatch', () => {
    test('sets region/city only when present', () => {
        const patch = locationPatch({ lat: 1.5, lng: 2.5, region: 'Campania', city: 'Naples' })
        expect(patch['location.lat']).toBe(1.5)
        expect(patch['location.lng']).toBe(2.5)
        expect(patch['location.region']).toBe('Campania')
        expect(patch['location.city']).toBe('Naples')
    })
    test('omits missing region/city for the country fallback', () => {
        const patch = locationPatch({ lat: 1.5, lng: 2.5, country: 'Italy' })
        expect(patch['location.region']).toBeUndefined()
        expect(patch['location.city']).toBeUndefined()
    })
    test('omits country unless explicitly asked', () => {
        const patch = locationPatch({ lat: 1, lng: 2, country: 'Italy' })
        expect(patch['location.country']).toBeUndefined()
    })
    test('includes country when requested', () => {
        const patch = locationPatch({ lat: 1, lng: 2, country: 'Italy', region: 'Lazio' }, { includeCountry: true })
        expect(patch['location.country']).toBe('Italy')
        expect(patch['location.region']).toBe('Lazio')
    })
})

describe('buildBatchGuessMessages', () => {
    test('numbers each dish and includes country', () => {
        const messages = buildBatchGuessMessages([
            { name: 'Pizza Napoletana', category: 'Pizza', country: 'Italy' },
            { name: 'Siu mei', category: 'Meat Dish', country: 'China' }
        ])
        expect(messages).toHaveLength(2)
        expect(messages[0].role).toBe('system')
        expect(messages[0].content).toContain('most famous')
        expect(messages[1].content).toContain('1.')
        expect(messages[1].content).toContain('Pizza Napoletana')
        expect(messages[1].content).toContain('Siu mei')
        expect(messages[1].content).toContain('China')
    })
    test('feeds the blurb in as regional evidence', () => {
        const messages = buildBatchGuessMessages([{
            name: 'Siu mei',
            category: 'Meat Dish',
            country: 'China',
            description: 'Siu mei is a Chinese roast platter, typically Cantonese, slow-roasted to a caramelized finish.'
        }])
        expect(messages[1].content).toContain('Description:')
        expect(messages[1].content).toContain('Cantonese')
    })
})

describe('buildOriginGuessMessages', () => {
    test('numbers each recipe and includes country/cuisine/ingredient cues', () => {
        const messages = buildOriginGuessMessages([
            { name: 'Pho Bo', genre: 'Vietnamese', ingredients: 'beef, rice noodles', country: 'Vietnam' },
            { name: 'Tacos al Pastor', genre: 'Mexican' }
        ])
        expect(messages).toHaveLength(2)
        expect(messages[0].role).toBe('system')
        expect(messages[0].content).toContain('country')
        expect(messages[1].content).toContain('1.')
        expect(messages[1].content).toContain('Pho Bo')
        expect(messages[1].content).toContain('Cuisine: Vietnamese')
        expect(messages[1].content).toContain('Known country: Vietnam')
        expect(messages[1].content).toContain('Tacos al Pastor')
    })
    test('truncates long descriptions used as origin evidence', () => {
        const messages = buildOriginGuessMessages([{ name: 'Arepas', description: 'x'.repeat(1000) }])
        expect(messages[1].content).toContain('Description:')
        expect(messages[1].content.length).toBeLessThan(1200)
    })
})
