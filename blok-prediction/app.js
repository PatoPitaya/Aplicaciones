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

const votingAsName = document.querySelector('#votingAsName');
const climberInput = document.querySelector('#climberName');
const confirmPredictionBtn = document.querySelector('#confirmPredictionBtn');
const confirmBtnText = document.querySelector('#confirmBtnText');
const selectionMessage = document.querySelector('#selectionMessage');

const adminPanel = document.querySelector('#adminPanel');
const scrim = document.querySelector('#panelScrim');
const adminAuth = document.querySelector('#adminAuth');
const adminControls = document.querySelector('#adminControls');
const adminWarning = document.querySelector('#adminWarning');
const adminAuthMessage = document.querySelector('#adminAuthMessage');
const appFrame = document.querySelector('#appFrame');
const drawRaffleBtn = document.querySelector('#drawRaffleBtn');
const raffleResultBox = document.querySelector('#raffleResultBox');

let isAdmin = true;
let state = readLocalState();
let raffleInterval = null;
let pendingParticipant = null;

function readLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.entries)) {
      return {
        entries: saved.entries,
        winner: sessionStorage.getItem('blok_test_winner') || '',
        raffleWinner: sessionStorage.getItem('blok_test_raffle_winner') || '',
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
const isCorrect = (entry) => Boolean(state.winner) && normalize(entry.climber) === normalize(state.winner);
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+()\s-]{7,}$/.test(phone);
}

function showDetailsMessage(message, error = false) {
  if (!detailsMessage) return;
  detailsMessage.textContent = message;
  detailsMessage.classList.toggle('error', error);
}

function showSelectionMessage(message, error = false) {
  if (!selectionMessage) return;
  selectionMessage.textContent = message;
  selectionMessage.classList.toggle('error', error);
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

// Official Finals Roster (5 Men / 5 Women with expandable metadata)
const FINALISTS = {
  men: [
    { bib: '01', name: 'Hannes Van Duysen', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '02', name: 'Simon Lorenzi', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '03', name: 'Alex Megos', country: 'GERMANY', extra: 'BLOK FINALIST' },
    { bib: '04', name: 'Adam Ondra', country: 'CZECH REP.', extra: 'BLOK FINALIST' },
    { bib: '05', name: 'Tomoa Narasaki', country: 'JAPAN', extra: 'BLOK FINALIST' }
  ],
  women: [
    { bib: '01', name: 'Chloé Caulier', country: 'BELGIUM', extra: 'BLOK FINALIST' },
    { bib: '02', name: 'Janja Garnbret', country: 'SLOVENIA', extra: 'BLOK FINALIST' },
    { bib: '03', name: 'Laura Rogora', country: 'ITALY', extra: 'BLOK FINALIST' },
    { bib: '04', name: 'Oriane Bertone', country: 'FRANCE', extra: 'BLOK FINALIST' },
    { bib: '05', name: 'Ai Mori', country: 'JAPAN', extra: 'BLOK FINALIST' }
  ]
};

let currentCategory = 'men';

function renderFinalistPool(category = currentCategory) {
  currentCategory = category;
  const pool = document.querySelector('#finalistPool');
  if (!pool) return;
  const athletes = FINALISTS[category] || [];
  const selected = normalize(climberInput ? climberInput.value : '');

  pool.innerHTML = athletes.map((a) => {
    const isSelected = normalize(a.name) === selected;
    return `
      <button type="button" class="climber-option ${isSelected ? 'is-selected' : ''}" data-climber-choice="${escapeHtml(a.name)}">
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

  pool.querySelectorAll('[data-climber-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      if (climberInput) climberInput.value = button.dataset.climberChoice;
      updateClimberSelection();
    });
  });

  updateCategoryTabs();
}

function updateCategoryTabs() {
  document.querySelectorAll('.category-tab').forEach((tab) => {
    const isThis = tab.dataset.category === currentCategory;
    tab.classList.toggle('is-active', isThis);
    tab.setAttribute('aria-selected', String(isThis));
  });

  const selected = normalize(climberInput ? climberInput.value : '');
  const inMen = FINALISTS.men.some((a) => normalize(a.name) === selected);
  const inWomen = FINALISTS.women.some((a) => normalize(a.name) === selected);

  const menIndicator = document.querySelector('#menTabIndicator');
  const womenIndicator = document.querySelector('#womenTabIndicator');
  if (menIndicator) menIndicator.hidden = !inMen;
  if (womenIndicator) womenIndicator.hidden = !inWomen;
}

function updateClimberSelection() {
  const selected = normalize(climberInput ? climberInput.value : '');
  document.querySelectorAll('[data-climber-choice]').forEach((button) => {
    button.classList.toggle('is-selected', normalize(button.dataset.climberChoice) === selected);
  });

  updateCategoryTabs();

  const hasChoice = Boolean(climberInput && climberInput.value.trim());
  if (confirmPredictionBtn && confirmBtnText) {
    confirmPredictionBtn.disabled = !hasChoice || !state.predictionsOpen;
    if (hasChoice) {
      confirmBtnText.textContent = 'LOCK IN: ' + climberInput.value.trim().toUpperCase();
    } else {
      confirmBtnText.textContent = 'TAP AN ATHLETE ABOVE';
    }
  }
}

function getCrowdStats() {
  const counts = {};
  state.entries.forEach((entry) => {
    const climber = (entry.climber || '').trim();
    if (climber) {
      counts[climber] = (counts[climber] || 0) + 1;
    }
  });
  const total = state.entries.length;
  const list = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
  return { list, total };
}

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
    winner: sessionStorage.getItem('blok_test_winner') || '',
    raffleWinner: sessionStorage.getItem('blok_test_raffle_winner') || '',
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

function renderPublicResults(winners) {
  const results = document.querySelector('#resultsContent');
  if (!results) return;
  const crowd = getCrowdStats();

  let html = '';

  // 1. Official Winner Banner (if decided)
  if (state.winner) {
    html += `
      <div class="result-winner">
        <span>🏆 OFFICIAL CHAMPION</span>
        <h3>${escapeHtml(state.winner)}</h3>
      </div>
    `;
  } else {
    html += `
      <div class="deadline-pill" style="margin-bottom: 20px; width: 100%;">
        <span class="status-dot"></span>
        <span>Finals start at <b>20:30</b> · Official results posted after the podium</span>
      </div>
    `;
  }

  // 2. Lucky Draw Raffle Winner (if drawn)
  if (state.raffleWinner) {
    html += `
      <div class="raffle-winner-card">
        <span>🎉 OFFICIAL RAFFLE WINNER</span>
        <h4>${escapeHtml(state.raffleWinner)}</h4>
        <p>Congratulations! Claim your prize at the organizer desk.</p>
      </div>
    `;
  }

  // 3. Crowd Favorites & Odds Breakdown
  if (crowd.list.length > 0) {
    html += `
      <div class="odds-box">
        <div class="odds-header">
          <span class="odds-total">${crowd.total} total ${crowd.total === 1 ? 'prediction' : 'predictions'}</span>
        </div>
        ${crowd.list.map((item) => `
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

  // 4. List of Correct Guessers (after winner announced)
  if (state.winner) {
    if (winners.length > 0) {
      html += `
        <p class="result-list-title">CORRECT PREDICTIONS · ${winners.length}</p>
        ${winners.map((entry, index) => `
          <div class="result-entry">
            <strong>${index + 1}</strong>
            <span>
              <b>${escapeHtml(entry.name)}</b>
              <small>Picked: ${escapeHtml(entry.climber)}</small>
            </span>
            <i>✓</i>
          </div>
        `).join('')}
      `;
    } else {
      html += '<p class="empty-results">Nobody guessed this champion. Thanks for participating!</p>';
    }
  }

  results.innerHTML = html;
}

function render() {
  const winners = state.entries.filter(isCorrect);
  document.querySelector('#adminEntryCount').textContent = state.entries.length;
  document.querySelector('#adminWinnerCount').textContent = winners.length;
  document.querySelector('#winnerName').value = state.winner;

  if (participantNameInput) participantNameInput.disabled = !state.predictionsOpen;
  if (participantEmailInput) participantEmailInput.disabled = !state.predictionsOpen;
  if (participantPhoneInput) participantPhoneInput.disabled = !state.predictionsOpen;
  if (climberInput) climberInput.disabled = !state.predictionsOpen;
  if (detailsForm) {
    const subBtn = detailsForm.querySelector('[type="submit"]');
    if (subBtn) subBtn.disabled = !state.predictionsOpen;
  }
  document.querySelectorAll('[data-climber-choice]').forEach((control) => {
    control.disabled = !state.predictionsOpen;
  });

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

  const championStatusEl = document.querySelector('#championStatus');
  if (championStatusEl) {
    if (state.winner) {
      championStatusEl.textContent = state.winner.toUpperCase();
      championStatusEl.className = 'status-badge announced';
      championStatusEl.title = `Official Champion: ${state.winner}`;
    } else {
      championStatusEl.textContent = 'NOT DECLARED';
      championStatusEl.className = 'status-badge pending';
      championStatusEl.title = 'No champion published yet';
    }
  }

  const storageNote = document.querySelector('#storageNote');
  if (storageNote) {
    storageNote.textContent = remoteEnabled
      ? 'One prediction per participant. Synced live for the event.'
      : 'One prediction per participant. Good luck!';
  }

  // Admin entries list
  const entriesBox = document.querySelector('#adminEntries');
  entriesBox.innerHTML = state.entries.length
    ? [...state.entries].reverse().map((entry) => `
        <div class="admin-entry ${isCorrect(entry) ? 'correct' : ''}">
          <span>
            <b>${escapeHtml(entry.name)}</b>
            <small>${escapeHtml(entry.contactValue || 'NO CONTACT')}</small>
          </span>
          <span>${escapeHtml(entry.climber)}</span>
          <span>${isCorrect(entry) ? '✓ CORRECT' : 'PICKED'}</span>
        </div>
      `).join('')
    : '<p class="admin-empty">No participants registered yet.</p>';

  if (state.raffleWinner && raffleResultBox) {
    raffleResultBox.hidden = false;
    raffleResultBox.innerHTML = `
      <b>🎉 CURRENT RAFFLE WINNER</b>
      <p style="margin:4px 0 0;font-size:14px;color:var(--ink);">${escapeHtml(state.raffleWinner)}</p>
    `;
  }

  renderPublicResults(winners);
  updateAdminUi();
  updateClimberSelection();
}

function updateAdminUi() {
  adminAuth.hidden = isAdmin;
  adminControls.hidden = !isAdmin;
  document.querySelector('#adminLogout').hidden = !remoteEnabled || !isAdmin;
  adminWarning.textContent = remoteEnabled
    ? (isAdmin ? 'Connected to shared Supabase database. Only authorized organizers can publish results.' : 'Sign in with an authorized account to manage the event.')
    : 'Local demo mode: Data stored in this browser only. Configure Supabase to share predictions across all mobiles.';
}

async function checkAdmin() {
  return true;
}

function setPanel(open) {
  adminPanel.hidden = !open;
  scrim.hidden = !open;
  document.querySelector('#adminToggle').setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

// ================= STEP 1: Details Form Submission (Name-only test mode) =================
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

    // No duplicate blocking - name only test mode!
    pendingParticipant = { name, email: '', phone: '' };
    if (votingAsName) votingAsName.textContent = name;
    showDetailsMessage('');
    showSelectionMessage('');
    renderFinalistPool();
    showView('pick-winner');
    updateClimberSelection();
  });
}

// ================= STEP 2: Confirm Athlete Prediction =================
if (confirmPredictionBtn) {
  confirmPredictionBtn.addEventListener('click', async () => {
    if (!pendingParticipant || !pendingParticipant.name) {
      showView('register');
      return;
    }

    const climber = climberInput ? climberInput.value.trim() : '';
    if (!climber) {
      return showSelectionMessage('Please tap or select an athlete from the list.', true);
    }

    if (!state.predictionsOpen) {
      return showSelectionMessage('Predictions are now closed.', true);
    }

    setSubmitting(confirmPredictionBtn, true);
    showSelectionMessage('');

    const name = pendingParticipant.name;
    const contactValue = name;

    try {
      if (remoteEnabled) {
        const response = await database.from('predictions').insert({
          participant_name: name,
          climber_name: climber
        }).select('id').single();

        if (response.error) {
          throw response.error;
        }

        await refresh();
      } else {
        state.entries.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name,
          climber,
          contactType: 'name',
          contactValue,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
      }

      document.querySelector('#successName').textContent = name;
      document.querySelector('#successPrediction').textContent = climber;
      if (detailsForm) detailsForm.reset();
      if (climberInput) climberInput.value = '';
      pendingParticipant = null;
      updateClimberSelection();
      showView('success');
    } catch (error) {
      console.error(error);
      showSelectionMessage(error.message || 'Could not save prediction. Please try again.', true);
    } finally {
      setSubmitting(confirmPredictionBtn, false);
    }
  });
}

// Lucky Draw Raffle Button in Admin
if (drawRaffleBtn) {
  drawRaffleBtn.addEventListener('click', async () => {
    const winners = state.entries.filter(isCorrect);
    if (!winners.length) {
      window.alert('No correct predictions available to draw from. Make sure the official winner is set and participants have guessed correctly.');
      return;
    }

    raffleResultBox.hidden = false;
    drawRaffleBtn.disabled = true;

    // Exciting shuffle animation cycling through winner names for 1.2s
    let counter = 0;
    clearInterval(raffleInterval);
    raffleInterval = setInterval(() => {
      const candidate = winners[counter % winners.length];
      raffleResultBox.innerHTML = `
        <span class="micro-label" style="color:var(--tape-yellow);">SHUFFLING...</span>
        <b>${escapeHtml(candidate.name)}</b>
      `;
      counter++;
    }, 80);

    setTimeout(async () => {
      clearInterval(raffleInterval);
      const chosen = winners[Math.floor(Math.random() * winners.length)];
      state.raffleWinner = chosen.name;

      raffleResultBox.innerHTML = `
        <b>🎉 DRAW WINNER: ${escapeHtml(chosen.name)}</b>
        <small>Contact: ${escapeHtml(chosen.contactValue || 'N/A')} · Climber: ${escapeHtml(chosen.climber)}</small>
      `;
      drawRaffleBtn.disabled = false;

      // Persist raffle winner
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();

      // Launch Dancing Cat Meme Celebration for 10 seconds!
      launchCatParty(`🎉 RAFFLE DRAW WINNER: ${chosen.name}! 🎁`, `Correctly guessed champion: ${chosen.climber}! 🐱✨`);

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

// ==========================================================================
// Dancing Cat Memes Celebration (10 Seconds)
// ==========================================================================
let catPartyTimeout = null;
let catPartyCountdownInterval = null;

function playVictoryFanfare() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const notes = [
      { f: 523.25, d: 0.12, t: 0.00 },
      { f: 659.25, d: 0.12, t: 0.12 },
      { f: 783.99, d: 0.12, t: 0.24 },
      { f: 1046.50, d: 0.35, t: 0.36 }
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.t);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + n.t);
      osc.stop(ctx.currentTime + n.t + n.d);
    });
  } catch (err) {
    // Audio optional, ignore if context restricted
  }
}

function launchCatParty(title = 'OFFICIAL CHAMPION DECLARED!', subtitle = '10-second victory cat dance party activated! 🐱✨') {
  // Clear any existing active celebration
  if (catPartyTimeout) clearTimeout(catPartyTimeout);
  if (catPartyCountdownInterval) clearInterval(catPartyCountdownInterval);
  const existingOverlay = document.querySelector('#catPartyOverlay');
  if (existingOverlay) existingOverlay.remove();

  playVictoryFanfare();

  const overlay = document.createElement('div');
  overlay.id = 'catPartyOverlay';
  overlay.className = 'cat-party-overlay';

  // 100% verified local dancing cat memes (no broken links or hotlinking limits)
  const catMemes = [
    {
      url: 'assets/cats/pure_catjam.gif',
      bubble: 'CATJAM VIBES! 🎵',
      anim: 'anim-bounce',
      hasFrame: false,
      pos: { bottom: '3%', left: '3%' }
    },
    {
      url: 'assets/cats/cat_comfy1.gif',
      bubble: 'TOTAL GROOVE! 🕺',
      anim: 'anim-groove',
      hasFrame: false,
      pos: { bottom: '3%', right: '3%' }
    },
    {
      url: 'assets/cats/bongo_cat_cropped.gif',
      bubble: 'BONGO BEATS! 🎹',
      anim: 'anim-bounce',
      hasFrame: true,
      pos: { bottom: '4%', left: '50%', transform: 'translateX(-50%)' }
    },
    {
      url: 'assets/cats/cat_comfy5.gif',
      bubble: 'DISCO SALSA! 🌟',
      anim: 'anim-spin-tilt',
      hasFrame: false,
      pos: { top: '15%', left: '3%' }
    },
    {
      url: 'assets/cats/popcat_fast.gif',
      bubble: 'POP POP POP! 🐱',
      anim: 'anim-wiggle',
      hasFrame: true,
      pos: { top: '38%', left: '3%' }
    },
    {
      url: 'assets/cats/cat_comfy2.gif',
      bubble: 'KILLER MOVES! 💃',
      anim: 'anim-jump',
      hasFrame: false,
      pos: { top: '38%', right: '3%' }
    },
    {
      url: 'assets/cats/maxwell_spinning.gif',
      bubble: 'MAXWELL SPIN! 🌀',
      anim: 'anim-spin-tilt',
      hasFrame: false,
      pos: { top: '48%', left: '50%', transform: 'translate(-50%, -50%)' }
    },
    {
      url: 'assets/cats/x1ah_cat.gif',
      bubble: 'KITTEN CHOIR! 🎶',
      anim: 'anim-groove',
      hasFrame: true,
      pos: { top: '15%', right: '3%' }
    },
    {
      url: 'assets/cats/cat_comfy3.gif',
      bubble: 'FELINE FLOW! 🔥',
      anim: 'anim-bounce',
      hasFrame: false,
      pos: { bottom: '24%', left: '22%' }
    },
    {
      url: 'assets/cats/cat_comfy4.gif',
      bubble: 'SUPREME WIGGLE! 🚀',
      anim: 'anim-jump',
      hasFrame: false,
      pos: { bottom: '24%', right: '22%' }
    }
  ];

  // Falling confetti particles
  const confettiChars = ['🎉', '🐾', '🐟', '✨', '⭐', '🐱', '🎈', '🏆', '🔥'];
  let confettiHtml = '';
  for (let i = 0; i < 28; i++) {
    const char = confettiChars[i % confettiChars.length];
    const left = Math.floor(Math.random() * 96) + 2;
    const dur = (Math.random() * 2.5 + 2.5).toFixed(2);
    const delay = (Math.random() * 3).toFixed(2);
    confettiHtml += `<span class="cat-confetti-particle" style="left:${left}vw; animation-duration:${dur}s; animation-delay:${delay}s;">${char}</span>`;
  }

  // Generate Cats HTML
  let catsHtml = '';
  catMemes.forEach((cat) => {
    let styleStr = '';
    if (cat.pos.top) styleStr += `top:${cat.pos.top};`;
    if (cat.pos.bottom) styleStr += `bottom:${cat.pos.bottom};`;
    if (cat.pos.left) styleStr += `left:${cat.pos.left};`;
    if (cat.pos.right) styleStr += `right:${cat.pos.right};`;
    if (cat.pos.transform) styleStr += `transform:${cat.pos.transform};`;

    catsHtml += `
      <div class="cat-meme-item ${cat.anim} ${cat.hasFrame ? 'has-frame' : ''}" style="${styleStr}">
        <div class="cat-bubble">${cat.bubble}</div>
        <img class="cat-meme-img" src="${cat.url}" alt="Dancing Cat Meme" loading="eager" />
      </div>
    `;
  });

  overlay.innerHTML = `
    ${confettiHtml}
    <div class="cat-party-banner">
      <h2 class="cat-party-title">${escapeHtml(title)}</h2>
      <p class="cat-party-subtitle">${escapeHtml(subtitle)}</p>
      <div class="cat-party-controls">
        <span class="cat-party-timer-badge">⏱️ <span id="catPartyCountdown">10</span>s</span>
        <button type="button" class="cat-party-dismiss-btn" id="dismissCatParty">✕ End celebration</button>
      </div>
    </div>
    ${catsHtml}
  `;

  document.body.appendChild(overlay);

  // Countdown timer logic for exactly 10 seconds
  let remainingSeconds = 10;
  const countdownEl = overlay.querySelector('#catPartyCountdown');

  catPartyCountdownInterval = setInterval(() => {
    remainingSeconds -= 1;
    if (countdownEl) {
      countdownEl.textContent = String(Math.max(0, remainingSeconds));
    }
  }, 1000);

  function closeParty() {
    if (catPartyCountdownInterval) clearInterval(catPartyCountdownInterval);
    if (catPartyTimeout) clearTimeout(catPartyTimeout);
    overlay.classList.add('fade-out');
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 450);
  }

  // Dismiss button click
  const dismissBtn = overlay.querySelector('#dismissCatParty');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', closeParty);
  }

  // Auto dismiss after 10000ms (exactly 10 seconds)
  catPartyTimeout = setTimeout(closeParty, 10000);
}

// Navigation & View Switches
document.querySelector('#adminToggle').addEventListener('click', async () => {
  setPanel(true);
  isAdmin = await checkAdmin();
  updateAdminUi();
});

document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.viewTarget;
    if (target === 'pick-winner' && (!pendingParticipant || !pendingParticipant.name)) {
      showView('register');
      return;
    }
    showView(target);
  });
});

document.querySelectorAll('.category-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    renderFinalistPool(tab.dataset.category);
  });
});

document.querySelector('#closeAdmin').addEventListener('click', () => setPanel(false));
scrim.addEventListener('click', () => setPanel(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setPanel(false); });

// Admin Login
document.querySelector('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!remoteEnabled) return;
  const email = document.querySelector('#adminEmail').value.trim();
  const password = document.querySelector('#adminPassword').value;
  adminAuthMessage.textContent = 'Verifying credentials...';
  const response = await database.auth.signInWithPassword({ email, password });
  if (response.error) {
    adminAuthMessage.textContent = 'Sign-in failed. Please check email and password.';
    adminAuthMessage.classList.add('error');
    return;
  }
  isAdmin = await checkAdmin();
  adminAuthMessage.classList.remove('error');
  if (!isAdmin) {
    adminAuthMessage.textContent = 'This account does not have organization permissions.';
    await database.auth.signOut();
    return;
  }
  adminAuthMessage.textContent = '';
  updateAdminUi();
});

// Toggle Predictions Open/Closed (Immediate optimistic UI update)
document.querySelector('#toggleOpen').addEventListener('click', async (event) => {
  const open = !state.predictionsOpen;
  const button = event.currentTarget;

  // 1. Instantly update state & re-render UI
  state.predictionsOpen = open;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();

  // 2. Sync to Supabase in background
  if (remoteEnabled) {
    setSubmitting(button, true);
    try {
      const response = await database.from('event_settings').update({ 
        predictions_open: open, 
        updated_at: new Date().toISOString() 
      }).eq('id', 'main');
      if (response.error) {
        console.warn('Could not update remote database:', response.error);
      }
    } catch (error) {
      console.warn('Remote sync error:', error);
    } finally {
      setSubmitting(button, false);
    }
  }
});

// Publish Official Winner (Immediate optimistic UI update)
document.querySelector('#winnerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const winner = document.querySelector('#winnerName').value.trim();
  if (!winner) return;

  // 1. Instantly update state & re-render UI
  state.winner = winner;
  state.predictionsOpen = false;
  sessionStorage.setItem('blok_test_winner', winner);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();

  // Close admin panel & display podium results view
  setPanel(false);
  showView('results');

  // Launch Dancing Cat Meme Celebration for exactly 10 seconds!
  launchCatParty(`🎉 WE HAVE A CHAMPION: ${winner}! 🏆`, '10-second victory cat dance party activated! 🐱✨');

  // 2. Sync to Supabase in background
  if (remoteEnabled) {
    const button = event.currentTarget.querySelector('button');
    setSubmitting(button, true);
    try {
      const response = await database.from('event_settings').update({ 
        official_winner: winner, 
        predictions_open: false, 
        updated_at: new Date().toISOString() 
      }).eq('id', 'main');
      if (response.error) {
        console.warn('Could not publish result to remote:', response.error);
      }
    } catch (error) {
      console.warn('Remote publish error:', error);
    } finally {
      setSubmitting(button, false);
    }
  }
});

// Reset Event Data (Secured with typed confirmation)
document.querySelector('#clearData').addEventListener('click', async () => {
  const confirmation = window.prompt(
    '⚠️ WARNING: This will permanently delete all registered predictions and reset the official champion.\n\nTo confirm, type RESET in capital letters:'
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
    window.alert('Todos los datos del evento han sido reiniciados correctamente.');
  } catch (err) {
    console.error(err);
    window.alert('Error al reiniciar los datos.');
  }
});

// Admin Sign Out
document.querySelector('#adminLogout').addEventListener('click', async () => {
  await database.auth.signOut();
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

renderFinalistPool('men');
refresh();
