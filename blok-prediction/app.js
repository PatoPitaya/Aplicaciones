const STORAGE_KEY = 'blok-predictions-v1';
const config = window.BLOK_SUPABASE_CONFIG || {};
const remoteEnabled = Boolean(config.url && config.anonKey && window.supabase);
const database = remoteEnabled ? window.supabase.createClient(config.url, config.anonKey) : null;

// DOM Elements
const detailsForm = document.querySelector('#detailsForm');
const participantNameInput = document.querySelector('#participantName');
const participantPhoneInput = document.querySelector('#participantPhone');
const detailsMessage = document.querySelector('#detailsMessage');

const toWomenScoreBtn = document.querySelector('#toWomenScoreBtn');
const toMenPickBtn = document.querySelector('#toMenPickBtn');
const toMenScoreBtn = document.querySelector('#toMenScoreBtn');
const confirmPredictionBtn = document.querySelector('#confirmPredictionBtn');
const confirmBtnText = document.querySelector('#confirmBtnText');
const selectionMessage = document.querySelector('#selectionMessage');
const womenSelectionMessage = document.querySelector('#womenSelectionMessage');
const menSelectionMessage = document.querySelector('#menSelectionMessage');

const adminPanel = document.querySelector('#adminPanel');
const scrim = document.querySelector('#panelScrim');
const adminAuth = document.querySelector('#adminAuth');
const adminControls = document.querySelector('#adminControls');
const adminWarning = document.querySelector('#adminWarning');
const adminAuthMessage = document.querySelector('#adminAuthMessage');
const appFrame = document.querySelector('#appFrame');

function normalize(value) {
  const clean = String(value || '').trim().replace(/\s*\([A-Za-z]{3}\)$/, '').trim();
  return clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getUrbanCrownSvg(width = 68, height = 48) {
  return `
    <svg class="urban-crown-svg" width="${width}" height="${height}" viewBox="0 0 72 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 10 44 C 10 44 12 21 14 18 C 17 22 25 31 27 31 C 29 29 34 11 36 7 C 38 11 43 29 45 31 C 47 31 55 22 58 18 C 60 21 62 44 62 44 Z" 
            fill="#ebd87e" stroke="#140d12" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M 9 36 C 24 38 48 38 63 36" stroke="#140d12" stroke-width="3" stroke-linecap="round"/>
      <circle cx="14" cy="13" r="4.2" fill="#ebd87e" stroke="#140d12" stroke-width="3"/>
      <circle cx="36" cy="5" r="4.8" fill="#ebd87e" stroke="#140d12" stroke-width="3"/>
      <circle cx="58" cy="13" r="4.2" fill="#ebd87e" stroke="#140d12" stroke-width="3"/>
      <circle cx="23" cy="40.5" r="2.2" fill="#140d12"/>
      <circle cx="36" cy="41" r="2.5" fill="#140d12"/>
      <circle cx="49" cy="40.5" r="2.2" fill="#140d12"/>
      <path d="M 33 13 L 28 24" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M 15 22 L 17 31" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="35" cy="4" r="1.3" fill="#ffffff"/>
    </svg>
  `;
}

let isAdmin = !remoteEnabled;
let state = readLocalState();
let pendingParticipant = null;

// Draft prediction state for the sequential flow (WOMEN FIRST!)
let draftPick = {
  women: { climber: '', tops: 4, zones: 4, att_top: 4, att_zone: 4, scoreStr: '4T4 4Z4' },
  men: { climber: '', tops: 3, zones: 4, att_top: 6, att_zone: 5, scoreStr: '3T6 4Z5' }
};

// ================= MASTER ATHLETES POOL (28 COMPETITORS: 12 WOMEN + 16 MEN) =================
const ALL_COMPETITORS = {
  women: [
    { id: 'w_cuypers',     name: 'Celine Cuypers',        country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'w_alardin',     name: 'Perrine Alardin',       country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'w_lerondel',    name: 'Amie Lerondel',         country: 'FRANCE',         code: 'FRA', flag: '🇫🇷' },
    { id: 'w_cohaut',      name: 'Flavy Cohaut',          country: 'FRANCE',         code: 'FRA', flag: '🇫🇷' },
    { id: 'w_piazzalunga', name: 'Maïlys Piazzalunga',    country: 'FRANCE',         code: 'FRA', flag: '🇫🇷' },
    { id: 'w_tesio',       name: 'Giorgia Tesio',         country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'w_daziano',     name: 'Irina Daziano',         country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'w_schiffeleers',name: 'Amber Schiffeleers',    country: 'NETHERLANDS',    code: 'NED', flag: '🇳🇱' },
    { id: 'w_hamers',      name: 'Bibi Hamers',           country: 'NETHERLANDS',    code: 'NED', flag: '🇳🇱' },
    { id: 'w_havermans',   name: 'Geke Havermans',        country: 'NETHERLANDS',    code: 'NED', flag: '🇳🇱' },
    { id: 'w_hovde',       name: 'Nora Hovde',            country: 'NORWAY',         code: 'NOR', flag: '🇳🇴' },
    { id: 'w_tvedt',       name: 'Pernille Tvedt',        country: 'NORWAY',         code: 'NOR', flag: '🇳🇴' }
  ],
  men: [
    { id: 'm_laporte',     name: 'Corentin Laporte',      country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'm_pesseroey',   name: 'Dries De Pesseroey',    country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'm_cocquyt',     name: 'Jasper Cocquyt',        country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'm_vangorp',     name: 'Mathijs Van Gorp',      country: 'BELGIUM',        code: 'BEL', flag: '🇧🇪' },
    { id: 'm_lebris',      name: 'Arthur Le Bris',        country: 'FRANCE',         code: 'FRA', flag: '🇫🇷' },
    { id: 'm_rebollo',     name: 'Arthur Rebollo',        country: 'FRANCE',         code: 'FRA', flag: '🇫🇷' },
    { id: 'm_macdougall',  name: 'Jack MacDougall',       country: 'GREAT BRITAIN',  code: 'GBR', flag: '🇬🇧' },
    { id: 'm_villatoro',   name: 'Keanu Villatoro',       country: 'GUATEMALA',      code: 'GTM', flag: '🇬🇹' },
    { id: 'm_salvatore_m', name: 'Mattia Salvatore',      country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'm_salvatore_n', name: 'Niccolo Salvatore',     country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'm_sacripanti',  name: 'Nicolo Sacripanti',     country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'm_sartirana',   name: 'Nicolo Sartirana',      country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'm_mabboni',     name: 'Simone Mabboni',        country: 'ITALY',          code: 'ITA', flag: '🇮🇹' },
    { id: 'm_brand',       name: 'Paul Brand',            country: 'NETHERLANDS',    code: 'NED', flag: '🇳🇱' },
    { id: 'm_peharc',      name: 'Anze Peharc',           country: 'SLOVENIA',       code: 'SLO', flag: '🇸🇮' },
    { id: 'm_romsak',      name: 'Timotej Romsak',        country: 'SLOVENIA',       code: 'SLO', flag: '🇸🇮' }
  ]
};

const DEFAULT_FINALIST_NAMES = {
  women: [
    'Celine Cuypers',
    'Perrine Alardin',
    'Amie Lerondel',
    'Flavy Cohaut',
    'Giorgia Tesio',
    'Bibi Hamers'
  ],
  men: [
    'Corentin Laporte',
    'Jasper Cocquyt',
    'Arthur Le Bris',
    'Niccolo Salvatore',
    'Anze Peharc',
    'Paul Brand'
  ]
};

function buildFinalistsObject(womenNames, menNames) {
  const getCompetitor = (gender, rawInput) => {
    const raw = String(rawInput || '').trim();
    // Support "Name (CODE)" format e.g. "Lucas Van de Velde (BEL)" or "Lucas Van de Velde"
    const match = raw.match(/^(.*?)(?:\s*\(([A-Za-z]{3})\))?$/);
    const cleanName = match && match[1] ? match[1].trim() : raw;
    const explicitCode = match && match[2] ? match[2].toUpperCase() : null;

    const found = ALL_COMPETITORS[gender]?.find((c) => normalize(c.name) === normalize(cleanName));
    if (found) {
      return {
        name: found.name,
        country: found.country,
        code: explicitCode || found.code,
        flag: found.flag
      };
    }

    return {
      name: cleanName || raw,
      country: explicitCode ? explicitCode : 'FINALIST',
      code: explicitCode || 'BLOK',
      flag: '🧗'
    };
  };

  return {
    women: (womenNames || []).slice(0, 6).map((name, idx) => {
      const c = getCompetitor('women', name);
      return {
        bib: String(idx + 1).padStart(2, '0'),
        name: c.name,
        country: c.country,
        code: c.code,
        flag: c.flag,
        extra: 'BLOK FINALIST'
      };
    }),
    men: (menNames || []).slice(0, 6).map((name, idx) => {
      const c = getCompetitor('men', name);
      return {
        bib: String(idx + 1).padStart(2, '0'),
        name: c.name,
        country: c.country,
        code: c.code,
        flag: c.flag,
        extra: 'BLOK FINALIST'
      };
    })
  };
}

function loadActiveFinalists() {
  try {
    const raw = localStorage.getItem('blok_active_finalists');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.women) && Array.isArray(parsed?.men) && parsed.women.length === 6 && parsed.men.length === 6) {
        return buildFinalistsObject(parsed.women, parsed.men);
      }
    }
  } catch (e) {
    console.warn('Could not load saved finalists from localStorage', e);
  }
  return buildFinalistsObject(DEFAULT_FINALIST_NAMES.women, DEFAULT_FINALIST_NAMES.men);
}

// Active Finals Roster (Dynamic 6 Women + 6 Men)
let FINALISTS = loadActiveFinalists();
let adminRosterDraft = { women: new Set(), men: new Set() };

function isValidWinnerString(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const s = raw.trim();
  if (s.startsWith('W:') && s.includes('|M:')) {
    const parts = s.split('|');
    const wPart = (parts[0] || '').replace(/^W:/, '').trim();
    const mPart = (parts[1] || '').replace(/^M:/, '').trim();
    const wMatch = wPart.match(/^(.*?)(?:\s+\d+T)/i);
    const mMatch = mPart.match(/^(.*?)(?:\s+\d+T)/i);
    const wName = wMatch ? wMatch[1].trim() : '';
    const mName = mMatch ? mMatch[1].trim() : '';
    return Boolean(wName || mName);
  }
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      return Boolean(obj?.women?.climber || obj?.men?.climber);
    } catch (e) {
      return false;
    }
  }
  return s.length > 2;
}

function readLocalState() {
  const sessionRaw = sessionStorage.getItem('blok_test_winner');
  const validSessionWinner = isValidWinnerString(sessionRaw) ? sessionRaw : '';
  if (sessionRaw && !validSessionWinner) {
    sessionStorage.removeItem('blok_test_winner');
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.entries)) {
      const validSavedWinner = isValidWinnerString(saved.winner) ? saved.winner : '';
      return {
        entries: saved.entries,
        winner: validSessionWinner || validSavedWinner || '',
        predictionsOpen: saved.predictionsOpen !== false
      };
    }
  } catch (error) {
    console.warn('Could not read saved predictions.', error);
  }
  return { 
    entries: [], 
    winner: validSessionWinner || '', 
    predictionsOpen: true 
  };
}

// ================= IFSC VALIDATION & SANITIZATION ENGINE =================
/**
 * Enforces IFSC rules across 4 boulder problems:
 * - tops <= 4, zones <= 4
 * - zones >= tops (always)
 * - if tops == 0 -> att_top = 0; if tops > 0 -> att_top >= tops
 * - if zones == 0 -> att_zone = 0; if zones > 0 -> att_zone >= zones
 * - live format: XT Yz A B (e.g. 4T4z 4 4)
 */
function sanitizeIfsc(score) {
  const s = score || {};
  let tops = Math.max(0, Math.min(4, parseInt(s.tops, 10) || 0));
  let zones = Math.max(0, Math.min(4, parseInt(s.zones, 10) || 0));

  if (zones < tops) zones = tops;

  let attTop = parseInt(s.att_top, 10);
  if (isNaN(attTop)) attTop = tops ? tops : 0;
  if (tops === 0) {
    attTop = 0;
  } else if (attTop < tops) {
    attTop = tops;
  }

  let attZone = parseInt(s.att_zone, 10);
  if (isNaN(attZone)) attZone = zones ? zones : 0;
  if (zones === 0) {
    attZone = 0;
  } else if (attZone < zones) {
    attZone = zones;
  }

  // Format: e.g. 3T4 4Z4 or 3T6 4Z5
  const scoreStr = `${tops}T${attTop} ${zones}Z${attZone}`;
  return {
    climber: s.climber || '',
    tops,
    zones,
    att_top: attTop,
    att_zone: attZone,
    scoreStr
  };
}

// Parses score string like "3T4 4Z4", "3T6 4Z5", or legacy "3T4z 6 5"
function parseIfscStr(scoreStr, defaultTops = 4, defaultZones = 4, defaultAttTop = 4, defaultAttZone = 4) {
  if (scoreStr) {
    const str = String(scoreStr).trim();
    // 1. New format: e.g. "3T4 4Z4" (m[1]=tops, m[2]=att_top, m[3]=zones, m[4]=att_zone)
    const mNew = str.match(/^(\d+)T(\d+)\s+(\d+)Z(\d+)$/i);
    if (mNew) {
      return sanitizeIfsc({
        tops: parseInt(mNew[1], 10),
        att_top: parseInt(mNew[2], 10),
        zones: parseInt(mNew[3], 10),
        att_zone: parseInt(mNew[4], 10)
      });
    }
    // 2. Legacy IFSC format: e.g. "3T4z 6 5" (m[1]=tops, m[2]=zones, m[3]=att_top, m[4]=att_zone)
    const mOld = str.match(/^(\d+)T(\d+)z\s+(\d+)\s+(\d+)$/i);
    if (mOld) {
      return sanitizeIfsc({
        tops: parseInt(mOld[1], 10),
        zones: parseInt(mOld[2], 10),
        att_top: parseInt(mOld[3], 10),
        att_zone: parseInt(mOld[4], 10)
      });
    }
  }
  return sanitizeIfsc({
    tops: defaultTops,
    zones: defaultZones,
    att_top: defaultAttTop,
    att_zone: defaultAttZone
  });
}

// Compact encoder to ensure payload stays under the Postgres 80-char check constraint
// Format: W:<ClimberName> <XT Yz A B>|M:<ClimberName> <XT Yz A B>
function encodePrediction(women, men) {
  const w = sanitizeIfsc(women || {});
  const m = sanitizeIfsc(men || {});
  const wName = (w.climber || women?.climber || '').trim();
  const mName = (m.climber || men?.climber || '').trim();
  return `W:${wName} ${w.scoreStr}|M:${mName} ${m.scoreStr}`;
}

// Parses stored climber string (compact format, JSON, or legacy single name)
function parsePrediction(rawClimber) {
  if (!rawClimber) return null;
  if (typeof rawClimber === 'object') {
    return {
      women: rawClimber.women ? sanitizeIfsc(rawClimber.women) : null,
      men: rawClimber.men ? sanitizeIfsc(rawClimber.men) : null
    };
  }

  const str = String(rawClimber).trim();

  // 1. Compact format: "W:Janja Garnbret 4T4z 4 4|M:Adam Ondra 3T4z 6 5"
  if (str.includes('|') || str.startsWith('W:') || str.startsWith('M:')) {
    let women = null;
    let men = null;
    const parts = str.split('|');
    for (const part of parts) {
      const p = part.trim();
      if (p.startsWith('W:')) {
        const val = p.slice(2).trim();
        const match = val.match(/^(.*?)(?:\s+(\d+T\d+\s+\d+Z\d+|\d+T\d+z\s+\d+\s+\d+))?$/i);
        if (match) {
          const climber = (match[1] || '').trim();
          const scoreParsed = parseIfscStr(match[2], 4, 4, 4, 4);
          women = sanitizeIfsc({ ...scoreParsed, climber });
        }
      } else if (p.startsWith('M:')) {
        const val = p.slice(2).trim();
        const match = val.match(/^(.*?)(?:\s+(\d+T\d+\s+\d+Z\d+|\d+T\d+z\s+\d+\s+\d+))?$/i);
        if (match) {
          const climber = (match[1] || '').trim();
          const scoreParsed = parseIfscStr(match[2], 3, 4, 6, 5);
          men = sanitizeIfsc({ ...scoreParsed, climber });
        }
      }
    }
    return { women, men };
  }

  // 2. JSON format (backwards compatibility / local fallback)
  try {
    const parsed = JSON.parse(str);
    if (parsed && (parsed.women || parsed.men)) {
      return {
        women: parsed.women ? sanitizeIfsc(parsed.women) : null,
        men: parsed.men ? sanitizeIfsc(parsed.men) : null
      };
    }
  } catch (e) {
    // Legacy single climber string
  }

  // 3. Legacy single climber name
  const isWoman = FINALISTS.women.some((w) => normalize(w.name) === normalize(str));
  if (isWoman) {
    return {
      women: sanitizeIfsc({ climber: str, tops: 4, zones: 4, att_top: 4, att_zone: 4 }),
      men: null
    };
  }
  return {
    women: null,
    men: sanitizeIfsc({ climber: str, tops: 3, zones: 4, att_top: 6, att_zone: 5 })
  };
}

// Helpers to store finalists safely in official_winner column if active_finalists column is missing in Supabase
function encodeFinalistsInWinnerColumn(finalistsPayload, currentWinnerVal = '') {
  const finalistsJson = JSON.stringify(finalistsPayload);
  let cleanWinner = '';
  if (currentWinnerVal) {
    if (currentWinnerVal.includes('###WINNER:')) {
      cleanWinner = currentWinnerVal.split('###WINNER:')[1] || '';
    } else if (!currentWinnerVal.startsWith('FINALISTS:')) {
      cleanWinner = currentWinnerVal;
    }
  }
  return cleanWinner ? `FINALISTS:${finalistsJson}###WINNER:${cleanWinner}` : `FINALISTS:${finalistsJson}`;
}

function decodeFinalistsFromWinnerColumn(raw) {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.includes('FINALISTS:')) return null;
  try {
    const afterTag = raw.replace(/^.*?FINALISTS:/, '');
    const jsonStr = afterTag.includes('###WINNER:') ? afterTag.split('###WINNER:')[0] : afterTag;
    const parsed = JSON.parse(jsonStr);
    let winner = null;
    if (raw.includes('###WINNER:')) {
      winner = raw.split('###WINNER:')[1] || null;
    }
    if (Array.isArray(parsed?.women) && Array.isArray(parsed?.men) && parsed.women.length === 6 && parsed.men.length === 6) {
      return { finalists: parsed, winner };
    }
  } catch (e) {
    console.warn('Could not decode finalists from winner column', e);
  }
  return null;
}

// Parses official winner (handles clean strings and embedded FINALISTS payloads)
function parseOfficialWinner(raw) {
  if (!raw) return null;
  let str = String(raw).trim();
  if (str.includes('###WINNER:')) {
    str = (str.split('###WINNER:')[1] || '').trim();
  } else if (str.startsWith('FINALISTS:')) {
    return null; // Contains only active finalists, official winner not declared yet!
  }
  if (!str) return null;
  return parsePrediction(str);
}

// ================= SCORING & TIEBREAKER ALGORITHM =================
function calculateCategoryScore(prediction, real) {
  if (!prediction || !real || !real.climber) {
    return {
      total: 0,
      winnerMatch: false,
      winnerPts: 0,
      topsPts: 0,
      zonesPts: 0,
      attTopPts: 0,
      attZonePts: 0,
      exactBonus: 0,
      attDiff: 99,
      scoreDiff: 99
    };
  }

  const isWinnerMatch = normalize(prediction.climber) === normalize(real.climber);
  const winnerPts = isWinnerMatch ? 50 : 0;

  const topsDiff = Math.abs((prediction.tops ?? 0) - (real.tops ?? 0));
  const topsPts = Math.max(0, 20 - topsDiff * 5);

  const zonesDiff = Math.abs((prediction.zones ?? 0) - (real.zones ?? 0));
  const zonesPts = Math.max(0, 15 - zonesDiff * 4);

  const attTopDiff = Math.abs((prediction.att_top ?? 0) - (real.att_top ?? 0));
  const attTopPts = Math.max(0, 15 - attTopDiff * 2);

  const attZoneDiff = Math.abs((prediction.att_zone ?? 0) - (real.att_zone ?? 0));
  const attZonePts = Math.max(0, 10 - attZoneDiff * 2);

  const isFullExact = isWinnerMatch && (topsDiff === 0) && (zonesDiff === 0) && (attTopDiff === 0) && (attZoneDiff === 0);
  const exactBonus = isFullExact ? 25 : 0;

  const total = winnerPts + topsPts + zonesPts + attTopPts + attZonePts + exactBonus;
  return {
    total,
    winnerMatch: isWinnerMatch,
    winnerPts,
    topsPts,
    zonesPts,
    attTopPts,
    attZonePts,
    exactBonus,
    attDiff: attTopDiff + attZoneDiff,
    scoreDiff: topsDiff + zonesDiff
  };
}

function scoreParticipant(entry, officialWinner) {
  const pred = parsePrediction(entry.climber);
  const hasBothPicks = Boolean(pred?.women?.climber && pred?.men?.climber);
  const womenScore = calculateCategoryScore(pred?.women, officialWinner?.women);
  const menScore = calculateCategoryScore(pred?.men, officialWinner?.men);

  const championMatches = (womenScore.winnerMatch ? 1 : 0) + (menScore.winnerMatch ? 1 : 0);
  const totalPoints = womenScore.total + menScore.total;
  const totalAttemptsDiff = womenScore.attDiff + menScore.attDiff;
  const totalScoreDiff = womenScore.scoreDiff + menScore.scoreDiff;

  return {
    entry,
    pred,
    hasBothPicks,
    championMatches,
    womenScore,
    menScore,
    totalPoints,
    totalAttemptsDiff,
    totalScoreDiff
  };
}

function rankParticipants(entries, officialWinner) {
  if (!officialWinner) return [];
  const scored = entries.map((e) => scoreParticipant(e, officialWinner));

  // Sorting hierarchy:
  // 1. Complete votes first (must have both Women and Men selections)
  // 2. Number of champion matches (2 > 1 > 0)
  // 3. Total points (highest score)
  // 4. Total attempts diff (closest attempts)
  // 5. Total score diff (closest tops & zones)
  scored.sort((a, b) => {
    if (a.hasBothPicks !== b.hasBothPicks) return a.hasBothPicks ? -1 : 1;
    if (b.championMatches !== a.championMatches) return b.championMatches - a.championMatches;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.totalAttemptsDiff !== b.totalAttemptsDiff) return a.totalAttemptsDiff - b.totalAttemptsDiff;
    return a.totalScoreDiff - b.totalScoreDiff;
  });

  const eligible = scored.filter((item) => item.hasBothPicks);
  const incomplete = scored.filter((item) => !item.hasBothPicks);

  // Winner rule: To win, a participant MUST have picked both categories AND matched both champions (2/2)!
  // If no one in the entire contest matched both (0 participants with 2/2), fallback to 1 champion match.
  const match2 = eligible.filter((item) => item.championMatches === 2);
  const candidatePool = match2.length > 0 
    ? match2 
    : eligible.filter((item) => item.championMatches === 1);

  const top = candidatePool.length > 0 ? candidatePool[0] : null;

  let currentRank = 1;
  eligible.forEach((item, index) => {
    if (index > 0) {
      const prev = eligible[index - 1];
      const isTied = (
        item.championMatches === prev.championMatches &&
        item.totalPoints === prev.totalPoints &&
        item.totalAttemptsDiff === prev.totalAttemptsDiff &&
        item.totalScoreDiff === prev.totalScoreDiff
      );
      if (!isTied) {
        currentRank = index + 1;
      }
    } else {
      currentRank = 1;
    }
    item.rank = currentRank;
    item.isWinner = Boolean(
      top &&
      item.championMatches === top.championMatches &&
      item.championMatches > 0 &&
      item.totalPoints === top.totalPoints &&
      item.totalAttemptsDiff === top.totalAttemptsDiff &&
      item.totalScoreDiff === top.totalScoreDiff
    );
    item.isIncomplete = false;
  });

  let nextRank = eligible.length + 1;
  incomplete.forEach((item) => {
    item.rank = nextRank++;
    item.isWinner = false;
    item.isIncomplete = true;
  });

  return scored;
}


// ================= INTERNATIONAL PHONE HELPERS =================
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  let str = String(rawPhone).trim();

  // Strip European national trunk zero notation e.g. +33(0)6... or +44(0)7...
  str = str.replace(/\(0\)/g, '');

  // Strip all spaces, hyphens, dots, parentheses, and slashes
  str = str.replace(/[\s\.\-\(\)\/]/g, '');

  // Convert leading 00 to + (e.g. 0032 -> +32, 0033 -> +33)
  if (str.startsWith('00')) {
    str = '+' + str.slice(2);
  }

  // Belgian local mobile format e.g. 0470123456 -> +32470123456
  // Belgian mobile numbers start with 045, 046, 047, 048, 049 (10 digits total)
  if (/^04[5-9]\d{7}$/.test(str)) {
    str = '+32' + str.slice(1);
  }
  // Auto-correct common Belgian typo where 0 trunk was kept: +320470123456 -> +32470123456
  else if (/^\+320(4[5-9]\d{7})$/.test(str)) {
    str = '+32' + str.slice(4);
  }
  // Dutch local mobile format: 0612345678 (10 digits) -> +31612345678
  else if (/^06\d{8}$/.test(str)) {
    str = '+31' + str.slice(1);
  }
  // French local mobile format: 06... or 07... (10 digits) -> +33...
  else if (/^0[67]\d{8}$/.test(str)) {
    str = '+33' + str.slice(1);
  }
  // German local mobile format: 015..., 016..., 017... -> +49...
  else if (/^01[5-7]\d{7,10}$/.test(str)) {
    str = '+49' + str.slice(1);
  }
  // UK local mobile format: 07... (11 digits) -> +44...
  else if (/^07\d{9}$/.test(str)) {
    str = '+44' + str.slice(1);
  }

  return str;
}

function validatePhoneNumber(rawPhone) {
  if (!rawPhone || !String(rawPhone).trim()) {
    return { valid: false, error: 'Please enter your mobile phone number.' };
  }

  const normalized = normalizePhoneNumber(rawPhone);

  // Must only contain digits and leading +
  if (!/^\+?\d+$/.test(normalized)) {
    return { valid: false, error: 'Phone number may only contain digits and a country code.' };
  }

  // Must start with +
  if (!normalized.startsWith('+')) {
    return {
      valid: false,
      error: 'Please include your country code (e.g. +32 for Belgium, +31 for Netherlands, +33 for France, etc.).'
    };
  }

  const digits = normalized.slice(1);

  // International E.164 total digits: 8 to 15
  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, error: 'Please enter a complete, valid mobile phone number.' };
  }

  // Check for dummy repetitive digits (e.g. 11111111, +32444444444)
  const uniqueDigits = new Set(digits).size;
  if (uniqueDigits <= 2 && digits.length >= 7) {
    return { valid: false, error: 'Please enter a real, valid mobile phone number.' };
  }

  // Check for obvious numeric sequences
  if (/^(012345|123456|234567|345678|456789|987654|876543|765432|654321|543210)/.test(digits.slice(2))) {
    return { valid: false, error: 'Please enter a real, valid mobile phone number.' };
  }

  // 1. BELGIUM (+32)
  if (normalized.startsWith('+32')) {
    const after = normalized.slice(3);
    if (after.startsWith('0')) {
      return {
        valid: false,
        error: 'Invalid Belgian number. Do not include 0 after +32 (e.g. +32 470 12 34 56).'
      };
    }
    // Belgian mobile prefix is strictly 45x, 46x, 47x, 48x, 49x followed by 6 digits (total 9 digits after +32)
    if (!/^4[5-9]\d{7}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid Belgian mobile number. It must be 9 digits starting with 4 (e.g. +32 470 12 34 56 or 0470 12 34 56).'
      };
    }
    return { valid: true, normalized };
  }

  // 2. NETHERLANDS (+31)
  if (normalized.startsWith('+31')) {
    const after = normalized.slice(3);
    if (!/^6\d{8}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid Dutch mobile number. Must be 9 digits starting with 6 (e.g. +31 6 12 34 56 78).'
      };
    }
    return { valid: true, normalized };
  }

  // 3. FRANCE (+33)
  if (normalized.startsWith('+33')) {
    const after = normalized.slice(3);
    if (!/^[67]\d{8}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid French mobile number. Must be 9 digits starting with 6 or 7 (e.g. +33 6 12 34 56 78).'
      };
    }
    return { valid: true, normalized };
  }

  // 4. GERMANY (+49)
  if (normalized.startsWith('+49')) {
    const after = normalized.slice(3);
    if (!/^1[5-7]\d{7,10}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid German mobile number. Must start with 15/16/17 (e.g. +49 151 12345678).'
      };
    }
    return { valid: true, normalized };
  }

  // 5. UNITED KINGDOM (+44)
  if (normalized.startsWith('+44')) {
    const after = normalized.slice(3);
    if (!/^7\d{9}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid UK mobile number. Must be 10 digits starting with 7 (e.g. +44 7123 456789).'
      };
    }
    return { valid: true, normalized };
  }

  // 6. SPAIN (+34)
  if (normalized.startsWith('+34')) {
    const after = normalized.slice(3);
    if (!/^[67]\d{8}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid Spanish mobile number. Must be 9 digits starting with 6 or 7 (e.g. +34 612 345 678).'
      };
    }
    return { valid: true, normalized };
  }

  // 7. ITALY (+39)
  if (normalized.startsWith('+39')) {
    const after = normalized.slice(3);
    if (!/^3\d{8,9}$/.test(after)) {
      return {
        valid: false,
        error: 'Invalid Italian mobile number. Must start with 3 (e.g. +39 312 345 6789).'
      };
    }
    return { valid: true, normalized };
  }

  // 8. OTHER INTERNATIONAL NUMBERS (ITU-T E.164)
  if (!/^\+(?:[1-9]\d{0,2})\d{6,12}$/.test(normalized)) {
    return { valid: false, error: 'Please enter a valid international mobile number with country code.' };
  }

  return { valid: true, normalized };
}

function isValidPhoneNumber(rawPhone) {
  return validatePhoneNumber(rawPhone).valid;
}

function arePhoneNumbersEqual(phoneA, phoneB) {
  const checkA = validatePhoneNumber(phoneA);
  const checkB = validatePhoneNumber(phoneB);
  const a = checkA.normalized || normalizePhoneNumber(phoneA);
  const b = checkB.normalized || normalizePhoneNumber(phoneB);
  if (!a || !b) return false;
  if (a === b) return true;
  const digitsA = a.replace(/^\+/, '');
  const digitsB = b.replace(/^\+/, '');
  if (digitsA === digitsB) return true;
  return false;
}

// ================= SAVED TICKET HELPERS =================
function getSavedTicket() {
  try {
    const raw = localStorage.getItem('blok_voted_ticket');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function renderSavedTicket() {
  const ticket = getSavedTicket();
  if (!ticket) return;

  const successName = document.querySelector('#successName');
  const successPhone = document.querySelector('#successPhone');
  const successPhoneRow = document.querySelector('#successPhoneRow');
  const successWomenPick = document.querySelector('#successWomenPick');
  const successMenPick = document.querySelector('#successMenPick');

  if (successName && ticket.name) successName.textContent = ticket.name;
  if (successPhone && ticket.phone) {
    successPhone.textContent = ticket.phone;
    if (successPhoneRow) successPhoneRow.hidden = false;
  }
  if (successWomenPick && ticket.womenPick) successWomenPick.textContent = ticket.womenPick;
  if (successMenPick && ticket.menPick) successMenPick.textContent = ticket.menPick;
}

// ================= UI HELPERS =================
function showDetailsMessage(message, error = false) {
  if (!detailsMessage) return;
  detailsMessage.textContent = message;
  detailsMessage.classList.toggle('error', error);
}

function setSubmitting(button, submitting) {
  if (!button) return;
  button.disabled = submitting;
  button.style.opacity = submitting ? '.65' : '';
  button.style.cursor = submitting ? 'wait' : '';
}

function showView(viewName, pushHistory = true) {
  if (viewName === 'home') viewName = 'welcome';
  if ((viewName === 'pick-woman' || viewName === 'score-woman' || viewName === 'pick-man' || viewName === 'score-man') && (!pendingParticipant || !pendingParticipant.name || !pendingParticipant.phone)) {
    viewName = 'register';
  }

  if (viewName === 'success') {
    renderSavedTicket();
  }

  if (viewName === 'pick-woman' && typeof renderWomenFinalistPool === 'function') renderWomenFinalistPool();
  if (viewName === 'score-woman' && typeof renderWomenIfscCard === 'function') renderWomenIfscCard();
  if (viewName === 'pick-man' && typeof renderMenFinalistPool === 'function') renderMenFinalistPool();
  if (viewName === 'score-man' && typeof renderMenIfscCard === 'function') renderMenIfscCard();
  if (viewName === 'results' && typeof render === 'function') render();

  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('is-active', view.dataset.view === viewName);
  });
  appFrame.scrollTo({ top: 0, behavior: 'instant' });

  if (pushHistory) {
    if (history.state?.panel === 'admin') {
      history.replaceState({ view: viewName }, '', `#${viewName}`);
    } else if (!history.state || history.state.view !== viewName) {
      history.pushState({ view: viewName }, '', `#${viewName}`);
    }
  }
}

// ================= SEQUENTIAL WIZARD ENGINE =================

// Step 1: Render Women Finalists
function renderWomenFinalistPool() {
  const pool = document.querySelector('#womenFinalistPool');
  if (!pool) return;
  const athletes = FINALISTS.women;
  const selectedClimber = normalize(draftPick.women.climber);

  pool.innerHTML = athletes.map((a) => {
    const isSelected = normalize(a.name) === selectedClimber;
    return `
      <button type="button" class="climber-option ${isSelected ? 'is-selected' : ''}" data-woman-choice="${escapeHtml(a.name)}">
        <span class="bib-tag">${a.bib}</span>
        <span class="climber-meta">
          <b>${escapeHtml(a.name.toUpperCase())}</b>
          <span class="climber-sub">
            <small>${escapeHtml(a.country)}</small>
            ${a.extra ? `<span class="climber-extra">${escapeHtml(a.extra)}</span>` : ''}
          </span>
        </span>
        <span class="chalk-check"></span>
      </button>
    `;
  }).join('');

  pool.querySelectorAll('[data-woman-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      draftPick.women.climber = button.dataset.womanChoice;
      draftPick.women = sanitizeIfsc(draftPick.women);
      renderWomenFinalistPool();
      if (toWomenScoreBtn) toWomenScoreBtn.disabled = !state.predictionsOpen;
    });
  });

  if (toWomenScoreBtn) {
    toWomenScoreBtn.disabled = !draftPick.women.climber || !state.predictionsOpen;
  }
}

// Step 2: Render Women's IFSC Scorecard
function renderWomenIfscCard() {
  const current = draftPick.women;
  const targetNameEl = document.querySelector('#scoreWomanTargetName');
  const liveBadge = document.querySelector('#womenIfscLiveScore');
  const dispAttTop = document.querySelector('#dispWomenAttTop');
  const dispAttZone = document.querySelector('#dispWomenAttZone');

  if (targetNameEl) {
    targetNameEl.textContent = current.climber ? current.climber.toUpperCase() : 'CHAMPION';
  }
  if (liveBadge) liveBadge.textContent = current.scoreStr;
  if (dispAttTop) dispAttTop.textContent = current.att_top;
  if (dispAttZone) dispAttZone.textContent = current.att_zone;

  // Tops Pills
  document.querySelectorAll('#womenTopsPillRow .ifsc-pill').forEach((pill) => {
    const val = parseInt(pill.dataset.val, 10);
    pill.classList.toggle('is-active', val === current.tops);
  });

  // Zones Pills (zones >= tops)
  document.querySelectorAll('#womenZonesPillRow .ifsc-pill').forEach((pill) => {
    const val = parseInt(pill.dataset.val, 10);
    pill.classList.toggle('is-active', val === current.zones);
    pill.classList.toggle('is-disabled', val < current.tops);
  });
}

// Step 3: Render Men Finalists
function renderMenFinalistPool() {
  const pool = document.querySelector('#menFinalistPool');
  if (!pool) return;
  const athletes = FINALISTS.men;
  const selectedClimber = normalize(draftPick.men.climber);

  pool.innerHTML = athletes.map((a) => {
    const isSelected = normalize(a.name) === selectedClimber;
    return `
      <button type="button" class="climber-option ${isSelected ? 'is-selected' : ''}" data-man-choice="${escapeHtml(a.name)}">
        <span class="bib-tag">${a.bib}</span>
        <span class="climber-meta">
          <b>${escapeHtml(a.name.toUpperCase())}</b>
          <span class="climber-sub">
            <small>${escapeHtml(a.country)}</small>
            ${a.extra ? `<span class="climber-extra">${escapeHtml(a.extra)}</span>` : ''}
          </span>
        </span>
        <span class="chalk-check"></span>
      </button>
    `;
  }).join('');

  pool.querySelectorAll('[data-man-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      draftPick.men.climber = button.dataset.manChoice;
      draftPick.men = sanitizeIfsc(draftPick.men);
      renderMenFinalistPool();
      if (toMenScoreBtn) toMenScoreBtn.disabled = !state.predictionsOpen;
    });
  });

  if (toMenScoreBtn) {
    toMenScoreBtn.disabled = !draftPick.men.climber || !state.predictionsOpen;
  }
}

// Step 4: Render Men's IFSC Scorecard
function renderMenIfscCard() {
  const current = draftPick.men;
  const targetNameEl = document.querySelector('#scoreManTargetName');
  const liveBadge = document.querySelector('#menIfscLiveScore');
  const dispAttTop = document.querySelector('#dispMenAttTop');
  const dispAttZone = document.querySelector('#dispMenAttZone');

  if (targetNameEl) {
    targetNameEl.textContent = current.climber ? current.climber.toUpperCase() : 'CHAMPION';
  }
  if (liveBadge) liveBadge.textContent = current.scoreStr;
  if (dispAttTop) dispAttTop.textContent = current.att_top;
  if (dispAttZone) dispAttZone.textContent = current.att_zone;

  // Tops Pills
  document.querySelectorAll('#menTopsPillRow .ifsc-pill').forEach((pill) => {
    const val = parseInt(pill.dataset.val, 10);
    pill.classList.toggle('is-active', val === current.tops);
  });

  // Zones Pills (zones >= tops)
  document.querySelectorAll('#menZonesPillRow .ifsc-pill').forEach((pill) => {
    const val = parseInt(pill.dataset.val, 10);
    pill.classList.toggle('is-active', val === current.zones);
    pill.classList.toggle('is-disabled', val < current.tops);
  });
}

// Setup Event Listeners for IFSC Controls (Tops, Zones, Attempts Steppers)
function setupSequentialControls() {
  // --- Women Tops & Zones Pills ---
  document.querySelectorAll('#womenTopsPillRow .ifsc-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const val = parseInt(pill.dataset.val, 10);
      draftPick.women.tops = val;
      if (draftPick.women.zones < val) draftPick.women.zones = val;
      draftPick.women = sanitizeIfsc(draftPick.women);
      renderWomenIfscCard();
    });
  });

  document.querySelectorAll('#womenZonesPillRow .ifsc-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const val = parseInt(pill.dataset.val, 10);
      if (val < draftPick.women.tops) draftPick.women.tops = val;
      draftPick.women.zones = val;
      draftPick.women = sanitizeIfsc(draftPick.women);
      renderWomenIfscCard();
    });
  });

  // --- Men Tops & Zones Pills ---
  document.querySelectorAll('#menTopsPillRow .ifsc-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const val = parseInt(pill.dataset.val, 10);
      draftPick.men.tops = val;
      if (draftPick.men.zones < val) draftPick.men.zones = val;
      draftPick.men = sanitizeIfsc(draftPick.men);
      renderMenIfscCard();
    });
  });

  document.querySelectorAll('#menZonesPillRow .ifsc-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const val = parseInt(pill.dataset.val, 10);
      if (val < draftPick.men.tops) draftPick.men.tops = val;
      draftPick.men.zones = val;
      draftPick.men = sanitizeIfsc(draftPick.men);
      renderMenIfscCard();
    });
  });

  // --- Stepper (+ / -) for both Women & Men ---
  document.querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category; // 'women' or 'men'
      const field = btn.dataset.field; // 'att_top' or 'att_zone'
      const delta = parseInt(btn.dataset.delta, 10);
      const current = draftPick[cat];

      current[field] = Math.max(0, (current[field] || 0) + delta);
      draftPick[cat] = sanitizeIfsc(current);

      if (cat === 'women') renderWomenIfscCard();
      else renderMenIfscCard();
    });
  });

  // Step 1 -> Step 2: "NEXT: SET HER SCORE"
  if (toWomenScoreBtn) {
    toWomenScoreBtn.addEventListener('click', () => {
      if (!draftPick.women.climber) return;
      renderWomenIfscCard();
      showView('score-woman');
    });
  }

  // Step 2 -> Step 3: "NEXT: PICK MEN'S CHAMPION"
  if (toMenPickBtn) {
    toMenPickBtn.addEventListener('click', () => {
      renderMenFinalistPool();
      showView('pick-man');
    });
  }

  // Step 3 -> Step 4: "NEXT: SET HIS SCORE"
  if (toMenScoreBtn) {
    toMenScoreBtn.addEventListener('click', () => {
      if (!draftPick.men.climber) return;
      renderMenIfscCard();
      showView('score-man');
    });
  }
}

// ================= STATS & CROWD ODDS (WOMEN FIRST) =================
function getCrowdStats() {
  const womenCounts = {};
  const menCounts = {};
  let totalWomen = 0;
  let totalMen = 0;

  state.entries.forEach((entry) => {
    const pred = parsePrediction(entry.climber);
    if (pred?.women?.climber) {
      womenCounts[pred.women.climber] = (womenCounts[pred.women.climber] || 0) + 1;
      totalWomen++;
    }
    if (pred?.men?.climber) {
      menCounts[pred.men.climber] = (menCounts[pred.men.climber] || 0) + 1;
      totalMen++;
    }
  });

  const womenList = Object.entries(womenCounts)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalWomen > 0 ? Math.round((count / totalWomen) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const menList = Object.entries(menCounts)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalMen > 0 ? Math.round((count / totalMen) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  return { womenList, menList, total: state.entries.length };
}

// ================= PUBLIC RESULTS VIEW (WOMEN FIRST) =================
function renderPublicResults() {
  const resultsEl = document.querySelector('#resultsContent');
  if (!resultsEl) return;

  const resultsTitle = document.querySelector('#resultsTitle');
  const official = parseOfficialWinner(state.winner);
  let html = '';

  // OFFICIAL FINALS SCORING & LEADERBOARD
  if (official && (official.women?.climber || official.men?.climber)) {
    if (resultsTitle) {
      resultsTitle.innerHTML = 'CONTEST<br /><span class="title-accent">LEADERBOARD</span>';
    }

    const ranked = rankParticipants(state.entries, official);
    const podiumWinners = ranked.filter((r) => r.isWinner);

    // 1. Official Boulder Champions (Yellow boxes with soft yellow neon, name on tape, score below)
    const champBox = (role, pick, genderClass) => `
      <div class="champ-box ${genderClass}">
        <span class="champ-role">${role}</span>
        <b class="champ-name-tape">${escapeHtml(pick?.climber || 'TBD')}</b>
        <span class="champ-score-pill">${escapeHtml(pick?.scoreStr || '—')}</span>
      </div>
    `;

    html += `
      <div class="champions-grid">
        ${champBox("WOMEN'S CHAMPION", official.women, "champ-women")}
        ${champBox("MEN'S CHAMPION", official.men, "champ-men")}
      </div>
    `;

    // 2. Contest Winners Podium (Names separate, big chalk-smudged tape, total points + predicted IFSC scores)
    if (podiumWinners.length > 0) {
      html += podiumWinners.map((w) => `
        <div class="podium-card podium-chalk">
          <div class="podium-crown" aria-label="Winner Crown">${getUrbanCrownSvg()}</div>
          <div class="podium-name-tape">${escapeHtml(w.entry.name)}</div>
          <div class="podium-points">
            <b>${w.totalPoints}</b>
            <span>PTS / 270</span>
          </div>
          <div class="podium-scores-grid">
            <div class="podium-score-row podium-score-women ${w.womenScore.winnerMatch ? 'is-match' : ''}">
              <span class="podium-score-tag">WOMEN</span>
              <span class="podium-score-climber">${escapeHtml(w.pred?.women?.climber || '—')}</span>
              <span class="podium-score-val">${escapeHtml(w.pred?.women?.scoreStr || '—')}</span>
              <span class="podium-score-pts">+${w.womenScore.total} PTS</span>
            </div>
            <div class="podium-score-row podium-score-men ${w.menScore.winnerMatch ? 'is-match' : ''}">
              <span class="podium-score-tag">MEN</span>
              <span class="podium-score-climber">${escapeHtml(w.pred?.men?.climber || '—')}</span>
              <span class="podium-score-val">${escapeHtml(w.pred?.men?.scoreStr || '—')}</span>
              <span class="podium-score-pts">+${w.menScore.total} PTS</span>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      html += `
        <div class="podium-card podium-chalk is-empty">
          <div class="podium-crown" aria-label="Crown">${getUrbanCrownSvg(56, 40)}</div>
          <h4 class="podium-empty-title">NO PARTICIPANT HIT A CHAMPION</h4>
          <p class="podium-empty-note">To win, a participant must match at least one champion. Check the full ranking below!</p>
        </div>
      `;
    }

    // 3. Full Participant Leaderboard (Original card container, Men's pick BELOW Women's pick)
    if (ranked.length > 0) {
      html += `
        <div class="leaderboard-wrap">
          <div class="leaderboard-header">
            <span class="leaderboard-title">FULL PARTICIPANT LEADERBOARD</span>
            <span class="leaderboard-count">${ranked.length} ENTRIES</span>
          </div>
          <div class="leaderboard-list">
            ${ranked.map((r) => `
              <div class="lb-entry ${r.isWinner ? 'is-winner' : ''} ${r.isIncomplete ? 'is-incomplete' : ''}">
                <span class="lb-rank">#${r.rank}</span>
                <div class="lb-info">
                  <b class="lb-name">${escapeHtml(r.entry.name)}${r.isIncomplete ? ' <i class="lb-flag">INCOMPLETE</i>' : ''}</b>
                  <div class="lb-picks">
                    <div class="lb-pick-row lb-pick-women ${r.womenScore.winnerMatch ? 'is-match' : ''}">
                      <span class="lb-pick-tag">W:</span>
                      <span class="lb-pick-climber">${escapeHtml(r.pred?.women?.climber || '—')}</span>
                      <span class="lb-pick-score">${escapeHtml(r.pred?.women?.scoreStr || '—')}</span>
                    </div>
                    <div class="lb-pick-row lb-pick-men ${r.menScore.winnerMatch ? 'is-match' : ''}">
                      <span class="lb-pick-tag">M:</span>
                      <span class="lb-pick-climber">${escapeHtml(r.pred?.men?.climber || '—')}</span>
                      <span class="lb-pick-score">${escapeHtml(r.pred?.men?.scoreStr || '—')}</span>
                    </div>
                  </div>
                </div>
                <div class="lb-score-col">
                  <b class="lb-pts">${r.totalPoints} PTS</b>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      html += '<p class="empty-results">No spectator predictions entered yet.</p>';
    }

  } else {
    if (resultsTitle) {
      resultsTitle.innerHTML = 'FAN<br /><span class="title-accent">FAVORITES</span>';
    }

    // Pre-results: Live Crowd Odds Breakdown
    html += `
      <div class="deadline-pill" style="margin-bottom: 20px; width: 100%;">
        <span class="status-dot"></span>
        <span>Finals start at <b>20:30</b> · Official score &amp; winners announced after the podium</span>
      </div>
    `;
    // 4. Pre-results: Live Crowd Odds Breakdown (Women First!)
    const crowd = getCrowdStats();
    if (crowd.total > 0) {
      html += `
        <div class="odds-box odds-box-women">
          <div class="odds-header">
            <span class="odds-title odds-title-women">WOMEN'S FINALS FAVORITES</span>
            <span class="odds-total">${crowd.total} total bets</span>
          </div>
          ${crowd.womenList.map((item) => `
            <div class="odds-item">
              <div class="odds-labels">
                <span>${escapeHtml(item.name)}</span>
                <span class="odds-pct">${item.pct}% (${item.count})</span>
              </div>
              <div class="odds-bar-track">
                <div class="odds-bar-fill" style="width: ${item.pct}%"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="odds-box odds-box-men">
          <div class="odds-header">
            <span class="odds-title odds-title-men">MEN'S FINALS FAVORITES</span>
            <span class="odds-total">${crowd.total} total bets</span>
          </div>
          ${crowd.menList.map((item) => `
            <div class="odds-item">
              <div class="odds-labels">
                <span>${escapeHtml(item.name)}</span>
                <span class="odds-pct">${item.pct}% (${item.count})</span>
              </div>
              <div class="odds-bar-track">
                <div class="odds-bar-fill" style="width: ${item.pct}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      if (state.entries.length > 0) {
        html += `
          <div class="leaderboard-wrap" style="margin-top: 24px;">
            <div class="leaderboard-header">
              <span class="leaderboard-title">COMMUNITY PREDICTIONS</span>
              <span class="leaderboard-count">${state.entries.length} ENTRIES</span>
            </div>
            <div class="leaderboard-list">
              ${state.entries.map((entry, index) => {
                const pred = parsePrediction(entry.climber);
                const isComplete = Boolean(pred?.women?.climber && pred?.men?.climber);
                return `
                  <div class="lb-entry ${!isComplete ? 'is-incomplete' : ''}">
                    <span class="lb-rank">#${index + 1}</span>
                    <div class="lb-info">
                      <b class="lb-name">${escapeHtml(entry.name)}${!isComplete ? ' <i class="lb-flag">INCOMPLETE</i>' : ''}</b>
                      <div class="lb-picks">
                        <div class="lb-pick-row lb-pick-women">
                          <span class="lb-pick-tag">W:</span>
                          <span class="lb-pick-climber">${escapeHtml(pred?.women?.climber || '—')}</span>
                          <span class="lb-pick-score">${escapeHtml(pred?.women?.scoreStr || '—')}</span>
                        </div>
                        <div class="lb-pick-row lb-pick-men">
                          <span class="lb-pick-tag">M:</span>
                          <span class="lb-pick-climber">${escapeHtml(pred?.men?.climber || '—')}</span>
                          <span class="lb-pick-score">${escapeHtml(pred?.men?.scoreStr || '—')}</span>
                        </div>
                      </div>
                    </div>
                    <div class="lb-score-col">
                      <span class="lb-status-locked">LOCKED</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    } else {
      html += '<p class="empty-results">No predictions submitted yet. Be the first to vote!</p>';
    }
  }

  resultsEl.innerHTML = html;
}

// ================= RENDER ENTIRE STATE =================
function render() {
  const official = parseOfficialWinner(state.winner);
  const ranked = rankParticipants(state.entries, official);
  const correctCount = ranked.filter((r) => r.isWinner).length;

  document.querySelector('#adminEntryCount').textContent = state.entries.length;
  document.querySelector('#adminWinnerCount').textContent = official ? correctCount : '—';

  // Update Admin Champion Status Badge (Women & Men)
  const championStatusEl = document.querySelector('#championStatus');
  if (championStatusEl) {
    if (official && (official.women?.climber || official.men?.climber)) {
      championStatusEl.textContent = 'DECLARED';
      championStatusEl.className = 'status-badge announced';
      championStatusEl.title = `Official Champions: Women (${official.women?.climber || '—'} ${official.women?.scoreStr || ''}), Men (${official.men?.climber || '—'} ${official.men?.scoreStr || ''})`;
    } else {
      championStatusEl.textContent = 'NOT DECLARED';
      championStatusEl.className = 'status-badge pending';
      championStatusEl.title = 'No champions published yet';
    }
  }

  if (participantNameInput) participantNameInput.disabled = !state.predictionsOpen;
  if (participantPhoneInput) participantPhoneInput.disabled = !state.predictionsOpen;
  if (detailsForm) {
    const subBtn = detailsForm.querySelector('[type="submit"]');
    if (subBtn) subBtn.disabled = !state.predictionsOpen;
  }

  const deadlineEl = document.querySelector('#deadlineNote');
  if (deadlineEl) {
    deadlineEl.innerHTML = state.predictionsOpen
      ? '<span class="status-dot"></span><span>Predictions open until <b>20:30</b> · Finals start at <b>20:30</b></span>'
      : '<span class="status-dot is-closed"></span><span>Predictions are <b> CLOSED</b> · </span>';
  }

  const openStatusEl = document.querySelector('#openStatus');
  if (openStatusEl) {
    openStatusEl.textContent = state.predictionsOpen ? 'OPEN' : 'CLOSED';
    openStatusEl.className = `status-badge ${state.predictionsOpen ? 'open' : 'closed'}`;
  }

  const statusCard = document.querySelector('.admin-status-card');
  if (statusCard) {
    statusCard.classList.toggle('is-open', !!state.predictionsOpen);
    statusCard.classList.toggle('is-closed', !state.predictionsOpen);
  }

  const toggleBtn = document.querySelector('#toggleOpen');
  if (toggleBtn) {
    toggleBtn.textContent = state.predictionsOpen ? 'CLOSE PREDICTIONS NOW' : '🔓 RE-OPEN PREDICTIONS';
    toggleBtn.classList.toggle('is-closed', !state.predictionsOpen);
  }

  // Admin Entries List (Women first)
  const entriesBox = document.querySelector('#adminEntries');
  if (entriesBox) {
    entriesBox.innerHTML = state.entries.length
      ? [...state.entries].reverse().map((entry) => {
          const pred = parsePrediction(entry.climber);
          return `
            <div class="admin-entry">
              <span>
                <b>${escapeHtml(entry.name)}</b>
                <small>${escapeHtml(entry.contactValue || 'NAME ONLY')}</small>
              </span>
              <span>
                W: ${escapeHtml(pred?.women?.climber || '—')} (${escapeHtml(pred?.women?.scoreStr || '')})<br/>
                M: ${escapeHtml(pred?.men?.climber || '—')} (${escapeHtml(pred?.men?.scoreStr || '')})
              </span>
              <span>SUBMITTED</span>
            </div>
          `;
        }).join('')
      : '<p class="admin-empty">No participants registered yet.</p>';
  }

  renderPublicResults();
  renderAdminFinalistOptions();
  updateAdminUi();
}

async function checkAdmin() {
  if (!remoteEnabled) return true;
  try {
    const sessionResponse = await database.auth.getSession();
    const session = sessionResponse.data?.session;
    if (!session) return false;

    // Check admin_users table first
    const response = await database.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!response.error && response.data?.user_id) {
      return true;
    }

    // Since accounts in this project's Auth are created exclusively by the organizer in Supabase,
    // any authenticated session is recognized as an authorized organizer
    return Boolean(session.user);
  } catch (err) {
    console.warn('Could not validate organizer account.', err);
    return false;
  }
}

function updateAdminUi() {
  adminAuth.hidden = isAdmin;
  adminControls.hidden = !isAdmin;
  document.querySelector('#adminLogout').hidden = !remoteEnabled || !isAdmin;
  adminWarning.textContent = remoteEnabled
    ? (isAdmin ? 'Connected to shared Supabase database. Only authorized organizers can publish results.' : 'Sign in with an authorized account to manage the event.')
    : 'Local demo mode: Data stored in this browser only. Configure Supabase to share predictions across all mobiles.';
}

function setPanel(open, pushHistory = true) {
  const wasOpen = !adminPanel.hidden;
  adminPanel.hidden = !open;
  scrim.hidden = !open;
  document.querySelector('#adminToggle').setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    renderAdminRosterSelection();
    renderAdminFinalistOptions();
    const urlInput = document.querySelector('#qrTargetUrl');
    if (urlInput) urlInput.value = getQrTargetUrl();
  }

  if (open && !wasOpen) {
    if (pushHistory) {
      const activeView = document.querySelector('.app-view.is-active')?.dataset.view || 'welcome';
      history.pushState({ view: activeView, panel: 'admin' }, '', '#admin');
    }
  } else if (!open && wasOpen) {
    if (pushHistory && history.state?.panel === 'admin') {
      window.history.back();
    }
  }
}

// ================= SUPABASE DATA SYNC =================
async function loadRemoteState() {
  const requests = [
    database.from('event_settings').select('*').eq('id', 'main').maybeSingle(),
    database.from('predictions').select('id, participant_name, climber_name, created_at').order('created_at', { ascending: true })
  ];
  if (isAdmin) requests.push(database.from('prediction_contacts').select('prediction_id, contact_type, contact_value'));
  
  const responses = await Promise.all(requests);
  const settingsResponse = responses[0];
  const predictionsResponse = responses[1];
  const contactsResponse = responses[2];

  if (settingsResponse.error || predictionsResponse.error) {
    throw settingsResponse.error || predictionsResponse.error;
  }

  const contactsByPrediction = new Map(((contactsResponse && !contactsResponse.error) ? contactsResponse.data || [] : []).map((item) => [item.prediction_id, item]));
  let remoteWinnerRaw = settingsResponse.data?.official_winner || '';
  let remoteFinalistsParsed = null;

  // 1. Check dedicated active_finalists column if present in table
  if (settingsResponse.data?.active_finalists) {
    try {
      const parsedFinalists = typeof settingsResponse.data.active_finalists === 'string'
        ? JSON.parse(settingsResponse.data.active_finalists)
        : settingsResponse.data.active_finalists;
      if (Array.isArray(parsedFinalists?.women) && Array.isArray(parsedFinalists?.men) && parsedFinalists.women.length === 6 && parsedFinalists.men.length === 6) {
        remoteFinalistsParsed = parsedFinalists;
      }
    } catch (e) {
      console.warn('Could not parse remote active_finalists', e);
    }
  }

  // 2. Check fallback inside official_winner column (FINALISTS:<json>)
  if (remoteWinnerRaw && remoteWinnerRaw.includes('FINALISTS:')) {
    const extracted = decodeFinalistsFromWinnerColumn(remoteWinnerRaw);
    if (extracted) {
      if (!remoteFinalistsParsed) {
        remoteFinalistsParsed = extracted.finalists;
      }
      remoteWinnerRaw = extracted.winner || '';
    }
  }

  // Apply parsed finalists if found
  if (remoteFinalistsParsed) {
    FINALISTS = buildFinalistsObject(remoteFinalistsParsed.women, remoteFinalistsParsed.men);
    localStorage.setItem('blok_active_finalists', JSON.stringify({ women: remoteFinalistsParsed.women, men: remoteFinalistsParsed.men }));
  }

  const parsedRemote = parseOfficialWinner(remoteWinnerRaw);
  const isValidRemoteWinner = Boolean(parsedRemote && (parsedRemote.women?.climber || parsedRemote.men?.climber));

  state = {
    entries: (predictionsResponse.data || []).map((item) => ({
      id: item.id,
      name: item.participant_name,
      climber: item.climber_name,
      contactType: contactsByPrediction.get(item.id)?.contact_type || 'name',
      contactValue: contactsByPrediction.get(item.id)?.contact_value || item.participant_name,
      createdAt: item.created_at
    })),
    winner: (isValidRemoteWinner ? (parsedRemote ? encodePrediction(parsedRemote.women, parsedRemote.men) : remoteWinnerRaw) : '') || sessionStorage.getItem('blok_test_winner') || state.winner || '',
    predictionsOpen: settingsResponse.data ? (settingsResponse.data.predictions_open !== false) : state.predictionsOpen
  };
}

async function refresh() {
  if (remoteEnabled) {
    try {
      isAdmin = await checkAdmin();
      await loadRemoteState();
    } catch (error) {
      console.error(error);
      showDetailsMessage('Could not sync predictions. Please try again.', true);
    }
  }
  // Re-render finalist pools on all spectator devices whenever refresh runs!
  renderWomenFinalistPool();
  renderMenFinalistPool();
  renderAdminFinalistOptions();
  render();
}

// ================= STEP 0: PARTICIPANT NAME & INTERNATIONAL PHONE SUBMISSION =================
if (detailsForm) {
  detailsForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = participantNameInput.value.trim();
    const rawPhone = participantPhoneInput ? participantPhoneInput.value.trim() : '';

    if (!name || name.length < 2) {
      participantNameInput.focus();
      return showDetailsMessage('Please enter your full name.', true);
    }

    const phoneValidation = validatePhoneNumber(rawPhone);
    if (!phoneValidation.valid) {
      if (participantPhoneInput) participantPhoneInput.focus();
      return showDetailsMessage(phoneValidation.error, true);
    }
    const phone = phoneValidation.normalized;

    if (!state.predictionsOpen) {
      return showDetailsMessage('Predictions are now closed for the finals.', true);
    }

    // 2. State entries check: has this phone already submitted in the loaded state?
    const isDuplicate = state.entries.some((entry) => arePhoneNumbersEqual(entry.contactValue, phone));
    if (isDuplicate) {
      if (participantPhoneInput) participantPhoneInput.focus();
      return showDetailsMessage('This phone number has already submitted a prediction.', true);
    }

    // 3. Remote Supabase check: check if phone is already registered in prediction_contacts
    if (remoteEnabled) {
      try {
        const check = await database
          .from('prediction_contacts')
          .select('prediction_id, contact_value')
          .eq('contact_value', phone)
          .maybeSingle();

        if (check && check.data && check.data.prediction_id) {
          if (participantPhoneInput) participantPhoneInput.focus();
          return showDetailsMessage('This phone number has already submitted a prediction.', true);
        }
      } catch (err) {
        console.warn('Could not query remote prediction_contacts:', err);
      }
    }

    pendingParticipant = { name, phone };
    document.querySelectorAll('.voting-as-val').forEach((el) => { el.textContent = name; });
    showDetailsMessage('');

    // Reset draft picks
    draftPick = {
      women: { climber: '', tops: 4, zones: 4, att_top: 4, att_zone: 4, scoreStr: '4T4 4Z4' },
      men: { climber: '', tops: 3, zones: 4, att_top: 6, att_zone: 5, scoreStr: '3T6 4Z5' }
    };

    // Begin Step 1: Pick Women's Champion!
    renderWomenFinalistPool();
    showView('pick-woman');
  });

  // Real-time phone hint helper
  if (participantPhoneInput) {
    participantPhoneInput.addEventListener('input', () => {
      const hint = document.querySelector('#phoneHint');
      if (!hint) return;
      const val = participantPhoneInput.value.trim();
      if (!val) {
        hint.textContent = 'Belgian mobile (+32 4xx / 04xx) or international (+31, +33, +49, etc.)';
        hint.className = 'field-hint';
        return;
      }
      const clean = val.replace(/[\s\.\-\(\)\/]/g, '');
      if (clean.startsWith('04') || clean.startsWith('+324') || clean.startsWith('00324')) {
        hint.textContent = '🇧🇪 Belgian mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('06') || clean.startsWith('+316') || clean.startsWith('00316')) {
        hint.textContent = '🇳🇱 Dutch mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('06') || clean.startsWith('07') || clean.startsWith('+336') || clean.startsWith('+337') || clean.startsWith('00336')) {
        hint.textContent = '🇫🇷 French mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('+49') || clean.startsWith('0049') || clean.startsWith('015') || clean.startsWith('016') || clean.startsWith('017')) {
        hint.textContent = '🇩🇪 German mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('+44') || clean.startsWith('0044') || clean.startsWith('07')) {
        hint.textContent = '🇬🇧 UK mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('+34') || clean.startsWith('0034')) {
        hint.textContent = '🇪🇸 Spanish mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('+39') || clean.startsWith('0039')) {
        hint.textContent = '🇮🇹 Italian mobile detected';
        hint.className = 'field-hint is-matched';
      } else if (clean.startsWith('+')) {
        hint.textContent = '🌍 International mobile with country code';
        hint.className = 'field-hint is-matched';
      } else {
        hint.textContent = '💡 Please include your country code (e.g. +32, +31, +33, +49)';
        hint.className = 'field-hint is-warn';
      }
    });
  }
}

// ================= STEP 4: CONFIRM AND SUBMIT ALL PREDICTIONS =================
if (confirmPredictionBtn) {
  confirmPredictionBtn.addEventListener('click', async () => {
    if (!pendingParticipant || !pendingParticipant.name || !pendingParticipant.phone) {
      showView('register');
      return;
    }

    if (!draftPick.women.climber || !draftPick.men.climber) {
      return showDetailsMessage("Please complete both Women's and Men's predictions.", true);
    }

    if (!state.predictionsOpen) {
      return showDetailsMessage('Predictions are now closed.', true);
    }

    setSubmitting(confirmPredictionBtn, true);

    const name = pendingParticipant.name;
    const phone = pendingParticipant.phone;
    const finalWomen = sanitizeIfsc(draftPick.women);
    const finalMen = sanitizeIfsc(draftPick.men);
    const compactPayload = encodePrediction(finalWomen, finalMen);

    try {
      if (remoteEnabled) {
        // 1. Insert prediction record
        const predResponse = await database.from('predictions').insert({
          participant_name: name,
          climber_name: compactPayload
        }).select('id').single();

        if (predResponse.error) throw predResponse.error;
        const predId = predResponse.data.id;

        // 2. Insert contact record with phone (protected by unique index in database)
        if (phone) {
          const contactResponse = await database.from('prediction_contacts').insert({
            prediction_id: predId,
            contact_type: 'phone',
            contact_value: phone
          });

          if (contactResponse.error) {
            // Duplicate phone caught by database unique index!
            if (contactResponse.error.code === '23505' || String(contactResponse.error.message).includes('unique')) {
              await database.from('predictions').delete().eq('id', predId);
              showDetailsMessage('This phone number has already submitted a prediction.', true);
              showView('register');
              return;
            }
            console.warn('Could not save contact record:', contactResponse.error);
          }
        }

        const ticket = {
          name,
          phone,
          womenPick: `${finalWomen.climber} (${finalWomen.scoreStr})`,
          menPick: `${finalMen.climber} (${finalMen.scoreStr})`,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('blok_voted_phone', phone);
        localStorage.setItem('blok_voted_name', name);
        localStorage.setItem('blok_voted_ticket', JSON.stringify(ticket));
        await refresh();
      } else {
        // Local mode
        state.entries.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name,
          climber: compactPayload,
          contactType: 'phone',
          contactValue: phone,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        const ticket = {
          name,
          phone,
          womenPick: `${finalWomen.climber} (${finalWomen.scoreStr})`,
          menPick: `${finalMen.climber} (${finalMen.scoreStr})`,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('blok_voted_phone', phone);
        localStorage.setItem('blok_voted_name', name);
        localStorage.setItem('blok_voted_ticket', JSON.stringify(ticket));
        render();
      }

      renderSavedTicket();

      if (detailsForm) detailsForm.reset();
      pendingParticipant = null;
      showView('success');
    } catch (error) {
      console.error('Submission error:', error);
      showDetailsMessage(error.message || 'Could not save prediction. Please try again.', true);
      showView('register');
    } finally {
      setSubmitting(confirmPredictionBtn, false);
    }
  });
}

// ================= ADMIN: MANUAL FINALISTS & WINNER SELECTION =================
function renderAdminFinalistOptions() {
  const adminWomenWinner = document.querySelector('#adminWomenWinner');
  const adminMenWinner = document.querySelector('#adminMenWinner');
  const womenChips = document.querySelector('#adminWomenWinnerChips');
  const menChips = document.querySelector('#adminMenWinnerChips');

  // Populate datalists so suggestions prioritize the 12 active finalists, followed by known competitors
  const dlWomen = document.querySelector('#knownCompetitorsWomen');
  const dlMen = document.querySelector('#knownCompetitorsMen');
  if (dlWomen) {
    const list = [...FINALISTS.women, ...ALL_COMPETITORS.women.filter((c) => !FINALISTS.women.some((w) => normalize(w.name) === normalize(c.name)))];
    dlWomen.innerHTML = list.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.flag || '🧗')} ${escapeHtml(c.code || c.country || 'FINALIST')}</option>`).join('');
  }
  if (dlMen) {
    const list = [...FINALISTS.men, ...ALL_COMPETITORS.men.filter((c) => !FINALISTS.men.some((m) => normalize(m.name) === normalize(c.name)))];
    dlMen.innerHTML = list.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.flag || '🧗')} ${escapeHtml(c.code || c.country || 'FINALIST')}</option>`).join('');
  }

  // Render Women Chips
  if (womenChips) {
    const currentVal = normalize(adminWomenWinner ? adminWomenWinner.value : '');
    womenChips.innerHTML = FINALISTS.women.map((w, idx) => {
      const isSelected = normalize(w.name) === currentVal;
      return `
        <button type="button" class="admin-chip-btn ${isSelected ? 'is-selected' : ''}" data-winner-gender="women" data-winner-name="${escapeHtml(w.name)}">
          <span class="chip-bib">#0${idx + 1}</span>
          <span class="chip-name">${escapeHtml(w.name)}</span>
        </button>
      `;
    }).join('');

    womenChips.querySelectorAll('[data-winner-gender="women"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!adminWomenWinner) return;
        adminWomenWinner.value = btn.dataset.winnerName;
        womenChips.querySelectorAll('.admin-chip-btn').forEach((c) => c.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        if (typeof updateAdminBadges === 'function') updateAdminBadges();
      });
    });
  }

  // Render Men Chips
  if (menChips) {
    const currentVal = normalize(adminMenWinner ? adminMenWinner.value : '');
    menChips.innerHTML = FINALISTS.men.map((m, idx) => {
      const isSelected = normalize(m.name) === currentVal;
      return `
        <button type="button" class="admin-chip-btn ${isSelected ? 'is-selected' : ''}" data-winner-gender="men" data-winner-name="${escapeHtml(m.name)}">
          <span class="chip-bib">#0${idx + 1}</span>
          <span class="chip-name">${escapeHtml(m.name)}</span>
        </button>
      `;
    }).join('');

    menChips.querySelectorAll('[data-winner-gender="men"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!adminMenWinner) return;
        adminMenWinner.value = btn.dataset.winnerName;
        menChips.querySelectorAll('.admin-chip-btn').forEach((c) => c.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        if (typeof updateAdminBadges === 'function') updateAdminBadges();
      });
    });
  }

  // Wire input listeners for live chip sync
  if (adminWomenWinner && !adminWomenWinner.dataset.wired) {
    adminWomenWinner.dataset.wired = 'true';
    adminWomenWinner.addEventListener('input', () => {
      const val = normalize(adminWomenWinner.value);
      womenChips?.querySelectorAll('.admin-chip-btn').forEach((btn) => {
        btn.classList.toggle('is-selected', normalize(btn.dataset.winnerName) === val);
      });
    });
  }

  if (adminMenWinner && !adminMenWinner.dataset.wired) {
    adminMenWinner.dataset.wired = 'true';
    adminMenWinner.addEventListener('input', () => {
      const val = normalize(adminMenWinner.value);
      menChips?.querySelectorAll('.admin-chip-btn').forEach((btn) => {
        btn.classList.toggle('is-selected', normalize(btn.dataset.winnerName) === val);
      });
    });
  }

  // Wire clear buttons
  const wClear = document.querySelector('#adminWomenWinnerClear');
  if (wClear && !wClear.dataset.wired) {
    wClear.dataset.wired = 'true';
    wClear.addEventListener('click', () => {
      if (adminWomenWinner) adminWomenWinner.value = '';
      womenChips?.querySelectorAll('.admin-chip-btn').forEach((btn) => btn.classList.remove('is-selected'));
    });
  }

  const mClear = document.querySelector('#adminMenWinnerClear');
  if (mClear && !mClear.dataset.wired) {
    mClear.dataset.wired = 'true';
    mClear.addEventListener('click', () => {
      if (adminMenWinner) adminMenWinner.value = '';
      menChips?.querySelectorAll('.admin-chip-btn').forEach((btn) => btn.classList.remove('is-selected'));
    });
  }
}

function updateRosterBadges() {
  const womenInputs = Array.from(document.querySelectorAll('.roster-input[data-roster-gender="women"]'));
  const menInputs = Array.from(document.querySelectorAll('.roster-input[data-roster-gender="men"]'));
  const womenCountEl = document.querySelector('#adminWomenSelectedCount');
  const menCountEl = document.querySelector('#adminMenSelectedCount');
  const rosterStatusBadge = document.querySelector('#rosterStatusBadge');

  const wCount = womenInputs.filter((i) => i.value.trim().length > 0).length;
  const mCount = menInputs.filter((i) => i.value.trim().length > 0).length;

  if (womenCountEl) {
    if (wCount === 6) {
      womenCountEl.textContent = '6 / 6 READY';
      womenCountEl.className = 'admin-cat-badge badge-yellow';
    } else {
      womenCountEl.textContent = `${wCount} / 6 (${6 - wCount} EMPTY)`;
      womenCountEl.className = 'admin-cat-badge badge-dim';
    }
  }

  if (menCountEl) {
    if (mCount === 6) {
      menCountEl.textContent = '6 / 6 READY';
      menCountEl.className = 'admin-cat-badge badge-pink';
    } else {
      menCountEl.textContent = `${mCount} / 6 (${6 - mCount} EMPTY)`;
      menCountEl.className = 'admin-cat-badge badge-dim';
    }
  }

  if (rosterStatusBadge) {
    if (wCount === 6 && mCount === 6) {
      rosterStatusBadge.textContent = '12 READY';
      rosterStatusBadge.className = 'status-badge open';
    } else {
      rosterStatusBadge.textContent = `${wCount + mCount} / 12`;
      rosterStatusBadge.className = 'status-badge pending';
    }
  }
}

function renderAdminRosterSelection(forceRebuild = false) {
  const womenList = document.querySelector('#womenRosterInputsList');
  const menList = document.querySelector('#menRosterInputsList');
  if (!womenList || !menList) return;

  // Datalists for quick completion of known competitors
  const dlWomen = document.querySelector('#knownCompetitorsWomen');
  const dlMen = document.querySelector('#knownCompetitorsMen');
  if (dlWomen) {
    dlWomen.innerHTML = ALL_COMPETITORS.women.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.flag)} ${escapeHtml(c.code)}</option>`).join('');
  }
  if (dlMen) {
    dlMen.innerHTML = ALL_COMPETITORS.men.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.flag)} ${escapeHtml(c.code)}</option>`).join('');
  }

  // Check if inputs already exist in the DOM and we're not forcing rebuild
  const existingWomenInputs = womenList.querySelectorAll('.roster-input');
  if (existingWomenInputs.length === 6 && !forceRebuild) {
    updateRosterBadges();
    return;
  }

  // Check if saved finalists exist in localStorage
  let savedFinalists = null;
  try {
    const raw = localStorage.getItem('blok_active_finalists');
    if (raw) savedFinalists = JSON.parse(raw);
  } catch (e) {}

  const initialWomen = savedFinalists?.women || [];
  const initialMen = savedFinalists?.men || [];

  const makeRow = (gender, index, value = '', datalistId) => `
    <div class="roster-slot-row" id="slotRow_${gender}_${index}">
      <span class="roster-slot-bib">#0${index + 1}</span>
      <input type="text"
             class="roster-input"
             data-roster-gender="${gender}"
             data-roster-index="${index}"
             placeholder="Finalist #${index + 1} Full Name..."
             list="${datalistId}"
             value="${escapeHtml(value)}"
             autocomplete="off"
             spellcheck="false" />
      <button type="button" class="roster-slot-clear" data-clear-gender="${gender}" data-clear-index="${index}" title="Clear slot">✕</button>
    </div>
  `;

  womenList.innerHTML = Array.from({ length: 6 }).map((_, i) => makeRow('women', i, initialWomen[i] || '', 'knownCompetitorsWomen')).join('');
  menList.innerHTML = Array.from({ length: 6 }).map((_, i) => makeRow('men', i, initialMen[i] || '', 'knownCompetitorsMen')).join('');

  // Wire input listeners for live counter
  document.querySelectorAll('.roster-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      inp.closest('.roster-slot-row')?.classList.remove('is-empty-warning');
      const msg = document.querySelector('#adminRosterMessage');
      if (msg) msg.textContent = '';
      updateRosterBadges();
    });
  });

  // Wire clear buttons
  document.querySelectorAll('.roster-slot-clear').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.clearGender;
      const idx = btn.dataset.clearIndex;
      const targetInput = document.querySelector(`.roster-input[data-roster-gender="${g}"][data-roster-index="${idx}"]`);
      if (targetInput) {
        targetInput.value = '';
        targetInput.focus();
        updateRosterBadges();
      }
    });
  });

  updateRosterBadges();
}

async function saveActiveFinalists(womenNames, menNames) {
  if (!Array.isArray(womenNames) || womenNames.length !== 6 || !Array.isArray(menNames) || menNames.length !== 6) {
    throw new Error('Please enter exactly 6 women and 6 men finalists.');
  }

  FINALISTS = buildFinalistsObject(womenNames, menNames);
  const payload = { women: womenNames, men: menNames };
  const payloadJson = JSON.stringify(payload);
  localStorage.setItem('blok_active_finalists', payloadJson);

  // If draft predictions selected someone who is no longer a finalist, clear them
  if (draftPick.women.climber && !FINALISTS.women.some((w) => normalize(w.name) === normalize(draftPick.women.climber))) {
    draftPick.women.climber = '';
  }
  if (draftPick.men.climber && !FINALISTS.men.some((m) => normalize(m.name) === normalize(draftPick.men.climber))) {
    draftPick.men.climber = '';
  }

  // Update Remote Supabase if enabled
  if (remoteEnabled) {
    let savedToCloud = false;
    let cloudError = null;

    // Strategy 1: Try updating the active_finalists column if it exists in Supabase
    try {
      const resp1 = await database.from('event_settings').update({
        active_finalists: payloadJson,
        updated_at: new Date().toISOString()
      }).eq('id', 'main');

      if (!resp1.error) {
        savedToCloud = true;
      } else {
        cloudError = resp1.error;
      }
    } catch (e) {
      cloudError = e;
    }

    // Strategy 2 (Guaranteed Fallback): If active_finalists column does not exist (PGRST204),
    // store inside official_winner column which exists in all Supabase instances!
    if (!savedToCloud) {
      try {
        const currentResp = await database.from('event_settings').select('official_winner').eq('id', 'main').maybeSingle();
        const existingWinnerStr = currentResp?.data?.official_winner || '';
        const combined = encodeFinalistsInWinnerColumn(payload, existingWinnerStr);

        const resp2 = await database.from('event_settings').update({
          official_winner: combined,
          updated_at: new Date().toISOString()
        }).eq('id', 'main');

        if (!resp2.error) {
          savedToCloud = true;
          cloudError = null;
        } else {
          cloudError = resp2.error;
        }
      } catch (e) {
        cloudError = e;
      }
    }

    if (!savedToCloud) {
      console.error('Failed to save finalists to cloud:', cloudError);
      throw new Error(`Cloud database error: ${cloudError?.message || 'Permission denied or connection error'}. Finalists could not be published to spectators!`);
    }
  }

  renderWomenFinalistPool();
  renderMenFinalistPool();
  renderAdminFinalistOptions();
  render();
}

// Reset / Clear All Slots Button
const resetRosterBtn = document.querySelector('#resetRosterBtn');
if (resetRosterBtn) {
  resetRosterBtn.addEventListener('click', () => {
    document.querySelectorAll('.roster-input').forEach((inp) => {
      inp.value = '';
      inp.closest('.roster-slot-row')?.classList.remove('is-empty-warning');
    });
    const rosterMessage = document.querySelector('#adminRosterMessage');
    if (rosterMessage) {
      rosterMessage.textContent = 'All finalist slots cleared. Enter the 6 women and 6 men by hand.';
      rosterMessage.style.color = 'var(--chalk-dim)';
    }
    updateRosterBadges();
  });
}

// Quick Paste Handlers
const pasteToWomenBtn = document.querySelector('#pasteToWomenBtn');
if (pasteToWomenBtn) {
  pasteToWomenBtn.addEventListener('click', () => {
    const ta = document.querySelector('#rosterPasteArea');
    if (!ta) return;
    const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const wInputs = document.querySelectorAll('.roster-input[data-roster-gender="women"]');
    wInputs.forEach((inp, i) => {
      if (lines[i]) inp.value = lines[i];
    });
    updateRosterBadges();
  });
}

const pasteToMenBtn = document.querySelector('#pasteToMenBtn');
if (pasteToMenBtn) {
  pasteToMenBtn.addEventListener('click', () => {
    const ta = document.querySelector('#rosterPasteArea');
    if (!ta) return;
    const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const mInputs = document.querySelectorAll('.roster-input[data-roster-gender="men"]');
    mInputs.forEach((inp, i) => {
      if (lines[i]) inp.value = lines[i];
    });
    updateRosterBadges();
  });
}

// Save / Publish 12 Finalists Button
const saveFinalistsBtn = document.querySelector('#saveFinalistsBtn');
if (saveFinalistsBtn) {
  saveFinalistsBtn.addEventListener('click', async () => {
    const rosterMessage = document.querySelector('#adminRosterMessage');
    const wInputs = Array.from(document.querySelectorAll('.roster-input[data-roster-gender="women"]'));
    const mInputs = Array.from(document.querySelectorAll('.roster-input[data-roster-gender="men"]'));

    let hasEmpty = false;
    wInputs.forEach((inp) => {
      const isEmpty = !inp.value.trim();
      inp.closest('.roster-slot-row')?.classList.toggle('is-empty-warning', isEmpty);
      if (isEmpty) hasEmpty = true;
    });
    mInputs.forEach((inp) => {
      const isEmpty = !inp.value.trim();
      inp.closest('.roster-slot-row')?.classList.toggle('is-empty-warning', isEmpty);
      if (isEmpty) hasEmpty = true;
    });

    const womenNames = wInputs.map((i) => i.value.trim()).filter(Boolean);
    const menNames = mInputs.map((i) => i.value.trim()).filter(Boolean);

    if (womenNames.length !== 6 || menNames.length !== 6) {
      if (rosterMessage) {
        rosterMessage.textContent = `⚠️ Please fill all 6 women and all 6 men slots (currently: ${womenNames.length} women, ${menNames.length} men).`;
        rosterMessage.style.color = '#f87171';
      }
      return;
    }

    setSubmitting(saveFinalistsBtn, true);
    if (rosterMessage) {
      rosterMessage.textContent = 'Saving and publishing finalists...';
      rosterMessage.style.color = 'var(--chalk-dim)';
    }

    try {
      await saveActiveFinalists(womenNames, menNames);
      if (rosterMessage) {
        rosterMessage.textContent = '✓ 12 Finalists successfully published & locked for voting!';
        rosterMessage.style.color = 'var(--tape-yellow-soft)';
      }
    } catch (err) {
      if (rosterMessage) {
        rosterMessage.textContent = `❌ ${err.message || 'Error saving finalists'}`;
        rosterMessage.style.color = '#f87171';
      }
    } finally {
      setSubmitting(saveFinalistsBtn, false);
    }
  });
}

// ================= ADMIN: ENTER OFFICIAL FINALS RESULTS (WOMEN FIRST) =================
const officialResultsForm = document.querySelector('#officialResultsForm');
if (officialResultsForm) {
  const adminWomenWinner = document.querySelector('#adminWomenWinner');
  const adminWomenTops = document.querySelector('#adminWomenTops');
  const adminWomenZones = document.querySelector('#adminWomenZones');
  const adminWomenAttTop = document.querySelector('#adminWomenAttTop');
  const adminWomenAttZone = document.querySelector('#adminWomenAttZone');
  const adminWomenBadge = document.querySelector('#adminWomenLiveScore');

  const adminMenWinner = document.querySelector('#adminMenWinner');
  const adminMenTops = document.querySelector('#adminMenTops');
  const adminMenZones = document.querySelector('#adminMenZones');
  const adminMenAttTop = document.querySelector('#adminMenAttTop');
  const adminMenAttZone = document.querySelector('#adminMenAttZone');
  const adminMenBadge = document.querySelector('#adminMenLiveScore');

  function updateAdminBadges() {
    if (adminWomenBadge && adminWomenTops && adminWomenZones && adminWomenAttTop && adminWomenAttZone) {
      const wT = adminWomenTops.value.trim();
      const wZ = adminWomenZones.value.trim();
      const wAT = adminWomenAttTop.value.trim();
      const wAZ = adminWomenAttZone.value.trim();

      if (wT === '' && wZ === '' && wAT === '' && wAZ === '') {
        adminWomenBadge.textContent = '—';
      } else {
        const women = sanitizeIfsc({
          tops: wT === '' ? 0 : wT,
          zones: wZ === '' ? 0 : wZ,
          att_top: wAT === '' ? 0 : wAT,
          att_zone: wAZ === '' ? 0 : wAZ
        });
        adminWomenBadge.textContent = women.scoreStr;
      }
    }
    if (adminMenBadge && adminMenTops && adminMenZones && adminMenAttTop && adminMenAttZone) {
      const mT = adminMenTops.value.trim();
      const mZ = adminMenZones.value.trim();
      const mAT = adminMenAttTop.value.trim();
      const mAZ = adminMenAttZone.value.trim();

      if (mT === '' && mZ === '' && mAT === '' && mAZ === '') {
        adminMenBadge.textContent = '—';
      } else {
        const men = sanitizeIfsc({
          tops: mT === '' ? 0 : mT,
          zones: mZ === '' ? 0 : mZ,
          att_top: mAT === '' ? 0 : mAT,
          att_zone: mAZ === '' ? 0 : mAZ
        });
        adminMenBadge.textContent = men.scoreStr;
      }
    }
  }

  [adminWomenTops, adminWomenZones, adminWomenAttTop, adminWomenAttZone, adminMenTops, adminMenZones, adminMenAttTop, adminMenAttZone].forEach((input) => {
    if (input) input.addEventListener('input', updateAdminBadges);
  });

  officialResultsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const womenWinner = adminWomenWinner.value;
    const menWinner = adminMenWinner.value;

    if (!womenWinner || !menWinner) {
      return window.alert("Please select both a Women's and Men's champion.");
    }

    if (adminWomenTops.value.trim() === '' || adminWomenZones.value.trim() === '' ||
        adminMenTops.value.trim() === '' || adminMenZones.value.trim() === '') {
      return window.alert("Please fill in the official Tops and Zones for both categories.");
    }

    const officialResult = {
      women: sanitizeIfsc({
        climber: womenWinner,
        tops: adminWomenTops.value,
        zones: adminWomenZones.value,
        att_top: adminWomenAttTop.value,
        att_zone: adminWomenAttZone.value
      }),
      men: sanitizeIfsc({
        climber: menWinner,
        tops: adminMenTops.value,
        zones: adminMenZones.value,
        att_top: adminMenAttTop.value,
        att_zone: adminMenAttZone.value
      })
    };

    const officialCompactStr = encodePrediction(officialResult.women, officialResult.men);

    state.winner = officialCompactStr;
    state.predictionsOpen = false;
    sessionStorage.setItem('blok_test_winner', officialCompactStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();

    setPanel(false, false);
    showView('results');

    if (remoteEnabled) {
      const button = event.currentTarget.querySelector('button[type="submit"]');
      setSubmitting(button, true);
      try {
        // If finalists are stored in official_winner (due to missing active_finalists column),
        // preserve the finalists while adding the official winner!
        const currentResp = await database.from('event_settings').select('official_winner, active_finalists').eq('id', 'main').maybeSingle();
        let winnerValToSave = officialCompactStr;
        if (!currentResp?.data?.active_finalists) {
          const currentFinalistsRaw = localStorage.getItem('blok_active_finalists');
          if (currentFinalistsRaw) {
            try {
              const currentFinalists = JSON.parse(currentFinalistsRaw);
              winnerValToSave = encodeFinalistsInWinnerColumn(currentFinalists, officialCompactStr);
            } catch (e) {}
          }
        }

        const resp = await database.from('event_settings').update({
          official_winner: winnerValToSave,
          predictions_open: false,
          updated_at: new Date().toISOString()
        }).eq('id', 'main');

        if (resp.error) throw resp.error;
      } catch (error) {
        console.error('Could not sync official winner to remote:', error);
        window.alert('⚠️ Cloud database error: ' + (error.message || 'Could not save official winners.'));
      } finally {
        setSubmitting(button, false);
      }
    }
  });

  // ================= ADMIN: RESET OFFICIAL RESULTS ONLY =================
  const resetResultsBtn = document.querySelector('#resetResultsBtn');

  async function handleResetOfficialResults() {
    const confirmation = window.confirm(
      '↺ Are you sure you want to reset the official finals results?\n\nThis will clear the official champions and restore the public view to favorites. Registered spectator predictions will be preserved.'
    );
    if (!confirmation) return;

    if (resetResultsBtn) setSubmitting(resetResultsBtn, true);

    try {
      // 1. Reset local state & session storage
      state.winner = '';
      sessionStorage.removeItem('blok_test_winner');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 2. Clear input controls in Admin form
      if (adminWomenWinner) adminWomenWinner.value = '';
      if (adminWomenTops) adminWomenTops.value = '';
      if (adminWomenZones) adminWomenZones.value = '';
      if (adminWomenAttTop) adminWomenAttTop.value = '';
      if (adminWomenAttZone) adminWomenAttZone.value = '';
      if (adminWomenBadge) adminWomenBadge.textContent = '—';
      document.querySelectorAll('#adminWomenWinnerChips .admin-chip-btn').forEach((b) => b.classList.remove('is-selected'));

      if (adminMenWinner) adminMenWinner.value = '';
      if (adminMenTops) adminMenTops.value = '';
      if (adminMenZones) adminMenZones.value = '';
      if (adminMenAttTop) adminMenAttTop.value = '';
      if (adminMenAttZone) adminMenAttZone.value = '';
      if (adminMenBadge) adminMenBadge.textContent = '—';
      document.querySelectorAll('#adminMenWinnerChips .admin-chip-btn').forEach((b) => b.classList.remove('is-selected'));

      // 3. Update Supabase if connected
      if (remoteEnabled) {
        try {
          // If finalists are encoded in official_winner, preserve finalists and clear only the winner!
          const currentResp = await database.from('event_settings').select('official_winner, active_finalists').eq('id', 'main').maybeSingle();
          let resetValToSave = null;
          if (!currentResp?.data?.active_finalists) {
            const currentFinalistsRaw = localStorage.getItem('blok_active_finalists');
            if (currentFinalistsRaw) {
              try {
                const currentFinalists = JSON.parse(currentFinalistsRaw);
                resetValToSave = encodeFinalistsInWinnerColumn(currentFinalists, '');
              } catch (e) {}
            }
          }

          const { data, error } = await database.from('event_settings').update({
            official_winner: resetValToSave,
            updated_at: new Date().toISOString()
          }).eq('id', 'main').select('id');

          if (error) {
            console.warn('Remote reset warning:', error);
            window.alert('⚠️ Database error: ' + error.message);
          } else if (!data || data.length === 0) {
            console.warn('RLS blocked event_settings update: 0 rows returned.');
            window.alert(
              '⚠️ Supabase Row Level Security (RLS) blocked the remote update.\n\nTo allow updating results from the web app, run this query in Supabase SQL Editor:\n\nDROP POLICY IF EXISTS "admins can change event settings" ON public.event_settings;\nCREATE POLICY "public change settings" ON public.event_settings FOR UPDATE USING (true) WITH CHECK (true);'
            );
          } else {
            window.alert('✅ Official results have been reset in the database.');
          }
          await refresh();
        } catch (err) {
          console.error(err);
        }
      } else {
        render();
        window.alert('✅ Official results have been reset.');
      }
    } catch (err) {
      console.error(err);
      window.alert('Error resetting official results.');
    } finally {
      if (resetResultsBtn) setSubmitting(resetResultsBtn, false);
    }
  }

  if (resetResultsBtn) resetResultsBtn.addEventListener('click', handleResetOfficialResults);
}


// ================= ADMIN: TOGGLE PREDICTIONS POOL =================
document.querySelector('#toggleOpen').addEventListener('click', async (event) => {
  const open = !state.predictionsOpen;
  const button = event.currentTarget;

  state.predictionsOpen = open;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();

  if (remoteEnabled) {
    setSubmitting(button, true);
    try {
      await database.from('event_settings').update({ 
        predictions_open: open, 
        updated_at: new Date().toISOString() 
      }).eq('id', 'main');
    } catch (error) {
      console.warn('Remote sync error:', error);
    } finally {
      setSubmitting(button, false);
    }
  }
});

// ================= ADMIN: DELETE PARTICIPANTS ONLY =================
const clearDataBtn = document.querySelector('#clearData');
if (clearDataBtn) {
  clearDataBtn.addEventListener('click', async () => {
    const confirmation = window.confirm(
      '⚠️ Are you sure you want to delete all participant records?\n\nThis will permanently remove all spectator bets and predictions, while keeping your official champions and results intact.'
    );

    if (!confirmation) return;

    setSubmitting(clearDataBtn, true);

    try {
      if (remoteEnabled) {
        // 1. Delete associated contacts first if any exist
        try {
          await database.from('prediction_contacts').delete().neq('prediction_id', '00000000-0000-0000-0000-000000000000');
        } catch (e) {
          console.warn('Contacts cleanup:', e);
        }

        // 2. Delete all participant predictions
        const deleteResp = await database.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000').select('id');

        if (deleteResp.error) {
          console.error('Delete predictions error:', deleteResp.error);
          window.alert('⚠️ Database error: ' + deleteResp.error.message);
        } else if (state.entries.length > 0 && (!deleteResp.data || deleteResp.data.length === 0)) {
          // Supabase RLS blocked deletion because anon delete policy is missing
          window.alert(
            '⚠️ Supabase Row Level Security (RLS) blocked the delete.\n\nTo allow deleting participants, run this 1-line query in Supabase SQL Editor:\n\nCREATE POLICY "public delete predictions" ON public.predictions FOR DELETE USING (true);'
          );
        } else {
          window.alert('✅ All participant records have been deleted successfully.');
        }

        // Clear local entries and refresh UI
        state.entries = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        await refresh();
      } else {
        state.entries = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
        window.alert('✅ All participant records have been deleted successfully.');
      }
    } catch (err) {
      console.error(err);
      window.alert('Error deleting participant records.');
    } finally {
      setSubmitting(clearDataBtn, false);
    }
  });
}


// ================= EVENT QR CODE ENGINE =================
let screenQrInstance = null;

function getQrTargetUrl() {
  const saved = localStorage.getItem('blok_qr_custom_url');
  if (saved && saved.trim()) return saved.trim();
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin + window.location.pathname;
  }
  return 'https://blok-prediction.onrender.com';
}

function renderQrCode(customUrl) {
  const targetUrl = customUrl || getQrTargetUrl();
  const qrContainer = document.querySelector('#qrCodeContainer');
  const urlInput = document.querySelector('#qrTargetUrl');
  const modalUrlDisplay = document.querySelector('#modalUrlDisplay');

  if (urlInput) urlInput.value = targetUrl;
  if (modalUrlDisplay) {
    modalUrlDisplay.textContent = targetUrl.replace(/^https?:\/\//, '');
  }

  if (typeof QRCode === 'undefined') {
    console.warn('QRCode library not ready yet');
    return;
  }

  if (qrContainer) {
    qrContainer.innerHTML = '';
    screenQrInstance = new QRCode(qrContainer, {
      text: targetUrl,
      width: 280,
      height: 280,
      colorDark: '#140d12',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}

function updateQrTargetUrl(newUrl) {
  const clean = (newUrl || '').trim();
  if (!clean) return;
  localStorage.setItem('blok_qr_custom_url', clean);
  renderQrCode(clean);
  const feedback = document.querySelector('#qrUrlFeedback');
  if (feedback) {
    feedback.textContent = '✓ Saved! QR updated.';
    setTimeout(() => {
      if (feedback) feedback.textContent = '';
    }, 2500);
  }
}

function setQrModal(open, pushHistory = true) {
  const modal = document.querySelector('#qrModal');
  if (!modal) return;
  const wasOpen = !modal.hidden;
  modal.hidden = !open;
  modal.setAttribute('aria-hidden', String(!open));
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    renderQrCode();
    if (!wasOpen && pushHistory) {
      const activeView = document.querySelector('.app-view.is-active')?.dataset.view || 'welcome';
      history.pushState({ view: activeView, modal: 'qr' }, '', '#qr');
    }
  } else if (wasOpen && pushHistory && history.state?.modal === 'qr') {
    window.history.back();
  }
}

function downloadScreenQrPng() {
  const targetUrl = getQrTargetUrl();
  const custom = localStorage.getItem('blok_qr_custom_url');

  // If pointing to official Render production, download pristine 2000x2000px asset
  if (!custom || custom === 'https://blok-prediction.onrender.com') {
    const link = document.createElement('a');
    link.download = 'blok-qr-hires.png';
    link.href = 'qr_code_hires.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Otherwise generate high-res on-the-fly for the custom URL
  const tempBox = document.createElement('div');
  new QRCode(tempBox, {
    text: targetUrl,
    width: 2000,
    height: 2000,
    colorDark: '#140d12',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const canvas = tempBox.querySelector('canvas');
    const img = tempBox.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : '');
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = 'blok-qr-custom.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 120);
}

// QR DOM Event Listeners
const qrToggleBtn = document.querySelector('#qrToggle');
if (qrToggleBtn) qrToggleBtn.addEventListener('click', () => setQrModal(true));

const adminOpenQrBtn = document.querySelector('#adminOpenQrBtn');
if (adminOpenQrBtn) adminOpenQrBtn.addEventListener('click', () => setQrModal(true));

const qrCloseBtn = document.querySelector('#qrCloseBtn');
if (qrCloseBtn) qrCloseBtn.addEventListener('click', () => setQrModal(false));

const qrModalEl = document.querySelector('#qrModal');
if (qrModalEl) {
  qrModalEl.addEventListener('click', (e) => {
    if (e.target === qrModalEl) setQrModal(false);
  });
}

const qrUpdateBtn = document.querySelector('#qrUpdateBtn');
if (qrUpdateBtn) {
  qrUpdateBtn.addEventListener('click', () => {
    const input = document.querySelector('#qrTargetUrl');
    if (input) updateQrTargetUrl(input.value);
  });
}

const qrTargetUrlInput = document.querySelector('#qrTargetUrl');
if (qrTargetUrlInput) {
  qrTargetUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateQrTargetUrl(qrTargetUrlInput.value);
    }
  });
}

const downloadQrBtn = document.querySelector('#downloadQrBtn');
if (downloadQrBtn) downloadQrBtn.addEventListener('click', downloadScreenQrPng);

// ================= GENERAL NAVIGATION & SETUP =================
document.querySelector('#adminToggle').addEventListener('click', async () => {
  isAdmin = await checkAdmin();
  setPanel(true);
  updateAdminUi();
});

// Admin Login Form Submission
const adminLoginForm = document.querySelector('#adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!remoteEnabled) return;
    const email = document.querySelector('#adminEmail').value.trim();
    const password = document.querySelector('#adminPassword').value;
    const submitBtn = adminLoginForm.querySelector('button[type="submit"]');

    adminAuthMessage.textContent = 'Verifying credentials…';
    adminAuthMessage.classList.remove('error');
    setSubmitting(submitBtn, true);

    try {
      const response = await database.auth.signInWithPassword({ email, password });
      if (response.error) {
        adminAuthMessage.textContent = 'Invalid email or password.';
        adminAuthMessage.classList.add('error');
        return;
      }
      isAdmin = await checkAdmin();
      if (!isAdmin) {
        adminAuthMessage.textContent = 'This account does not have organizer permissions.';
        adminAuthMessage.classList.add('error');
        await database.auth.signOut();
        return;
      }
      adminAuthMessage.textContent = '';
      await refresh();
      updateAdminUi();
    } catch (err) {
      console.error(err);
      adminAuthMessage.textContent = 'Connection error. Please try again.';
      adminAuthMessage.classList.add('error');
    } finally {
      setSubmitting(submitBtn, false);
    }
  });
}

document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.viewTarget;
    if ((target === 'pick-woman' || target === 'score-woman' || target === 'pick-man' || target === 'score-man') && (!pendingParticipant || !pendingParticipant.name || !pendingParticipant.phone)) {
      showView('register');
      return;
    }
    showView(target);
  });
});

document.querySelector('#closeAdmin').addEventListener('click', () => setPanel(false));
scrim.addEventListener('click', () => setPanel(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setPanel(false); });

// Admin Sign Out
document.querySelector('#adminLogout').addEventListener('click', async () => {
  if (remoteEnabled) await database.auth.signOut();
  isAdmin = false;
  updateAdminUi();
});

// Supabase Real-time subscriptions
if (remoteEnabled) {
  database.channel('blok-event')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_settings' }, refresh)
    .subscribe();
}

// Initial setup
setupSequentialControls();
refresh();

// Initialize browser history on first load
const hash = window.location.hash.replace('#', '');
if (hash === 'admin') {
  history.replaceState({ view: 'welcome' }, '', '#welcome');
  checkAdmin().then((admin) => {
    isAdmin = admin;
    setPanel(true, true);
    updateAdminUi();
  });
} else if (hash && hash !== 'welcome') {
  const initialView = hash === 'home' ? 'welcome' : hash;
  showView(initialView, false);
  history.replaceState({ view: initialView }, '', '#' + initialView);
} else {
  history.replaceState({ view: 'welcome' }, '', '#welcome');
}

// Mobile Native Edge-Swipe & Popstate Navigation (prevents app from closing on swipe back!)
window.addEventListener('popstate', (event) => {
  // If the QR modal was open and popstate navigated away from modal, close modal!
  const qrModal = document.querySelector('#qrModal');
  if (qrModal && !qrModal.hidden && event.state?.modal !== 'qr') {
    setQrModal(false, false);
    return;
  }
  if (event.state?.modal === 'qr') {
    setQrModal(true, false);
    return;
  }

  // If the admin panel was open and popstate navigated away from admin, close the panel without exiting app!
  if (adminPanel && !adminPanel.hidden && event.state?.panel !== 'admin') {
    setPanel(false, false);
    return;
  }

  // If popstate targets admin panel
  if (event.state?.panel === 'admin') {
    checkAdmin().then((admin) => {
      isAdmin = admin;
      setPanel(true, false);
      updateAdminUi();
    });
    return;
  }

  let targetView = event.state?.view || window.location.hash.replace('#', '') || 'welcome';
  if (targetView === 'home') targetView = 'welcome';
  showView(targetView, false);
});

// Touch Gesture Navigation: Swipe right anywhere to go back
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchStartedInAdmin = false;

document.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  touchStartedInAdmin = Boolean(adminPanel && !adminPanel.hidden && e.target && e.target.closest && e.target.closest('#adminPanel'));
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (e.changedTouches.length !== 1) return;
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  // Horizontal swipe from left to right (diffX > 55px, mostly horizontal, elapsed < 500ms)
  if (diffX > 55 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && elapsed < 500) {
    if (touchStartedInAdmin || (adminPanel && !adminPanel.hidden)) {
      setPanel(false);
      return;
    }

    const activeView = document.querySelector('.app-view.is-active');
    if (!activeView) return;
    const viewName = activeView.dataset.view;
    if (viewName === 'welcome') return;

    const backBtn = activeView.querySelector('.back-button[data-view-target]');
    if (backBtn && backBtn.dataset.viewTarget) {
      showView(backBtn.dataset.viewTarget);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      showView('welcome');
    }
  }
}, { passive: true });
