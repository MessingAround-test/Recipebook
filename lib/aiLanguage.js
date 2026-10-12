// Languages AI recipe generation (remix) may output. Single source of truth:
// used by the User model enum, the profile settings select, and the API
// sanitiser. Profiles with no ai_language set fall back to English.
export const AI_LANGUAGES = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Polish',
    'Turkish',
    'Japanese',
    'Korean',
    'Chinese',
    'Hindi',
    'Arabic',
];

export const DEFAULT_AI_LANGUAGE = 'English';

/**
 * Returns a value that is safe to use as the AI output language: the value
 * itself when it is a supported language, otherwise the English default.
 */
export const sanitizeAiLanguage = (value) => {
    return AI_LANGUAGES.includes(value) ? value : DEFAULT_AI_LANGUAGE;
};

/**
 * Prompt block instructing the model which language to write human-readable
 * output in. Enum/whitelist values must stay in their specified English form
 * so server-side validation keeps passing. Pass `includeChanges` for prompts
 * that return a 'changes' array (remix adaptation).
 */
export const languageInstructionBlock = (language, { includeChanges = false } = {}) => {
    const readable = includeChanges
        ? `the recipe 'name', every ingredient 'Name' and 'Note', every instruction 'Text' and 'Note', and every text field in 'changes' ('originalName', 'newName', 'newNote', 'reason', 'originalText', 'newText', 'alternatives')`
        : `the recipe 'name', every ingredient 'Name' and 'Note', and every instruction 'Text' and 'Note'`;

    return `LANGUAGE (IMPORTANT): Write ALL human-readable output in ${language} — ${readable}.
- If any source material is in another language, translate it faithfully into ${language}, preserving amounts, quantities and meaning.
- NEVER translate JSON keys or the fixed English enum values: 'AmountType' (only the allowed unit keys), 'time', 'genre', 'mealTypes' and 'carbType' must stay EXACTLY one of the allowed English values given in these instructions.`;
};
