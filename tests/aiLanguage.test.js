const { AI_LANGUAGES, DEFAULT_AI_LANGUAGE, sanitizeAiLanguage, languageInstructionBlock } = require('../lib/aiLanguage');

describe('AI language constants', () => {
    test('English is a supported language and the default', () => {
        expect(AI_LANGUAGES).toContain('English');
        expect(DEFAULT_AI_LANGUAGE).toBe('English');
    });

    test('language list has no duplicates', () => {
        expect(new Set(AI_LANGUAGES).size).toBe(AI_LANGUAGES.length);
    });
});

describe('sanitizeAiLanguage', () => {
    test('returns supported languages unchanged', () => {
        expect(sanitizeAiLanguage('English')).toBe('English');
        expect(sanitizeAiLanguage('French')).toBe('French');
        expect(sanitizeAiLanguage('Japanese')).toBe('Japanese');
    });

    test('defaults to English when nothing is set', () => {
        expect(sanitizeAiLanguage(undefined)).toBe('English');
        expect(sanitizeAiLanguage(null)).toBe('English');
        expect(sanitizeAiLanguage('')).toBe('English');
    });

    test('defaults to English for unsupported values', () => {
        expect(sanitizeAiLanguage('Klingon')).toBe('English');
        expect(sanitizeAiLanguage('english')).toBe('English');
        expect(sanitizeAiLanguage(42)).toBe('English');
        expect(sanitizeAiLanguage(['English'])).toBe('English');
    });
});

describe('languageInstructionBlock', () => {
    test('instructs the model to write output in the given language', () => {
        const block = languageInstructionBlock('Spanish');
        expect(block).toContain('in Spanish');
        expect(block).toContain('translate it faithfully into Spanish');
    });

    test('forbids translating enum values and JSON keys', () => {
        const block = languageInstructionBlock('French');
        expect(block).toContain('NEVER translate JSON keys');
        expect(block).toContain("'AmountType'");
        expect(block).toContain("'carbType'");
    });

    test('omits changes fields unless includeChanges is set', () => {
        expect(languageInstructionBlock('English')).not.toContain("'originalName'");
        const remix = languageInstructionBlock('English', { includeChanges: true });
        expect(remix).toContain("'originalName'");
        expect(remix).toContain("'alternatives'");
    });
});
