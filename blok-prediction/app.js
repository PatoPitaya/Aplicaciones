const STORAGE_KEY = 'blok-predictions-v1';
const config = window.BLOK_SUPABASE_CONFIG || {};
const remoteEnabled = Boolean(config.url && config.anonKey && window.supabase);
const database = remoteEnabled ? window.supabase.createClient(config.url, config.anonKey) : null;

const form = document.querySelector('#predictionForm');
const nameInput = document.querySelector('#participantName');
const contactValueInput = document.querySelector('#contactValue');
const contactLabel = document.querySelector('#contactLabel');
const climberInput = document.querySelector('#climberName');
const formMessage = document.querySelector('#formMessage');
const adminPanel = document.querySelector('#adminPanel');
const scrim = document.querySelector('#panelScrim');
const adminAuth = document.querySelector('#adminAuth');
const adminControls = document.querySelector('#adminControls');
const adminWarning = document.querySelector('#adminWarning');
const adminAuthMessage = document.querySelector('#adminAuthMessage');
const appFrame = document.querySelector('#appFrame');
let isAdmin = !remoteEnabled;
let state = readLocalState();

function readLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.entries)) return { entries: saved.entries, winner: saved.winner || '', predictionsOpen: saved.predictionsOpen !== false };
  } catch (error) {
    console.warn('No se pudieron leer las predicciones guardadas.', error);
  }
  return { entries: [], winner: '', predictionsOpen: true };
}

const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const isCorrect = (entry) => Boolean(state.winner) && normalize(entry.climber) === normalize(state.winner);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function selectedContactType() {
  return document.querySelector('input[name="contactType"]:checked').value;
}

function updateContactField() {
  const isEmail = selectedContactType() === 'email';
  contactLabel.textContent = isEmail ? 'TU CORREO' : 'TU TELÉFONO';
  contactValueInput.type = isEmail ? 'email' : 'tel';
  contactValueInput.autocomplete = isEmail ? 'email' : 'tel';
  contactValueInput.inputMode = isEmail ? 'email' : 'tel';
  contactValueInput.placeholder = isEmail ? 'nombre@correo.com' : '+32 470 00 00 00';
}

function isValidContact(contactType, contactValue) {
  if (contactType === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue);
  return /^[0-9+()\s-]{7,}$/.test(contactValue);
}

function showMessage(message, error = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('error', error);
}

function setSubmitting(button, submitting) {
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

function updateClimberSelection() {
  const selected = normalize(climberInput.value || '');
  document.querySelectorAll('[data-climber-choice]').forEach((button) => {
    button.classList.toggle('is-selected', normalize(button.dataset.climberChoice) === selected);
  });
}

async function loadRemoteState() {
  const requests = [
    database.from('event_settings').select('official_winner, predictions_open').eq('id', 'main').maybeSingle(),
    database.from('predictions').select('id, participant_name, climber_name, created_at').order('created_at', { ascending: true })
  ];
  if (isAdmin) requests.push(database.from('prediction_contacts').select('prediction_id, contact_type, contact_value'));
  const responses = await Promise.all(requests);
  const settingsResponse = responses[0];
  const predictionsResponse = responses[1];
  const contactsResponse = responses[2];
  if (settingsResponse.error || predictionsResponse.error || contactsResponse?.error) throw settingsResponse.error || predictionsResponse.error || contactsResponse.error;
  const contactsByPrediction = new Map((contactsResponse?.data || []).map((item) => [item.prediction_id, item]));
  state = {
    entries: predictionsResponse.data.map((item) => ({
      id: item.id,
      name: item.participant_name,
      climber: item.climber_name,
      contactType: contactsByPrediction.get(item.id)?.contact_type,
      contactValue: contactsByPrediction.get(item.id)?.contact_value,
      createdAt: item.created_at
    })),
    winner: settingsResponse.data?.official_winner || '',
    predictionsOpen: settingsResponse.data?.predictions_open !== false
  };
}

async function refresh() {
  if (remoteEnabled) {
    try {
      await loadRemoteState();
    } catch (error) {
      console.error(error);
      showMessage('No se pudieron cargar las predicciones compartidas. Inténtalo de nuevo.', true);
    }
  }
  render();
}

function renderPublicResults(winners) {
  const results = document.querySelector('#resultsContent');
  if (!state.winner) {
    results.innerHTML = '<p class="empty-results">La final aún no se ha decidido.<br />Vuelve después de la competición para ver quién acertó.</p>';
    return;
  }
  const names = winners.length
    ? '<p class="result-list-title">QUIENES ACERTARON · ' + winners.length + '</p>' + winners.map((entry, index) => '<div class="result-entry"><strong>' + (index + 1) + '</strong><span><b>' + escapeHtml(entry.name) + '</b><small>Predijo: ' + escapeHtml(entry.climber) + '</small></span><i>♔</i></div>').join('')
    : '<p class="empty-results">Esta vez nadie acertó. ¡Gracias por jugar!</p>';
  results.innerHTML = '<p class="result-intro">Estos son los ganadores que acertaron al campeón de la final.</p><div class="result-winner"><span>GANADOR/A OFICIAL</span><h3>' + escapeHtml(state.winner) + '</h3></div>' + names;
}

function render() {
  const winners = state.entries.filter(isCorrect);
  document.querySelector('#adminEntryCount').textContent = state.entries.length;
  document.querySelector('#adminWinnerCount').textContent = winners.length;
  document.querySelector('#winnerName').value = state.winner;
  nameInput.disabled = !state.predictionsOpen;
  climberInput.disabled = !state.predictionsOpen;
  form.querySelector('[type="submit"]').disabled = !state.predictionsOpen;
  document.querySelector('#storageNote').textContent = remoteEnabled
    ? 'Una predicción por persona. Se guarda para todo el evento.'
    : 'Una predicción por persona. ¡Suerte!';

  const entriesBox = document.querySelector('#adminEntries');
  entriesBox.innerHTML = state.entries.length
    ? [...state.entries].reverse().map((entry) => '<div class="admin-entry ' + (isCorrect(entry) ? 'correct' : '') + '"><span><b>' + escapeHtml(entry.name) + '</b><small>' + escapeHtml(entry.contactValue || 'SIN CONTACTO') + '</small></span><span>' + escapeHtml(entry.climber) + '</span><span>' + (isCorrect(entry) ? '✓ ACERTÓ' : 'PREDIJO') + '</span></div>').join('')
    : '<p class="admin-empty">Todavía no hay participantes.</p>';

  renderPublicResults(winners);
  updateAdminUi();
}

function updateAdminUi() {
  adminAuth.hidden = isAdmin;
  adminControls.hidden = !isAdmin;
  document.querySelector('#adminLogout').hidden = !remoteEnabled || !isAdmin;
  adminWarning.textContent = remoteEnabled
    ? (isAdmin ? 'Conectado a la base de datos compartida. Solo las cuentas autorizadas pueden publicar el resultado.' : 'Inicia sesión con una cuenta autorizada para gestionar el evento.')
    : 'Modo local: los datos se guardan solo en este navegador. Configura Supabase para compartir predicciones con todos los móviles.';
}

async function checkAdmin() {
  if (!remoteEnabled) return true;
  const sessionResponse = await database.auth.getSession();
  const session = sessionResponse.data.session;
  if (!session) return false;
  const response = await database.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (response.error) console.warn('No se pudo validar la cuenta de organización.', response.error);
  return Boolean(response.data);
}

function setPanel(open) {
  adminPanel.hidden = !open;
  scrim.hidden = !open;
  document.querySelector('#adminToggle').setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const contactType = selectedContactType();
  const contactValue = contactValueInput.value.trim();
  const climber = climberInput.value.trim();
  if (!name || !contactValue || !climber) return;
  if (!isValidContact(contactType, contactValue)) {
    contactValueInput.focus();
    return showMessage(contactType === 'email' ? 'Escribe un correo válido.' : 'Escribe un teléfono válido.', true);
  }
  if (!state.predictionsOpen) return showMessage('Las predicciones ya están cerradas.', true);
  if (state.entries.some((entry) => normalize(entry.name) === normalize(name))) {
    nameInput.focus();
    return showMessage('Ese nombre ya tiene una predicción. Habla con la organización si necesitas corregirla.', true);
  }
  const button = form.querySelector('[type="submit"]');
  setSubmitting(button, true);
  try {
    if (remoteEnabled) {
      const response = await database.from('predictions').insert({ participant_name: name, climber_name: climber }).select('id').single();
      if (response.error) {
        if (response.error.code === '23505') throw new Error('Ese nombre ya tiene una predicción.');
        throw response.error;
      }
      const contactResponse = await database.from('prediction_contacts').insert({ prediction_id: response.data.id, contact_type: contactType, contact_value: contactValue });
      if (contactResponse.error) throw contactResponse.error;
      await refresh();
    } else {
      state.entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, climber, contactType, contactValue, createdAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    }
    document.querySelector('#successName').textContent = name;
    document.querySelector('#successPrediction').textContent = climber + ' · ' + contactValue;
    form.reset();
    updateContactField();
    updateClimberSelection();
    showMessage('¡Predicción guardada! Ya estás en juego. ✳');
    showView('success');
  } catch (error) {
    console.error(error);
    showMessage(error.message || 'No se pudo guardar la predicción. Inténtalo de nuevo.', true);
  } finally {
    setSubmitting(button, false);
  }
});

document.querySelector('#adminToggle').addEventListener('click', async () => {
  setPanel(true);
  isAdmin = await checkAdmin();
  updateAdminUi();
});
document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.viewTarget));
});
document.querySelectorAll('[data-climber-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    climberInput.value = button.dataset.climberChoice;
    updateClimberSelection();
  });
});
climberInput.addEventListener('input', updateClimberSelection);
document.querySelector('#closeAdmin').addEventListener('click', () => setPanel(false));
scrim.addEventListener('click', () => setPanel(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setPanel(false); });

document.querySelector('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!remoteEnabled) return;
  const email = document.querySelector('#adminEmail').value.trim();
  const password = document.querySelector('#adminPassword').value;
  adminAuthMessage.textContent = 'Comprobando cuenta…';
  const response = await database.auth.signInWithPassword({ email, password });
  if (response.error) {
    adminAuthMessage.textContent = 'No se pudo iniciar sesión. Revisa el correo y la contraseña.';
    adminAuthMessage.classList.add('error');
    return;
  }
  isAdmin = await checkAdmin();
  adminAuthMessage.classList.remove('error');
  if (!isAdmin) {
    adminAuthMessage.textContent = 'Esta cuenta no tiene permiso de organización.';
    await database.auth.signOut();
    return;
  }
  adminAuthMessage.textContent = '';
  updateAdminUi();
});

document.querySelector('#winnerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const winner = document.querySelector('#winnerName').value.trim();
  if (!winner || !isAdmin) return;
  const button = event.currentTarget.querySelector('button');
  setSubmitting(button, true);
  try {
    if (remoteEnabled) {
      const response = await database.from('event_settings').update({ official_winner: winner, predictions_open: false, updated_at: new Date().toISOString() }).eq('id', 'main');
      if (response.error) throw response.error;
      await refresh();
    } else {
      state.winner = winner;
      state.predictionsOpen = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    }
  } catch (error) {
    console.error(error);
    adminAuthMessage.textContent = 'No se pudo publicar el resultado.';
    adminAuthMessage.classList.add('error');
  } finally {
    setSubmitting(button, false);
  }
});

document.querySelector('#clearData').addEventListener('click', async () => {
  if (!isAdmin || !window.confirm('¿Borrar todas las predicciones y el resultado?')) return;
  if (remoteEnabled) {
    const removeResponse = await database.from('predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (removeResponse.error) return window.alert('No se pudieron borrar los datos.');
    await database.from('event_settings').update({ official_winner: null, predictions_open: true }).eq('id', 'main');
    await refresh();
  } else {
    state = { entries: [], winner: '', predictionsOpen: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  }
});

document.querySelector('#adminLogout').addEventListener('click', async () => {
  await database.auth.signOut();
  isAdmin = false;
  updateAdminUi();
});

if (remoteEnabled) {
  database.channel('blok-event')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_settings' }, refresh)
    .subscribe();
}
refresh();
