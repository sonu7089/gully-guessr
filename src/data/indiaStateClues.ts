import type { Region, StateCode } from '../engine/types';

export interface StateInfo {
  code: StateCode;
  name: string;
  kind: 'state' | 'ut';
  region: Region;
  /** ISO 3166-2 codes (including legacy ones) returned by geocoders. */
  iso: string[];
  aliases?: string[];
  /** Census 2011 population in millions, used for dampened state weighting. */
  populationM: number;
  scripts: string[];
  languages: string[];
  rto: string;
  landscape: string;
  hint: string;
}

export const INDIA_STATES: Record<StateCode, StateInfo> = {
  AP: { code: 'AP', name: 'Andhra Pradesh', kind: 'state', region: 'south', iso: ['IN-AP'], populationM: 49.4, scripts: ['Telugu'], languages: ['Telugu'], rto: 'AP', landscape: 'Long Bay of Bengal coastline, the fertile Godavari–Krishna delta and red-soil Rayalaseema uplands.', hint: 'Palmyra palms line coastal roads; shop boards are bilingual Telugu–English.' },
  AR: { code: 'AR', name: 'Arunachal Pradesh', kind: 'state', region: 'east', iso: ['IN-AR'], populationM: 1.4, scripts: ['Latin (English)'], languages: ['English', 'Nyishi', 'Adi', 'Monpa'], rto: 'AR', landscape: 'Steep, forested Himalayan valleys with bamboo groves and wide rivers like the Siang.', hint: 'Signage is mostly English; prayer flags and monasteries appear around Tawang and Bomdila.' },
  AS: { code: 'AS', name: 'Assam', kind: 'state', region: 'east', iso: ['IN-AS'], populationM: 31.2, scripts: ['Assamese (Eastern Nagari)'], languages: ['Assamese', 'Bodo', 'Bengali'], rto: 'AS', landscape: 'Flat Brahmaputra floodplains, manicured tea gardens and paddy fields with blue hills on the horizon.', hint: 'Assam-type houses with sloping tin roofs; Assamese script uses the distinctive letter ৰ.' },
  BR: { code: 'BR', name: 'Bihar', kind: 'state', region: 'east', iso: ['IN-BR'], populationM: 104.1, scripts: ['Devanagari', 'Perso-Arabic (Urdu)'], languages: ['Hindi', 'Maithili', 'Bhojpuri', 'Urdu'], rto: 'BR', landscape: 'Flat, densely farmed Gangetic plains with mango orchards and brick-kiln chimneys.', hint: 'E-rickshaws crowd town roads; painted wall adverts in Hindi everywhere.' },
  CG: { code: 'CG', name: 'Chhattisgarh', kind: 'state', region: 'east', iso: ['IN-CT', 'IN-CG'], populationM: 25.5, scripts: ['Devanagari'], languages: ['Hindi', 'Chhattisgarhi'], rto: 'CG', landscape: 'Central plateau of sal forests, paddy fields ("rice bowl of India") and red laterite soil.', hint: 'Hindi signage; tribal Bastar villages and waterfalls in the south.' },
  GA: { code: 'GA', name: 'Goa', kind: 'state', region: 'west', iso: ['IN-GA'], populationM: 1.5, scripts: ['Devanagari (Konkani)', 'Latin'], languages: ['Konkani', 'Marathi', 'English'], rto: 'GA', landscape: 'Coconut palms and red laterite soil where the Western Ghats meet the Arabian Sea.', hint: 'Whitewashed Portuguese-era churches and colourful villas with tiled roofs.' },
  GJ: { code: 'GJ', name: 'Gujarat', kind: 'state', region: 'west', iso: ['IN-GJ'], populationM: 60.4, scripts: ['Gujarati'], languages: ['Gujarati'], rto: 'GJ', landscape: 'Flat, dry plains, the white salt desert of Kutch and the long Saurashtra coastline.', hint: 'Gujarati script looks like Devanagari without the top headline bar; wide, smooth highways.' },
  HR: { code: 'HR', name: 'Haryana', kind: 'state', region: 'north', iso: ['IN-HR'], populationM: 25.4, scripts: ['Devanagari'], languages: ['Hindi', 'Haryanvi'], rto: 'HR', landscape: 'Flat, irrigated wheat–paddy plains wrapping around Delhi.', hint: 'Roadside dhabas, tractors and Gurugram glass towers near the capital.' },
  HP: { code: 'HP', name: 'Himachal Pradesh', kind: 'state', region: 'north', iso: ['IN-HP'], populationM: 6.9, scripts: ['Devanagari'], languages: ['Hindi', 'Pahari'], rto: 'HP', landscape: 'Mountain roads through deodar and pine forest, terraced slopes and apple orchards.', hint: 'Slate-roofed houses and HRTC buses on hairpin bends.' },
  JH: { code: 'JH', name: 'Jharkhand', kind: 'state', region: 'east', iso: ['IN-JH'], populationM: 33.0, scripts: ['Devanagari', 'Ol Chiki (Santali)'], languages: ['Hindi', 'Santali', 'Nagpuri'], rto: 'JH', landscape: 'Rolling Chota Nagpur plateau with sal forests, red soil and coal country.', hint: 'Overloaded coal trucks and bicycles carrying coal on highways.' },
  KA: { code: 'KA', name: 'Karnataka', kind: 'state', region: 'south', iso: ['IN-KA'], populationM: 61.1, scripts: ['Kannada'], languages: ['Kannada'], rto: 'KA', landscape: 'Boulder-strewn Deccan plateau, coffee estates in the Western Ghats and a green coastal strip.', hint: 'Rounded Kannada script; yellow-and-red Kannada flags on buildings.' },
  KL: { code: 'KL', name: 'Kerala', kind: 'state', region: 'south', iso: ['IN-KL'], populationM: 33.4, scripts: ['Malayalam'], languages: ['Malayalam'], rto: 'KL', landscape: 'Lush coconut palms, backwaters and continuous green ribbon settlements.', hint: 'Very rounded Malayalam script; sloping red-tiled roofs and brightly painted private buses.' },
  MP: { code: 'MP', name: 'Madhya Pradesh', kind: 'state', region: 'west', iso: ['IN-MP'], populationM: 72.6, scripts: ['Devanagari'], languages: ['Hindi'], rto: 'MP', landscape: 'Central plateau of Vindhya and Satpura ranges, black cotton soil and teak forest.', hint: 'Hindi signage, flat-topped hills and long, open rural highways.' },
  MH: { code: 'MH', name: 'Maharashtra', kind: 'state', region: 'west', iso: ['IN-MH'], populationM: 112.4, scripts: ['Devanagari (Marathi)'], languages: ['Marathi'], rto: 'MH', landscape: 'Basalt Deccan plateau, the Sahyadri ghats and the Konkan coast.', hint: 'Marathi in Devanagari; red MSRTC "Lalpari" buses.' },
  MN: { code: 'MN', name: 'Manipur', kind: 'state', region: 'east', iso: ['IN-MN'], populationM: 2.9, scripts: ['Meitei Mayek', 'Bengali', 'Latin'], languages: ['Meitei (Manipuri)', 'English'], rto: 'MN', landscape: 'Oval Imphal valley ringed by forested hills, with Loktak Lake to the south.', hint: 'Signboards mix Meitei Mayek script with English; women-run Ima Keithel market.' },
  ML: { code: 'ML', name: 'Meghalaya', kind: 'state', region: 'east', iso: ['IN-ML'], populationM: 3.0, scripts: ['Latin (Khasi, Garo)'], languages: ['Khasi', 'Garo', 'English'], rto: 'ML', landscape: 'Rolling pine-covered plateaus, deep gorges and some of the wettest places on Earth.', hint: 'Latin-script Khasi and English signage; many churches.' },
  MZ: { code: 'MZ', name: 'Mizoram', kind: 'state', region: 'east', iso: ['IN-MZ'], populationM: 1.1, scripts: ['Latin (Mizo)'], languages: ['Mizo', 'English'], rto: 'MZ', landscape: 'Ridge-top towns perched over steep bamboo-covered hills.', hint: 'Mizo in Latin script; stilted houses cling to slopes.' },
  NL: { code: 'NL', name: 'Nagaland', kind: 'state', region: 'east', iso: ['IN-NL'], populationM: 2.0, scripts: ['Latin (English)'], languages: ['English', 'Nagamese'], rto: 'NL', landscape: 'Hilly, forested terrain with terraced rice fields.', hint: 'English signboards, churches and Naga tribal motifs.' },
  OD: { code: 'OD', name: 'Odisha', kind: 'state', region: 'east', iso: ['IN-OR', 'IN-OD'], aliases: ['Orissa'], populationM: 42.0, scripts: ['Odia'], languages: ['Odia'], rto: 'OD', landscape: 'Coastal plains, the Mahanadi delta and forested Eastern Ghats.', hint: 'Odia letters have rounded umbrella-like tops; curved Kalinga-style temple spires.' },
  PB: { code: 'PB', name: 'Punjab', kind: 'state', region: 'north', iso: ['IN-PB'], populationM: 27.7, scripts: ['Gurmukhi'], languages: ['Punjabi'], rto: 'PB', landscape: 'Flat, intensively farmed wheat and paddy fields lined with poplar and eucalyptus rows.', hint: 'Gurmukhi script on signs; gurdwaras and big tractors.' },
  RJ: { code: 'RJ', name: 'Rajasthan', kind: 'state', region: 'west', iso: ['IN-RJ'], populationM: 68.5, scripts: ['Devanagari'], languages: ['Hindi', 'Rajasthani'], rto: 'RJ', landscape: 'Thar desert dunes, the Aravalli hills and arid khejri scrubland.', hint: 'Pink and golden sandstone buildings, havelis and camel carts.' },
  SK: { code: 'SK', name: 'Sikkim', kind: 'state', region: 'east', iso: ['IN-SK'], populationM: 0.61, scripts: ['Devanagari (Nepali)', 'Latin'], languages: ['Nepali', 'English'], rto: 'SK', landscape: 'Steep mountains, terraced cardamom farms and Kanchenjunga views.', hint: 'Prayer flags, monasteries and notably clean hill towns.' },
  TN: { code: 'TN', name: 'Tamil Nadu', kind: 'state', region: 'south', iso: ['IN-TN'], populationM: 72.1, scripts: ['Tamil'], languages: ['Tamil'], rto: 'TN', landscape: 'Coastal plains of paddy and palmyra palms rising to the Nilgiri and Palani hills.', hint: 'Angular-looped Tamil script; towering temple gopurams.' },
  TG: { code: 'TG', name: 'Telangana', kind: 'state', region: 'south', iso: ['IN-TG', 'IN-TS'], populationM: 35.0, scripts: ['Telugu', 'Perso-Arabic (Urdu)'], languages: ['Telugu', 'Urdu'], rto: 'TG (formerly TS)', landscape: 'Deccan plateau with granite boulder hills and dry farmland.', hint: 'Telugu with some Urdu signage; Hyderabad’s IT corridors and Charminar old city.' },
  TR: { code: 'TR', name: 'Tripura', kind: 'state', region: 'east', iso: ['IN-TR'], populationM: 3.7, scripts: ['Bengali', 'Latin (Kokborok)'], languages: ['Bengali', 'Kokborok'], rto: 'TR', landscape: 'Low hills, rubber plantations and paddy valleys bordering Bangladesh.', hint: 'Bengali script signboards; neat rows of rubber trees.' },
  UP: { code: 'UP', name: 'Uttar Pradesh', kind: 'state', region: 'north', iso: ['IN-UP'], populationM: 199.8, scripts: ['Devanagari', 'Perso-Arabic (Urdu)'], languages: ['Hindi', 'Urdu'], rto: 'UP', landscape: 'Vast, flat Gangetic plains with sugarcane, wheat and mustard fields.', hint: 'Hindi signboards, crowded e-rickshaws and riverside ghats.' },
  UK: { code: 'UK', name: 'Uttarakhand', kind: 'state', region: 'north', iso: ['IN-UT', 'IN-UK'], aliases: ['Uttaranchal'], populationM: 10.1, scripts: ['Devanagari'], languages: ['Hindi', 'Garhwali', 'Kumaoni'], rto: 'UK', landscape: 'Himalayan foothills, chir pine forest, deep river valleys and the Terai plains.', hint: 'Temples and ashrams; mountain highways following Ganga tributaries.' },
  WB: { code: 'WB', name: 'West Bengal', kind: 'state', region: 'east', iso: ['IN-WB'], populationM: 91.3, scripts: ['Bengali'], languages: ['Bengali', 'Nepali'], rto: 'WB', landscape: 'Lush Gangetic delta of ponds, paddy and palms, rising to Himalayan tea hills in the north.', hint: 'Bengali script; yellow Ambassador taxis and trams in Kolkata.' },
  AN: { code: 'AN', name: 'Andaman and Nicobar Islands', kind: 'ut', region: 'east', iso: ['IN-AN'], populationM: 0.38, scripts: ['Devanagari', 'Latin'], languages: ['Hindi', 'Bengali', 'English'], rto: 'AN', landscape: 'Tropical islands of dense rainforest, mangroves and white beaches.', hint: 'Hindi and English signage on narrow, quiet island roads.' },
  CH: { code: 'CH', name: 'Chandigarh', kind: 'ut', region: 'north', iso: ['IN-CH'], populationM: 1.05, scripts: ['Latin', 'Devanagari', 'Gurmukhi'], languages: ['English', 'Hindi', 'Punjabi'], rto: 'CH', landscape: 'Planned grid city at the foot of the Shivalik hills.', hint: 'Numbered sectors, large roundabouts and modernist concrete architecture.' },
  DD: { code: 'DD', name: 'Dadra and Nagar Haveli and Daman and Diu', kind: 'ut', region: 'west', iso: ['IN-DH', 'IN-DN', 'IN-DD'], aliases: ['Daman and Diu', 'Dadra and Nagar Haveli'], populationM: 0.59, scripts: ['Gujarati', 'Devanagari', 'Latin'], languages: ['Gujarati', 'Hindi', 'English'], rto: 'DD / DN', landscape: 'Coastal plains and forested hills near the Gujarat–Maharashtra border.', hint: 'Portuguese-era forts and churches in Daman and Diu; industrial estates around Silvassa.' },
  DL: { code: 'DL', name: 'Delhi', kind: 'ut', region: 'north', iso: ['IN-DL'], aliases: ['National Capital Territory of Delhi', 'NCT of Delhi', 'New Delhi'], populationM: 16.8, scripts: ['Devanagari', 'Gurmukhi', 'Perso-Arabic (Urdu)', 'Latin'], languages: ['Hindi', 'English', 'Punjabi', 'Urdu'], rto: 'DL', landscape: 'Flat urban sprawl along the Yamuna dotted with Mughal monuments.', hint: 'Green-and-yellow CNG autos and Delhi Metro viaducts; signs in four scripts.' },
  JK: { code: 'JK', name: 'Jammu and Kashmir', kind: 'ut', region: 'north', iso: ['IN-JK'], populationM: 12.3, scripts: ['Perso-Arabic (Urdu, Kashmiri)', 'Devanagari'], languages: ['Kashmiri', 'Dogri', 'Urdu', 'Hindi'], rto: 'JK', landscape: 'Kashmir valley with chinar trees, lakes and the snowy Pir Panjal range.', hint: 'Urdu signboards; wooden houses with steep tin roofs.' },
  LA: { code: 'LA', name: 'Ladakh', kind: 'ut', region: 'north', iso: ['IN-LA'], populationM: 0.27, scripts: ['Tibetan', 'Perso-Arabic', 'Devanagari'], languages: ['Ladakhi', 'Purgi', 'Hindi'], rto: 'LA', landscape: 'High-altitude cold desert of barren brown mountains and turquoise lakes.', hint: 'Whitewashed monasteries, stupas and prayer flags; BRO road signs.' },
  LD: { code: 'LD', name: 'Lakshadweep', kind: 'ut', region: 'south', iso: ['IN-LD'], populationM: 0.064, scripts: ['Malayalam', 'Latin'], languages: ['Malayalam', 'Jeseri'], rto: 'LD', landscape: 'Tiny coral atolls fringed by coconut palms and turquoise lagoons.', hint: 'Malayalam signage on very narrow island lanes.' },
  PY: { code: 'PY', name: 'Puducherry', kind: 'ut', region: 'south', iso: ['IN-PY'], aliases: ['Pondicherry'], populationM: 1.2, scripts: ['Tamil', 'Latin (French)', 'Malayalam', 'Telugu'], languages: ['Tamil', 'French', 'English'], rto: 'PY', landscape: 'Flat coastal enclaves with a seaside French Quarter.', hint: 'French street names ("Rue …") and mustard-yellow colonial buildings.' },
};

export const STATE_CODES = Object.keys(INDIA_STATES) as StateCode[];

function normalise(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
}

const NAME_INDEX = new Map<string, StateCode>();
const ISO_INDEX = new Map<string, StateCode>();
for (const s of Object.values(INDIA_STATES)) {
  NAME_INDEX.set(normalise(s.name), s.code);
  for (const a of s.aliases ?? []) NAME_INDEX.set(normalise(a), s.code);
  for (const iso of s.iso) ISO_INDEX.set(iso.toUpperCase(), s.code);
}

/** Resolve a geocoder state name or ISO 3166-2 code into our state code. */
export function resolveStateCode(value: string | undefined | null): StateCode | null {
  if (!value) return null;
  const iso = ISO_INDEX.get(value.trim().toUpperCase());
  if (iso) return iso;
  return NAME_INDEX.get(normalise(value)) ?? null;
}
