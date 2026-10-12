// ISO country names used to power the country picker in the dish editor.
// Kept as a static list so the suggestion order/names are stable everywhere
// (Intl.DisplayNames varies by runtime ICU version). Free text is still
// allowed, so legacy spellings already stored on items keep working.
export const COUNTRIES: string[] = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
    'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
    'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
    'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
    'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei',
    'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
    'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile',
    'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
    'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Democratic Republic of the Congo',
    'Denmark',
    'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
    'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
    'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
    'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
    'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
    'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland',
    'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
    'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan',
    'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
    'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon',
    'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
    'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia',
    'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco',
    'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
    'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
    'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia',
    'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
    'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
    'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
    'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania',
    'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
    'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu', 'Uganda',
    'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
    'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
    'Yemen', 'Zambia', 'Zimbabwe'
]

// Lowercase, accent-free, punctuation-free key used for country comparison.
const countryKey = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

// Common alternative spellings → the normalized canonical name. Free text is
// still stored as typed; this only decides which COUNTRIES slot a dish covers.
const COUNTRY_ALIASES: Record<string, string> = {
    'usa': 'united states',
    'us': 'united states',
    'u s': 'united states',
    'united states of america': 'united states',
    'america': 'united states',
    'uk': 'united kingdom',
    'u k': 'united kingdom',
    'great britain': 'united kingdom',
    'britain': 'united kingdom',
    'england': 'united kingdom',
    'turkey': 'turkiye',
    'czech republic': 'czechia',
    'cote d ivoire': 'ivory coast',
    'korea': 'south korea',
    'republic of korea': 'south korea',
    'korea republic of': 'south korea',
    'russian federation': 'russia',
    'viet nam': 'vietnam',
    'uae': 'united arab emirates',
    'u a e': 'united arab emirates',
    'burma': 'myanmar',
    'swaziland': 'eswatini',
    'macedonia': 'north macedonia',
    'bosnia': 'bosnia and herzegovina',
    'drc': 'democratic republic of the congo',
    'dr congo': 'democratic republic of the congo',
    'democratic republic of congo': 'democratic republic of the congo',
    'congo kinshasa': 'democratic republic of the congo',
    'republic of the congo': 'congo',
    'congo brazzaville': 'congo',
    'cabo verde': 'cape verde',
    'holland': 'netherlands',
    'vatican': 'vatican city',
    'east timor': 'timor leste',
    'mainland china': 'china',
    'hong kong sar': 'hong kong'
}

const CANONICAL_BY_KEY: Map<string, string> = new Map(COUNTRIES.map(c => [countryKey(c), c]))

/**
 * Maps a stored/typed country name onto its COUNTRIES entry (aliases and
 * spelling variants folded in). Returns the trimmed input unchanged when it
 * matches nothing, so custom entries keep working.
 */
export const canonicalCountry = (value?: string | null): string => {
    const trimmed = (value || '').trim()
    if (!trimmed) return ''
    const key = countryKey(trimmed)
    const target = COUNTRY_ALIASES[key] || key
    return CANONICAL_BY_KEY.get(target) || trimmed
}
