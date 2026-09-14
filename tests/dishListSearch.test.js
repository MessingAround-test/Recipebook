const { extractResultUrl, parseDuckDuckGoHtml, hasNonEnglishTld } = require('../lib/dishLists/search.ts')

const FIXTURE = `
<html><body>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.recipetineats.com%2Fpizza&rut=abc">Best Pizza Recipe</a>
  <a class="result__snippet">A classic pizza recipe.</a>
</div>
<div class="result">
  <a class="result__a" href="https://www.example-blog.com/pizza-recipe">Example Blog</a>
  <a class="result__snippet">Another option.</a>
</div>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.recipetineats.com%2Fpizza&rut=dup">Duplicate</a>
  <a class="result__snippet">dup</a>
</div>
<div class="result result--ad">
  <a class="result__a" href="//duckduckgo.com/y.js?ad_domain=ebay.com&ad_provider=bingv7aa&u3=https%3A%2F%2Fwww.bing.com%2Faclick">Sponsored ad</a>
  <a class="result__snippet">Buy stuff</a>
</div>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.tasteatlas.com%2Fpizza-napoletana">Pizza Napoletana - TasteAtlas</a>
  <a class="result__snippet">TasteAtlas page</a>
</div>
<div class="result">
  <a class="result__a" href="https://www.pizza-rezept.de/neapolitanische-pizza">Neapolitanische Pizza</a>
  <a class="result__snippet">auf Deutsch</a>
</div>
</body></html>
`

describe('extractResultUrl', () => {
    test('unwraps duckduckgo redirect', () => {
        expect(extractResultUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fx'))
            .toBe('https://example.com/x')
    })
    test('passes through plain urls', () => {
        expect(extractResultUrl('https://example.com/y')).toBe('https://example.com/y')
    })
    test('handles empty', () => {
        expect(extractResultUrl(undefined)).toBe('')
    })
})

describe('parseDuckDuckGoHtml', () => {
    test('parses results and dedupes by resolved url', () => {
        const results = parseDuckDuckGoHtml(FIXTURE)
        expect(results).toHaveLength(2)
        expect(results.map(r => r.url)).toContain('https://www.recipetineats.com/pizza')
    })
    test('orders preferred recipe domains first', () => {
        const results = parseDuckDuckGoHtml(FIXTURE)
        expect(results[0].url).toContain('recipetineats.com')
    })
    test('drops DuckDuckGo ads/tracking links', () => {
        const results = parseDuckDuckGoHtml(FIXTURE)
        expect(results.some(r => /duckduckgo\.com/.test(r.url))).toBe(false)
        expect(results.some(r => /ebay|bing/.test(r.url))).toBe(false)
    })
    test('drops no-web-extract domains like TasteAtlas', () => {
        const results = parseDuckDuckGoHtml(FIXTURE)
        expect(results.some(r => /tasteatlas\.com/.test(r.url))).toBe(false)
    })
    test('drops non-English country domains', () => {
        const results = parseDuckDuckGoHtml(FIXTURE)
        expect(results.some(r => /\.de\//.test(r.url))).toBe(false)
        expect(hasNonEnglishTld('https://example.fr/recette')).toBe(true)
        expect(hasNonEnglishTld('https://example.com/recipe')).toBe(false)
    })
    test('empty input yields []', () => {
        expect(parseDuckDuckGoHtml('')).toEqual([])
    })
})
