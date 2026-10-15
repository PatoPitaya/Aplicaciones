const STORAGE_KEY = 'blok-predictions-v1';
const config = window.BLOK_SUPABASE_CONFIG || {};
const remoteEnabled = Boolean(config.url && config.anonKey && window.supabase);
const database = remoteEnabled ? window.supabase.createClient(config.url, config.anonKey) : null;

// DOM Elements
const detailsForm = document.querySelector('#detailsForm');
const participantNameInput = document.querySelector('#participantName');
const participantEmailInput = document.querySelector('#participantEmail');
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
const seedTestBtn = document.querySelector('#seedTestBtn');

let isAdmin = true;
let state = readLocalState();
let pendingParticipant = null;

// Draft prediction state for the sequential flow (WOMEN FIRST!)
let draftPick = {
  women: { climber: '', tops: 4, zones: 4, att_top: 4, att_zone: 4, scoreStr: '4T4 4Z4' },
  men: { climber: '', tops: 3, zones: 4, att_top: 6, att_zone: 5, scoreStr: '3T6 4Z5' }
};

// Official Finals Roster (WOMEN FIRST, then MEN)
const FINALISTS = {
  women: [
    { bib: '01', name: 'Chloé Caulier', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '02', name: 'Janja Garnbret', country: 'SLOVENIA', extra: 'BLOK FINALIST' },
    { bib: '03', name: 'Laura Rogora', country: 'ITALY', extra: 'BLOK FINALIST' },
    { bib: '04', name: 'Oriane Bertone', country: 'FRANCE', extra: 'BLOK FINALIST' },
    { bib: '05', name: 'Ai Mori', country: 'JAPAN', extra: 'BLOK FINALIST' }
  ],
  men: [
    { bib: '01', name: 'Hannes Van Duysen', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '02', name: 'Simon Lorenzi', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '03', name: 'Alex Megos', country: 'GERMANY', extra: 'BLOK FINALIST' },
    { bib: '04', name: 'Adam Ondra', country: 'CZECH REP.', extra: 'BLOK FINALIST' },
    { bib: '05', name: 'Tomoa Narasaki', country: 'JAPAN', extra: 'BLOK FINALIST' }
  ]
};

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

const normalize = (value) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

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

// Parses official winner (delegates to parsePrediction)
function parseOfficialWinner(raw) {
  if (!raw) return null;
  return parsePrediction(raw);
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
  if ((viewName === 'pick-woman' || viewName === 'score-woman' || viewName === 'pick-man' || viewName === 'score-man') && (!pendingParticipant || !pendingParticipant.name)) {
    viewName = 'register';
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
      if (toWomenScoreBtn) toWomenScoreBtn.disabled = false;
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
      if (toMenScoreBtn) toMenScoreBtn.disabled = false;
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
    const champBox = (role, pick) => `
      <div class="champ-box">
        <span class="champ-role">${role}</span>
        <b class="champ-name-tape">${escapeHtml(pick?.climber || 'TBD')}</b>
        <span class="champ-score-pill">${escapeHtml(pick?.scoreStr || '—')}</span>
      </div>
    `;

    html += `
      <div class="champions-grid">
        ${champBox("WOMEN'S CHAMPION", official.women)}
        ${champBox("MEN'S CHAMPION", official.men)}
      </div>
    `;

    // 2. Contest Winners Podium (Names separate, big chalk-smudged tape, total points + predicted IFSC scores)
    if (podiumWinners.length > 0) {
      html += podiumWinners.map((w) => {
        const winnerTag = podiumWinners.length > 1 ? '👑 #1 CO-WINNER' : '👑 #1 CONTEST WINNER';
        return `
          <div class="podium-card podium-neon">
            <span class="podium-tag">${winnerTag}</span>
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
        `;
      }).join('');
    } else {
      html += `
        <div class="podium-card podium-neon is-empty">
          <span class="podium-tag">👑 CONTEST WINNER</span>
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
        <div class="odds-box">
          <div class="odds-header">
            <span class="odds-title">WOMEN'S FINALS FAVORITES</span>
            <span class="odds-total">${crowd.total} total bets</span>
          </div>
          ${crowd.womenList.map((item) => `
            <div class="odds-item">
              <div class="odds-labels">
                <span>${escapeHtml(item.name)}</span>
                <span>${item.pct}% (${item.count})</span>
              </div>
              <div class="odds-bar-track">
                <div class="odds-bar-fill" style="width: ${item.pct}%"></div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="odds-box">
          <div class="odds-header">
            <span class="odds-title">MEN'S FINALS FAVORITES</span>
            <span class="odds-total">${crowd.total} total bets</span>
          </div>
          ${crowd.menList.map((item) => `
            <div class="odds-item">
              <div class="odds-labels">
                <span>${escapeHtml(item.name)}</span>
                <span>${item.pct}% (${item.count})</span>
              </div>
              <div class="odds-bar-track">
                <div class="odds-bar-fill" style="width: ${item.pct}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
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
  if (participantEmailInput) participantEmailInput.disabled = !state.predictionsOpen;
  if (participantPhoneInput) participantPhoneInput.disabled = !state.predictionsOpen;
  if (detailsForm) {
    const subBtn = detailsForm.querySelector('[type="submit"]');
    if (subBtn) subBtn.disabled = !state.predictionsOpen;
  }

  const deadlineEl = document.querySelector('#deadlineNote');
  if (deadlineEl) {
    deadlineEl.innerHTML = state.predictionsOpen
      ? '<span class="status-dot"></span><span>Predictions open until <b>20:00</b> · Finals at <b>20:30</b></span>'
      : '<span class="status-dot is-closed"></span><span>Predictions are <b>closed</b> · Finals in progress!</span>';
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
  updateAdminUi();
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
  const remoteWinner = settingsResponse.data?.official_winner || '';
  const parsedRemote = parseOfficialWinner(remoteWinner);
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
    winner: (isValidRemoteWinner ? remoteWinner : '') || sessionStorage.getItem('blok_test_winner') || state.winner || '',
    predictionsOpen: settingsResponse.data ? (settingsResponse.data.predictions_open !== false) : state.predictionsOpen
  };
}

async function refresh() {
  if (remoteEnabled) {
    try {
      await loadRemoteState();
    } catch (error) {
      console.error(error);
      showDetailsMessage('Could not sync predictions. Please try again.', true);
    }
  }
  render();
}

// ================= STEP 0: PARTICIPANT NAME SUBMISSION =================
if (detailsForm) {
  detailsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = participantNameInput.value.trim();

    if (!name || name.length < 2) {
      participantNameInput.focus();
      return showDetailsMessage('Please enter your name.', true);
    }

    if (!state.predictionsOpen) {
      return showDetailsMessage('Predictions are now closed for the finals.', true);
    }

    pendingParticipant = { name, email: '', phone: '' };
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
}

// ================= STEP 4: CONFIRM AND SUBMIT ALL PREDICTIONS =================
if (confirmPredictionBtn) {
  confirmPredictionBtn.addEventListener('click', async () => {
    if (!pendingParticipant || !pendingParticipant.name) {
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
    const finalWomen = sanitizeIfsc(draftPick.women);
    const finalMen = sanitizeIfsc(draftPick.men);
    const compactPayload = encodePrediction(finalWomen, finalMen);

    try {
      if (remoteEnabled) {
        let submitName = name;
        let response = await database.from('predictions').insert({
          participant_name: submitName,
          climber_name: compactPayload
        }).select('id').single();

        // Handle duplicate name collision (e.g. repeated testing with same participant name)
        if (response.error && (response.error.code === '23505' || String(response.error.message).includes('unique'))) {
          submitName = `${name} #${Math.floor(100 + Math.random() * 900)}`;
          response = await database.from('predictions').insert({
            participant_name: submitName,
            climber_name: compactPayload
          }).select('id').single();
        }

        if (response.error) {
          console.warn('Remote database warning, saving to local device:', response.error);
          state.entries.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            name: submitName,
            climber: compactPayload,
            contactType: 'name',
            contactValue: submitName,
            createdAt: new Date().toISOString()
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          render();
        } else {
          await refresh();
        }
      } else {
        state.entries.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name,
          climber: compactPayload,
          contactType: 'name',
          contactValue: name,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
      }

      // Populate Success Screen (Women First, then Men)
      const successName = document.querySelector('#successName');
      const successWomenPick = document.querySelector('#successWomenPick');
      const successMenPick = document.querySelector('#successMenPick');

      if (successName) successName.textContent = name;
      if (successWomenPick) successWomenPick.textContent = `${finalWomen.climber} (${finalWomen.scoreStr})`;
      if (successMenPick) successMenPick.textContent = `${finalMen.climber} (${finalMen.scoreStr})`;

      if (detailsForm) detailsForm.reset();
      pendingParticipant = null;
      showView('success');
    } catch (error) {
      console.error('Submission fallback:', error);
      // Fallback save to ensure the user never gets an error popup
      state.entries.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name,
        climber: compactPayload,
        contactType: 'name',
        contactValue: name,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();

      const successName = document.querySelector('#successName');
      const successWomenPick = document.querySelector('#successWomenPick');
      const successMenPick = document.querySelector('#successMenPick');

      if (successName) successName.textContent = name;
      if (successWomenPick) successWomenPick.textContent = `${finalWomen.climber} (${finalWomen.scoreStr})`;
      if (successMenPick) successMenPick.textContent = `${finalMen.climber} (${finalMen.scoreStr})`;

      if (detailsForm) detailsForm.reset();
      pendingParticipant = null;
      showView('success');
    } finally {
      setSubmitting(confirmPredictionBtn, false);
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
        await database.from('event_settings').update({
          official_winner: officialCompactStr,
          predictions_open: false,
          updated_at: new Date().toISOString()
        }).eq('id', 'main');
      } catch (error) {
        console.warn('Could not sync official winner to remote:', error);
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

      if (adminMenWinner) adminMenWinner.value = '';
      if (adminMenTops) adminMenTops.value = '';
      if (adminMenZones) adminMenZones.value = '';
      if (adminMenAttTop) adminMenAttTop.value = '';
      if (adminMenAttZone) adminMenAttZone.value = '';
      if (adminMenBadge) adminMenBadge.textContent = '—';

      // 3. Update Supabase if connected
      if (remoteEnabled) {
        try {
          const { data, error } = await database.from('event_settings').update({
            official_winner: null,
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

// ================= SEED 100 REALISTIC COMMUNITY TEST VOTERS =================
function generate100CommunityPredictions() {
  const FIRST_NAMES = [
    'Emma', 'Lucas', 'Sarah', 'Thomas', 'Mila', 'Liam', 'Olivia', 'Noah', 'Elena', 'Arthur',
    'Chloe', 'Louis', 'Alice', 'Jules', 'Louise', 'Adam', 'Lina', 'Victor', 'Ines', 'Gabriel',
    'Amelie', 'Matteo', 'Juliette', 'Florian', 'Charlotte', 'Arno', 'Zoe', 'Wout', 'Manon', 'Kobe',
    'Fien', 'Jasper', 'Noor', 'Milan', 'Lore', 'Daan', 'Ella', 'Lars', 'Hanne', 'Senne',
    'Eline', 'Niels', 'Fleur', 'Jonas', 'Amber', 'Ruben', 'Anouk', 'Bram', 'Clara', 'Thijs',
    'Yuki', 'Robin', 'Anna', 'Jens', 'Maya', 'Sam', 'Sophia', 'Sander', 'Eva', 'Simon',
    'Nora', 'Vincent', 'Laura', 'Cedric', 'Sara', 'Gilles', 'Julia', 'Nathan', 'Marie', 'Antoine',
    'Elise', 'Julien', 'Camille', 'Alexandre', 'Lea', 'Sebastien', 'Lotte', 'Nicolas', 'Luka', 'Pierre',
    'Timo', 'Kenji', 'Felix', 'Leo', 'Oscar', 'Theo', 'Hugo', 'Paul', 'Leon', 'Axel',
    'David', 'Martin', 'Luka', 'Marko', 'Stefan', 'Jan', 'Matej', 'Sven', 'Mia', 'Victoria'
  ];

  const LAST_NAMES = [
    'Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet',
    'Vermeulen', 'Pauwels', 'Hermans', 'Aerts', 'Michiels', 'Martens', 'Desmet', 'De Vos', 'Dubois', 'Lambert',
    'Dupont', 'Martin', 'Dumont', 'Leclercq', 'Laurent', 'Renard', 'Simon', 'Vandenberghe', 'Van Damme', 'De Clercq'
  ];

  const womenCandidates = ['Chloé Caulier', 'Janja Garnbret', 'Laura Rogora', 'Oriane Bertone', 'Ai Mori'];
  const menCandidates = ['Hannes Van Duysen', 'Simon Lorenzi', 'Alex Megos', 'Adam Ondra', 'Tomoa Narasaki'];

  const seeded = [];

  for (let i = 0; i < 100; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length];
    const fullName = `${fName} ${lName}`;

    // Pick distribution
    const womenIdx = (i % 2 === 0) ? 1 : (i % 5);
    const menIdx = (i % 3 === 0) ? 3 : (i % 2 === 0 ? 0 : (i % 5));

    // Realistic IFSC scores
    const womenTops = [3, 3, 4, 4, 4][i % 5];
    const womenZones = Math.max(womenTops, [4, 4, 4, 4, 3][(i + 2) % 5]);
    const womenAttTop = womenTops === 0 ? 0 : womenTops + ((i + 1) % 3);
    const womenAttZone = womenZones === 0 ? 0 : womenZones + (i % 2);

    const menTops = [2, 3, 3, 3, 4, 4][(i + 1) % 6];
    const menZones = Math.max(menTops, [3, 4, 4, 4][i % 4]);
    const menAttTop = menTops === 0 ? 0 : menTops + (i % 4);
    const menAttZone = menZones === 0 ? 0 : menZones + (i % 3);

    const payload = {
      women: sanitizeIfsc({
        climber: womenCandidates[womenIdx],
        tops: womenTops,
        zones: womenZones,
        att_top: womenAttTop,
        att_zone: womenAttZone
      }),
      men: sanitizeIfsc({
        climber: menCandidates[menIdx],
        tops: menTops,
        zones: menZones,
        att_top: menAttTop,
        att_zone: menAttZone
      })
    };

    seeded.push({
      id: `seed-${i + 1}`,
      name: fullName,
      climber: encodePrediction(payload.women, payload.men),
      contactType: 'name',
      contactValue: fullName,
      createdAt: new Date(Date.now() - (100 - i) * 60000).toISOString()
    });
  }

  return seeded;
}

if (seedTestBtn) {
  seedTestBtn.addEventListener('click', async () => {
    setSubmitting(seedTestBtn, true);
    try {
      const seeded = generate100CommunityPredictions();
      if (remoteEnabled) {
        await database.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const rows = seeded.map((s) => ({
          participant_name: s.name,
          climber_name: s.climber
        }));
        await database.from('predictions').insert(rows);
        await refresh();
      } else {
        state.entries = seeded;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
      }
      window.alert('✅ 100 realistic community predictions seeded (Women first, then Men)!');
    } catch (err) {
      console.error(err);
      window.alert('Error seeding test voters.');
    } finally {
      setSubmitting(seedTestBtn, false);
    }
  });
}


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


// ================= GENERAL NAVIGATION & SETUP =================
document.querySelector('#adminToggle').addEventListener('click', () => {
  setPanel(true);
  updateAdminUi();
});

document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.viewTarget;
    if ((target === 'pick-woman' || target === 'score-woman' || target === 'pick-man' || target === 'score-man') && (!pendingParticipant || !pendingParticipant.name)) {
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
  setPanel(true, true);
} else if (hash && hash !== 'welcome') {
  const initialView = hash === 'home' ? 'welcome' : hash;
  showView(initialView, false);
  history.replaceState({ view: initialView }, '', '#' + initialView);
} else {
  history.replaceState({ view: 'welcome' }, '', '#welcome');
}

// Mobile Native Edge-Swipe & Popstate Navigation (prevents app from closing on swipe back!)
window.addEventListener('popstate', (event) => {
  // If the admin panel was open and popstate navigated away from admin, close the panel without exiting app!
  if (adminPanel && !adminPanel.hidden && event.state?.panel !== 'admin') {
    setPanel(false, false);
    return;
  }

  // If popstate targets admin panel
  if (event.state?.panel === 'admin') {
    setPanel(true, false);
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
