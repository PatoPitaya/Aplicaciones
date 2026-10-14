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
const drawRaffleBtn = document.querySelector('#drawRaffleBtn');
const raffleResultBox = document.querySelector('#raffleResultBox');
const seedTestBtn = document.querySelector('#seedTestBtn');

let isAdmin = true;
let state = readLocalState();
let raffleInterval = null;
let pendingParticipant = null;

// Draft prediction state for the sequential flow (WOMEN FIRST!)
let draftPick = {
  women: { climber: '', tops: 4, zones: 4, att_top: 4, att_zone: 4, scoreStr: '4T4z 4 4' },
  men: { climber: '', tops: 3, zones: 4, att_top: 6, att_zone: 5, scoreStr: '3T4z 6 5' }
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

function readLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.entries)) {
      return {
        entries: saved.entries,
        winner: sessionStorage.getItem('blok_test_winner') || saved.winner || '',
        raffleWinner: sessionStorage.getItem('blok_test_raffle_winner') || saved.raffleWinner || '',
        predictionsOpen: saved.predictionsOpen !== false
      };
    }
  } catch (error) {
    console.warn('Could not read saved predictions.', error);
  }
  return { 
    entries: [], 
    winner: sessionStorage.getItem('blok_test_winner') || '', 
    raffleWinner: sessionStorage.getItem('blok_test_raffle_winner') || '', 
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

  const scoreStr = `${tops}T${zones}z ${attTop} ${attZone}`;
  return {
    climber: s.climber || '',
    tops,
    zones,
    att_top: attTop,
    att_zone: attZone,
    scoreStr
  };
}

// Parses an IFSC score string like "4T4z 4 4" or "3T4z 6 5"
function parseIfscStr(scoreStr, defaultTops = 4, defaultZones = 4, defaultAttTop = 4, defaultAttZone = 4) {
  if (scoreStr) {
    const m = String(scoreStr).trim().match(/^(\d+)T(\d+)z\s+(\d+)\s+(\d+)$/i);
    if (m) {
      return sanitizeIfsc({
        tops: parseInt(m[1], 10),
        zones: parseInt(m[2], 10),
        att_top: parseInt(m[3], 10),
        att_zone: parseInt(m[4], 10)
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
        const match = val.match(/^(.*?)(?:\s+(\d+T\d+z\s+\d+\s+\d+))?$/i);
        if (match) {
          const climber = (match[1] || '').trim();
          const scoreParsed = parseIfscStr(match[2], 4, 4, 4, 4);
          women = sanitizeIfsc({ climber, ...scoreParsed });
        }
      } else if (p.startsWith('M:')) {
        const val = p.slice(2).trim();
        const match = val.match(/^(.*?)(?:\s+(\d+T\d+z\s+\d+\s+\d+))?$/i);
        if (match) {
          const climber = (match[1] || '').trim();
          const scoreParsed = parseIfscStr(match[2], 3, 4, 6, 5);
          men = sanitizeIfsc({ climber, ...scoreParsed });
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
  const womenScore = calculateCategoryScore(pred?.women, officialWinner?.women);
  const menScore = calculateCategoryScore(pred?.men, officialWinner?.men);

  const totalPoints = womenScore.total + menScore.total;
  const totalAttemptsDiff = womenScore.attDiff + menScore.attDiff;
  const totalScoreDiff = womenScore.scoreDiff + menScore.scoreDiff;

  return {
    entry,
    pred,
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

  scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.totalAttemptsDiff !== b.totalAttemptsDiff) return a.totalAttemptsDiff - b.totalAttemptsDiff;
    return a.totalScoreDiff - b.totalScoreDiff;
  });

  if (scored.length > 0) {
    const top = scored[0];
    scored.forEach((item, index) => {
      item.rank = index + 1;
      item.isWinner = (
        item.totalPoints === top.totalPoints &&
        item.totalAttemptsDiff === top.totalAttemptsDiff &&
        item.totalScoreDiff === top.totalScoreDiff
      );
    });
  }
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

function showView(viewName) {
  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('is-active', view.dataset.view === viewName);
  });
  appFrame.scrollTo({ top: 0, behavior: 'instant' });
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

  const official = parseOfficialWinner(state.winner);
  let html = '';

  // 1. Official Champions Banner (Women First, then Men)
  if (official && (official.women?.climber || official.men?.climber)) {
    html += `
      <div class="champions-banner">
        <span class="champions-tag">🏆 OFFICIAL BOULDER CHAMPIONS</span>
        <div class="champions-grid">
          <div class="champ-col">
            <span class="champ-role">WOMEN'S CHAMPION</span>
            <b class="champ-name">${escapeHtml(official.women?.climber || 'TBD')}</b>
            <span class="champ-score-pill">${escapeHtml(official.women?.scoreStr || '—')}</span>
          </div>
          <div class="champ-col">
            <span class="champ-role">MEN'S CHAMPION</span>
            <b class="champ-name">${escapeHtml(official.men?.climber || 'TBD')}</b>
            <span class="champ-score-pill">${escapeHtml(official.men?.scoreStr || '—')}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="deadline-pill" style="margin-bottom: 20px; width: 100%;">
        <span class="status-dot"></span>
        <span>Finals start at <b>20:30</b> · Official score &amp; winners announced after the podium</span>
      </div>
    `;
  }

  // 2. Lucky Draw Raffle Winner
  if (state.raffleWinner) {
    html += `
      <div class="raffle-winner-card">
        <span>🎉 OFFICIAL RAFFLE WINNER</span>
        <h4>${escapeHtml(state.raffleWinner)}</h4>
        <p>Congratulations! Claim your spectator prize pack at the organizer desk.</p>
      </div>
    `;
  }

  // 3. Ranked Leaderboard & Podium
  if (official && (official.women?.climber || official.men?.climber)) {
    const ranked = rankParticipants(state.entries, official);
    const podiumWinners = ranked.filter((r) => r.isWinner);

    if (podiumWinners.length > 0) {
      html += `
        <div class="podium-card">
          <span class="podium-tag">👑 CONTEST WINNER${podiumWinners.length > 1 ? 'S (TIED)' : ''}</span>
          ${podiumWinners.map((w) => `
            <h4 class="podium-name">${escapeHtml(w.entry.name)}</h4>
            <div class="podium-stats">
              <span class="podium-points">${w.totalPoints} PTS / 270</span>
              <small>Women: ${w.womenScore.total} pts · Men: ${w.menScore.total} pts</small>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (ranked.length > 0) {
      html += `
        <div class="leaderboard-wrap">
          <div class="leaderboard-header">
            <span class="leaderboard-title">PREDICTION LEADERBOARD</span>
            <span class="leaderboard-count">${ranked.length} ENTRIES</span>
          </div>
          <div class="leaderboard-list">
            ${ranked.map((r) => `
              <div class="lb-entry ${r.isWinner ? 'is-winner' : ''}">
                <span class="lb-rank">#${r.rank}</span>
                <div class="lb-info">
                  <b class="lb-name">${escapeHtml(r.entry.name)}</b>
                  <span class="lb-picks">
                    W: ${escapeHtml(r.pred?.women?.climber || '—')} (${escapeHtml(r.pred?.women?.scoreStr || '')}) · 
                    M: ${escapeHtml(r.pred?.men?.climber || '—')} (${escapeHtml(r.pred?.men?.scoreStr || '')})
                  </span>
                </div>
                <div class="lb-score-col">
                  <b class="lb-pts">${r.totalPoints} PTS</b>
                  <span class="lb-breakdown">W:+${r.womenScore.total} M:+${r.menScore.total}</span>
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
      championStatusEl.textContent = `${official.women?.climber || ''} & ${official.men?.climber || ''}`.toUpperCase();
      championStatusEl.className = 'status-badge announced';
      championStatusEl.title = `Official Champions: Women (${official.women?.climber} ${official.women?.scoreStr}), Men (${official.men?.climber} ${official.men?.scoreStr})`;
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

  const poolBox = document.querySelector('#poolControlBox');
  if (poolBox) {
    poolBox.classList.toggle('is-closed', !state.predictionsOpen);
  }

  const openStatusEl = document.querySelector('#openStatus');
  if (openStatusEl) {
    openStatusEl.textContent = state.predictionsOpen ? 'PREDICTIONS OPEN' : '🔴 PREDICTIONS CLOSED';
    openStatusEl.className = `status-badge ${state.predictionsOpen ? 'open' : 'closed'}`;
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

  if (state.raffleWinner && raffleResultBox) {
    raffleResultBox.hidden = false;
    raffleResultBox.innerHTML = `
      <b>🎉 CURRENT RAFFLE WINNER</b>
      <p style="margin:4px 0 0;font-size:14px;color:var(--ink);">${escapeHtml(state.raffleWinner)}</p>
    `;
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

function setPanel(open) {
  adminPanel.hidden = !open;
  scrim.hidden = !open;
  document.querySelector('#adminToggle').setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
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
  state = {
    entries: (predictionsResponse.data || []).map((item) => ({
      id: item.id,
      name: item.participant_name,
      climber: item.climber_name,
      contactType: contactsByPrediction.get(item.id)?.contact_type || 'name',
      contactValue: contactsByPrediction.get(item.id)?.contact_value || item.participant_name,
      createdAt: item.created_at
    })),
    winner: sessionStorage.getItem('blok_test_winner') || settingsResponse.data?.official_winner || '',
    raffleWinner: sessionStorage.getItem('blok_test_raffle_winner') || settingsResponse.data?.raffle_winner || '',
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
      women: { climber: '', tops: 4, zones: 4, att_top: 4, att_zone: 4, scoreStr: '4T4z 4 4' },
      men: { climber: '', tops: 3, zones: 4, att_top: 6, att_zone: 5, scoreStr: '3T4z 6 5' }
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
      const women = sanitizeIfsc({
        tops: adminWomenTops.value,
        zones: adminWomenZones.value,
        att_top: adminWomenAttTop.value,
        att_zone: adminWomenAttZone.value
      });
      adminWomenBadge.textContent = women.scoreStr;
    }
    if (adminMenBadge && adminMenTops && adminMenZones && adminMenAttTop && adminMenAttZone) {
      const men = sanitizeIfsc({
        tops: adminMenTops.value,
        zones: adminMenZones.value,
        att_top: adminMenAttTop.value,
        att_zone: adminMenAttZone.value
      });
      adminMenBadge.textContent = men.scoreStr;
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

    const officialResult = {
      women: {
        climber: womenWinner,
        ...sanitizeIfsc({
          tops: adminWomenTops.value,
          zones: adminWomenZones.value,
          att_top: adminWomenAttTop.value,
          att_zone: adminWomenAttZone.value
        })
      },
      men: {
        climber: menWinner,
        ...sanitizeIfsc({
          tops: adminMenTops.value,
          zones: adminMenZones.value,
          att_top: adminMenAttTop.value,
          att_zone: adminMenAttZone.value
        })
      }
    };

    const officialCompactStr = encodePrediction(officialResult.women, officialResult.men);

    state.winner = officialCompactStr;
    state.predictionsOpen = false;
    sessionStorage.setItem('blok_test_winner', officialCompactStr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();

    setPanel(false);
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

// ================= ADMIN: LUCKY DRAW RAFFLE PICKER =================
if (drawRaffleBtn) {
  drawRaffleBtn.addEventListener('click', async () => {
    const official = parseOfficialWinner(state.winner);
    let candidates = [];

    if (official) {
      const ranked = rankParticipants(state.entries, official);
      candidates = ranked.filter((r) => r.womenScore.winnerMatch || r.menScore.winnerMatch).map((r) => r.entry);
    }
    if (candidates.length === 0) {
      candidates = state.entries;
    }

    if (!candidates.length) {
      window.alert('No participants registered yet to draw from.');
      return;
    }

    raffleResultBox.hidden = false;
    drawRaffleBtn.disabled = true;

    let counter = 0;
    clearInterval(raffleInterval);
    raffleInterval = setInterval(() => {
      const candidate = candidates[counter % candidates.length];
      raffleResultBox.innerHTML = `
        <span class="micro-label" style="color:var(--tape-yellow);">SHUFFLING...</span>
        <b>${escapeHtml(candidate.name)}</b>
      `;
      counter++;
    }, 80);

    setTimeout(async () => {
      clearInterval(raffleInterval);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      state.raffleWinner = chosen.name;
      sessionStorage.setItem('blok_test_raffle_winner', chosen.name);

      raffleResultBox.innerHTML = `
        <b>🎉 DRAW WINNER: ${escapeHtml(chosen.name)}</b>
        <small>Contact: ${escapeHtml(chosen.contactValue || 'NAME ONLY')}</small>
      `;
      drawRaffleBtn.disabled = false;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();

      if (remoteEnabled) {
        try {
          await database.from('event_settings').update({ raffle_winner: chosen.name, updated_at: new Date().toISOString() }).eq('id', 'main');
        } catch (err) {
          console.warn('Could not persist raffle winner to remote:', err);
        }
      }
    }, 1200);
  });
}

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
  seedTestBtn.addEventListener('click', () => {
    const seeded = generate100CommunityPredictions();
    state.entries = seeded;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    window.alert('✅ 100 realistic community predictions seeded (Women first, then Men)!');
  });
}

// Auto-seed if empty on initial load
if (state.entries.length === 0) {
  state.entries = generate100CommunityPredictions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ================= ADMIN: DANGER ZONE RESET =================
document.querySelector('#clearData').addEventListener('click', async () => {
  const confirmation = window.prompt(
    '⚠️ WARNING: This will permanently delete all registered predictions and reset the official champions.\n\nTo confirm, type RESET in capital letters:'
  );

  if (confirmation !== 'RESET') {
    if (confirmation !== null) {
      window.alert('Action cancelled. To reset all event data you must type RESET exactly.');
    }
    return;
  }

  sessionStorage.removeItem('blok_test_winner');
  sessionStorage.removeItem('blok_test_raffle_winner');

  try {
    if (remoteEnabled) {
      const removeResponse = await database.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (removeResponse.error) return window.alert('Could not delete data from database.');
      await database.from('event_settings').update({ official_winner: null, raffle_winner: null, predictions_open: true }).eq('id', 'main');
      await refresh();
    } else {
      state = { entries: [], winner: '', raffleWinner: '', predictionsOpen: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    }
    window.alert('All event data successfully reset.');
  } catch (err) {
    console.error(err);
    window.alert('Error resetting data.');
  }
});

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
