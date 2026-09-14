const { parseDuckDuckGoHtml, searchRecipeSources } = require('../lib/dishLists/search.ts')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function raw(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } })
    const html = await res.text()
    const parsed = parseDuckDuckGoHtml(html)
    console.log('\nQUERY:', query, '| html len', html.length, '| parsed', parsed.length)
    console.log('bestofvegan in html:', html.includes('bestofvegan'))
    parsed.forEach((p, i) => console.log(` ${i}: ${p.url}`))
    return { html, parsed }
}

test('debug vori vori', async () => {
    await raw('Vori-vori pescatarian vegetarian recipe')
    const viaFn = await searchRecipeSources('Vori-vori pescatarian vegetarian recipe', 20)
    console.log('\nsearchRecipeSources returned:', viaFn.length)
    console.log('has bestofvegan:', viaFn.some(r => /bestofvegan/.test(r.url)))
}, 60000)
