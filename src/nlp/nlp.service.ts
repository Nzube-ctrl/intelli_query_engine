import { Injectable } from '@nestjs/common';

const COUNTRY_MAP: Record<string, string> = {
  nigeria: 'NG',
  niger: 'NE',
  ghana: 'GH',
  kenya: 'KE',
  ethiopia: 'ET',
  egypt: 'EG',
  tanzania: 'TZ',
  uganda: 'UG',
  algeria: 'DZ',
  sudan: 'SD',
  morocco: 'MA',
  angola: 'AO',
  mozambique: 'MZ',
  madagascar: 'MG',
  cameroon: 'CM',
  'ivory coast': 'CI',
  "côte d'ivoire": 'CI',
  mali: 'ML',
  malawi: 'MW',
  zambia: 'ZM',
  senegal: 'SN',
  zimbabwe: 'ZW',
  chad: 'TD',
  guinea: 'GN',
  rwanda: 'RW',
  benin: 'BJ',
  burundi: 'BI',
  togo: 'TG',
  'sierra leone': 'SL',
  libya: 'LY',
  liberia: 'LR',
  'central african republic': 'CF',
  mauritania: 'MR',
  eritrea: 'ER',
  gambia: 'GM',
  botswana: 'BW',
  namibia: 'NA',
  gabon: 'GA',
  lesotho: 'LS',
  guinea_bissau: 'GW',
  'guinea-bissau': 'GW',
  'equatorial guinea': 'GQ',
  mauritius: 'MU',
  eswatini: 'SZ',
  swaziland: 'SZ',
  djibouti: 'DJ',
  comoros: 'KM',
  'cape verde': 'CV',
  'sao tome': 'ST',
  seychelles: 'SC',
  somalia: 'SO',
  'south africa': 'ZA',
  'south sudan': 'SS',
  'democratic republic of congo': 'CD',
  'dr congo': 'CD',
  congo: 'CG',
  'republic of congo': 'CG',
  // Rest of world
  usa: 'US',
  'united states': 'US',
  america: 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  britain: 'GB',
  england: 'GB',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  canada: 'CA',
  australia: 'AU',
  brazil: 'BR',
  india: 'IN',
  china: 'CN',
  japan: 'JP',
  russia: 'RU',
  mexico: 'MX',
  indonesia: 'ID',
  pakistan: 'PK',
  bangladesh: 'BD',
  'saudi arabia': 'SA',
  turkey: 'TR',
  argentina: 'AR',
  colombia: 'CO',
  'south korea': 'KR',
  korea: 'KR',
  thailand: 'TH',
  vietnam: 'VN',
  philippines: 'PH',
  malaysia: 'MY',
  singapore: 'SG',
  netherlands: 'NL',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  switzerland: 'CH',
  austria: 'AT',
  belgium: 'BE',
  portugal: 'PT',
  poland: 'PL',
  ukraine: 'UA',
  greece: 'GR',
  'new zealand': 'NZ',
  ireland: 'IE',
  israel: 'IL',
};

export interface ParsedFilters {
  gender?: string;
  age_group?: string;
  country_id?: string;
  min_age?: number;
  max_age?: number;
}

export interface ParseResult {
  success: boolean;
  filters?: ParsedFilters;
}

@Injectable()
export class NlpParserService {
  parse(query: string): ParseResult {
    if (!query || !query.trim()) {
      return { success: false };
    }

    const q = query.toLowerCase().trim();
    const filters: ParsedFilters = {};

    const isMale = /\b(males?|men|man|boys?)\b/.test(q);
    const isFemale = /\b(females?|women|woman|girls?)\b/.test(q);

    if (isMale && !isFemale) filters.gender = 'male';
    if (isFemale && !isMale) filters.gender = 'female';

    if (/\bchildren\b|\bchild\b|\bkids?\b/.test(q)) {
      filters.age_group = 'child';
    } else if (/\bteenagers?\b|\bteens?\b/.test(q)) {
      filters.age_group = 'teenager';
    } else if (/\badults?\b/.test(q)) {
      filters.age_group = 'adult';
    } else if (/\bseniors?\b|\belderly\b|\bold people\b/.test(q)) {
      filters.age_group = 'senior';
    }

    if (/\byoung\b/.test(q) && !filters.age_group) {
      filters.min_age = 16;
      filters.max_age = 24;
    }

    const betweenMatch = q.match(/\bbetween\s+(\d+)\s+(?:and|to)\s+(\d+)\b/);
    if (betweenMatch) {
      filters.min_age = parseInt(betweenMatch[1], 10);
      filters.max_age = parseInt(betweenMatch[2], 10);
    }

    const aboveMatch = q.match(
      /\b(?:above|over|older than|at least|minimum age of?)\s+(\d+)\b/,
    );
    if (aboveMatch) {
      filters.min_age = parseInt(aboveMatch[1], 10);
    }

    const belowMatch = q.match(
      /\b(?:below|under|younger than|at most|maximum age of?)\s+(\d+)\b/,
    );
    if (belowMatch) {
      filters.max_age = parseInt(belowMatch[1], 10);
    }

    const countryPhraseMatch = q.match(
      /\b(?:from|in|living in|based in|located in|residing in)\s+([a-z\s']+?)(?:\s+(?:who|that|with|above|below|over|under|and|aged|age)|$)/,
    );

    if (countryPhraseMatch) {
      const rawCountry = countryPhraseMatch[1].trim().replace(/\s+/g, ' ');
      const isoCode = this.resolveCountry(rawCountry);
      if (isoCode) {
        filters.country_id = isoCode;
      }
    }

    if (!filters.country_id) {
      for (const [name, code] of Object.entries(COUNTRY_MAP)) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`);
        if (regex.test(q)) {
          filters.country_id = code;
          break;
        }
      }
    }

    const hasAnyFilter = Object.keys(filters).length > 0;
    if (!hasAnyFilter) {
      return { success: false };
    }

    return { success: true, filters };
  }

  private resolveCountry(raw: string): string | null {
    const normalized = raw.toLowerCase().trim();

    if (COUNTRY_MAP[normalized]) return COUNTRY_MAP[normalized];

    if (/^[a-z]{2}$/.test(normalized)) {
      const upper = normalized.toUpperCase();
      const found = Object.values(COUNTRY_MAP).find((v) => v === upper);
      if (found) return found;
    }

    for (const [name, code] of Object.entries(COUNTRY_MAP)) {
      if (normalized.includes(name)) return code;
    }

    return null;
  }
}
