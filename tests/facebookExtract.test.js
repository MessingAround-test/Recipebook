const { decodeEntities, extractMetaContent, extractOembedCaption, isFacebookUrl } = require('../lib/facebookExtract');

describe('isFacebookUrl', () => {
    test('accepts facebook share, reel, watch, video and fb.watch links', () => {
        expect(isFacebookUrl('https://www.facebook.com/share/r/1DZmXQa839/')).toBe(true);
        expect(isFacebookUrl('https://www.facebook.com/reel/1683486732705757/?rdid=abc')).toBe(true);
        expect(isFacebookUrl('https://www.facebook.com/watch/?v=123456')).toBe(true);
        expect(isFacebookUrl('https://www.facebook.com/100028285638947/videos/1683486732705757/')).toBe(true);
        expect(isFacebookUrl('https://fb.watch/ABC123/')).toBe(true);
        expect(isFacebookUrl('https://m.facebook.com/share/v/xyz/')).toBe(true);
    });

    test('rejects non-facebook links and garbage', () => {
        expect(isFacebookUrl('https://www.recipetineats.com/chicken/')).toBe(false);
        expect(isFacebookUrl('https://fbwatch.evil.com/x')).toBe(false);
        expect(isFacebookUrl('not a url')).toBe(false);
        expect(isFacebookUrl('')).toBe(false);
        expect(isFacebookUrl(undefined)).toBe(false);
    });
});

describe('decodeEntities', () => {
    test('decodes hex and decimal numeric entities', () => {
        expect(decodeEntities('&#x201c;Lazy&#x201d;')).toBe('\u201cLazy\u201d');
        expect(decodeEntities('2.1M views &#xb7; 48K reactions')).toBe('2.1M views \u00b7 48K reactions');
    });
});

describe('decodeEntities (named entities)', () => {
    test('decodes named entities with &amp; handled last', () => {
        expect(decodeEntities('1 &amp; 2')).toBe('1 & 2');
        expect(decodeEntities('&quot;quoted&quot; &amp;&lt;tag&gt;')).toBe('"quoted" &<tag>');
        expect(decodeEntities('&#x2665;')).toBe('\u2665');
        expect(decodeEntities("it&#39;s")).toBe("it's");
    });

    test('returns empty string for empty input', () => {
        expect(decodeEntities('')).toBe('');
        expect(decodeEntities(undefined)).toBe('');
    });
});

describe('extractMetaContent', () => {
    const realPageHtml = '<meta property="og:type" content="video.other" /><meta property="og:title" content="2.1M views &#xb7; 48K reactions | POV: One-Pot &#x201c;Lazy Ramen&#x201d; | dietitianrose" /><meta property="og:description" content="POV: One-Pot &#x201c;Lazy Ramen&#x201d; \n1 heaped tsp peanut..." /><meta property="og:image" content="https://scontent.fsyd3-2.fna.fbcdn.net/v/t51.82787-15/747513038_n.jpg?_nc_cat=103&amp;oe=6A9E9903" />';

    test('finds og:description from real fb page markup and decodes entities', () => {
        expect(extractMetaContent(realPageHtml, 'og:description')).toBe('POV: One-Pot \u201cLazy Ramen\u201d \n1 heaped tsp peanut...');
    });

    test('finds og:image and decodes the URL query params', () => {
        expect(extractMetaContent(realPageHtml, 'og:image')).toBe('https://scontent.fsyd3-2.fna.fbcdn.net/v/t51.82787-15/747513038_n.jpg?_nc_cat=103&oe=6A9E9903');
    });

    test('handles content-before-property ordering', () => {
        const html = '<meta content="thumb.jpg" property="og:image" />';
        expect(extractMetaContent(html, 'og:image')).toBe('thumb.jpg');
    });

    test('og:image does not match og:image:alt', () => {
        const html = '<meta property="og:image:alt" content="alt text" />';
        expect(extractMetaContent(html, 'og:image')).toBe('');
    });

    test('returns empty string on miss or bad input', () => {
        expect(extractMetaContent('<html></html>', 'og:title')).toBe('');
        expect(extractMetaContent('', 'og:title')).toBe('');
        expect(extractMetaContent(undefined, 'og:title')).toBe('');
    });
});

describe('extractOembedCaption', () => {
    test('pulls the full caption out of the oembed fb-video embed', () => {
        const embed = '<div id="fb-root"></div>\n<script async="1" defer="1" crossorigin="anonymous" src="https://connect.facebook.net/en_GB/sdk.js#xfbml=1&amp;version=v26.0"></script><div class="fb-video" data-href="https://www.facebook.com/100028285638947/videos/1683486732705757/"><blockquote cite="https://www.facebook.com/reel/1683486732705757/" class="fb-xfbml-parse-ignore"><a href="https://www.facebook.com/reel/1683486732705757/"></a><p>POV: One-Pot \u201cLazy Ramen\u201d \u2665\ufe0f\n\nYou\u2019ll need (Serves 1-2):\nFor the broth:\n\u00bd tbsp neutral oil\n1 garlic clove, minced\n\u00bd thumb-sized piece ginger, grated\n\n#ramen #lazyramen</p>Posted by <a href="https://www.facebook.com/people/dietitianrose/100028285638947/">dietitianrose</a> on Tuesday, July 14, 2026</blockquote></div>';

        const caption = extractOembedCaption(embed);

        expect(caption).toContain('POV: One-Pot \u201cLazy Ramen\u201d');
        expect(caption).toContain('You\u2019ll need (Serves 1-2):');
        expect(caption).toContain('\u00bd tbsp neutral oil');
        expect(caption).toContain('1 garlic clove, minced');
        expect(caption).toContain('#ramen #lazyramen');
        expect(caption).not.toContain('Posted by');
        expect(caption).not.toContain('dietitianrose</a>');
        expect(caption).not.toContain('<p>');
    });

    test('keeps <br> tags as newlines', () => {
        const embed = '<blockquote class="fb-xfbml-parse-ignore"><a href="#"></a><p>step one<br/>step two<br>step three</p></blockquote>';
        expect(extractOembedCaption(embed)).toBe('step one\nstep two\nstep three');
    });

    test('falls back to the first <p> when the blockquote shape differs', () => {
        const embed = '<div><p>Plain caption text</p></div>';
        expect(extractOembedCaption(embed)).toBe('Plain caption text');
    });

    test('returns empty string when there is no caption paragraph', () => {
        expect(extractOembedCaption('<div id="fb-root"></div>')).toBe('');
        expect(extractOembedCaption('')).toBe('');
        expect(extractOembedCaption(undefined)).toBe('');
    });
});
