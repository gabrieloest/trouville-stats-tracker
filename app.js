const STORAGE_KEY = 'trouville_stats_v1';
const SYNC_STORAGE_KEY = 'trouville_sync_config_v1';
const FIREBASE_DB_URL = 'https://trouville-stats-tracker-default-rtdb.firebaseio.com';

const getDefaultState = () => ({
  opponent: '',
  location: 'home',
  playedQuarters: { 1: true, 2: true, 3: true, 4: false, 5: false, 6: false },
  currentActiveQuarter: 1,
  stats: {
    1: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 },
    2: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 },
    3: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 },
    4: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 },
    5: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 },
    6: { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 }
  }
});

let state = loadState();
let syncConfig = loadSyncConfig(); // { role: 'primary'|'viewer', firebaseUrl, roomId, secret, pairCode }
let deferredPrompt = null;
let wakeLock = null;
let pushDebounceTimer = null;
let viewerPollTimer = null;

// --- Persistência Local ---
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...getDefaultState(), ...JSON.parse(saved) };
  } catch (e) {
    console.warn('Erro ao ler localStorage:', e);
  }
  return getDefaultState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }

  if (syncConfig && syncConfig.role === 'primary') {
    schedulePush();
  }
}

function loadSyncConfig() {
  try {
    const saved = localStorage.getItem(SYNC_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function saveSyncConfig(cfg) {
  syncConfig = cfg;
  try {
    if (cfg) localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(SYNC_STORAGE_KEY);
  } catch (e) {
    console.warn('Erro ao salvar syncConfig:', e);
  }
}

// --- Wake Lock (Mantém a tela acesa durante o jogo) ---
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('Wake Lock não pôde ser ativado:', err);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    if (syncConfig && syncConfig.role === 'viewer') {
      pullFromCloud();
    }
  }
});

// --- Feedback Tátil ---
function triggerHapticFeedback() {
  if ('vibrate' in navigator) {
    navigator.vibrate(25);
  }
}

// --- Sincronização E2EE (Zero-Knowledge) ---
function buildSnapshot() {
  return {
    opponent: state.opponent,
    location: state.location,
    playedQuarters: state.playedQuarters,
    stats: state.stats
  };
}

function schedulePush() {
  clearTimeout(pushDebounceTimer);
  const statusEl = document.getElementById('sync-last-push');
  if (statusEl) statusEl.innerText = '⏳ Enviando atualização...';

  pushDebounceTimer = setTimeout(() => {
    pushToCloud();
  }, 600);
}

async function pushToCloud() {
  if (!syncConfig || syncConfig.role !== 'primary') return;
  const statusEl = document.getElementById('sync-last-push');
  try {
    const ts = await E2EESync.push(
      syncConfig.firebaseUrl || FIREBASE_DB_URL,
      syncConfig.roomId,
      syncConfig.secret,
      buildSnapshot()
    );
    const timeStr = new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (statusEl) statusEl.innerText = `✅ Sincronizado às ${timeStr}`;
  } catch (err) {
    console.error('Erro ao enviar snapshot:', err);
    if (statusEl) statusEl.innerText = '⚠️ Sem sinal — será enviado quando reconectar.';
  }
}

async function pullFromCloud() {
  if (!syncConfig || syncConfig.role !== 'viewer') return;
  const pullText = document.getElementById('sync-last-pull');
  const bannerTime = document.getElementById('viewer-sync-time');

  try {
    const result = await E2EESync.pull(
      syncConfig.firebaseUrl || FIREBASE_DB_URL,
      syncConfig.roomId,
      syncConfig.secret
    );

    if (!result) {
      if (bannerTime) bannerTime.innerText = 'Sala encerrada ou aguardando dados';
      if (pullText) pullText.innerText = 'Nenhum dado encontrado nesta sala.';
      return;
    }

    state = { ...getDefaultState(), ...result.payload };
    updatePreview();

    const timeStr = new Date(result.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (bannerTime) bannerTime.innerText = `Atualizado ${timeStr}`;
    if (pullText) pullText.innerText = `✅ Última atualização recebida às ${timeStr}`;
  } catch (err) {
    console.error('Erro ao ler snapshot:', err);
    if (bannerTime) bannerTime.innerText = 'Offline / Reconectando...';
  }
}

function startViewerPolling() {
  stopViewerPolling();
  pullFromCloud();
  viewerPollTimer = setInterval(pullFromCloud, 15000);
}

function stopViewerPolling() {
  if (viewerPollTimer) {
    clearInterval(viewerPollTimer);
    viewerPollTimer = null;
  }
}

function updateSyncUI() {
  const syncBtn = document.getElementById('btn-sync-toggle');
  const badge = document.getElementById('sync-badge');
  const setupBox = document.getElementById('sync-setup-box');
  const primaryBox = document.getElementById('sync-active-primary');
  const viewerBox = document.getElementById('sync-active-viewer');
  const editorControls = document.getElementById('editor-controls');
  const viewerBanner = document.getElementById('viewer-banner');
  const resetBtn = document.getElementById('btn-reset');

  setupBox.classList.add('hidden');
  primaryBox.classList.add('hidden');
  viewerBox.classList.add('hidden');

  if (!syncConfig) {
    syncBtn.classList.remove('connected');
    syncBtn.innerText = '🔗 Sync';
    badge.className = 'sync-badge offline';
    badge.innerText = 'Desconectado';
    setupBox.classList.remove('hidden');
    editorControls.classList.remove('hidden');
    viewerBanner.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    return;
  }

  syncBtn.classList.add('connected');
  badge.className = 'sync-badge online';

  if (syncConfig.role === 'primary') {
    syncBtn.innerText = '🟢 Ao Vivo';
    badge.innerText = 'Transmitindo';
    primaryBox.classList.remove('hidden');
    editorControls.classList.remove('hidden');
    viewerBanner.classList.add('hidden');
    resetBtn.classList.remove('hidden');
  } else if (syncConfig.role === 'viewer') {
    syncBtn.innerText = '👀 Conectado';
    badge.innerText = 'Recebendo';
    viewerBox.classList.remove('hidden');
    editorControls.classList.add('hidden');
    viewerBanner.classList.remove('hidden');
    resetBtn.classList.add('hidden');
  }
}

// --- Renderização ---
function syncUIWithState() {
  document.getElementById('opponent').value = state.opponent;
  document.getElementById('location').value = state.location;

  for (let q = 1; q <= 6; q++) {
    const chk = document.getElementById(`chk-${q}`);
    const lbl = document.getElementById(`lbl-t${q}`);
    const isChecked = !!state.playedQuarters[q];
    chk.checked = isChecked;
    lbl.classList.toggle('checked', isChecked);
  }

  renderTabs();
  renderCurrentQuarterStats();
  updatePreview();
}

function renderTabs() {
  const container = document.getElementById('quarter-tabs');
  container.innerHTML = '';

  const activeQuarters = Object.keys(state.playedQuarters).filter(q => state.playedQuarters[q]);

  if (activeQuarters.length === 0) {
    document.getElementById('card-tab-selector').style.display = 'none';
    document.getElementById('card-stats-panel').style.display = 'none';
    return;
  }

  document.getElementById('card-tab-selector').style.display = 'block';
  document.getElementById('card-stats-panel').style.display = 'block';

  activeQuarters.forEach((qStr) => {
    const q = parseInt(qStr, 10);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `quarter-btn ${q === state.currentActiveQuarter ? 'active' : ''}`;
    btn.innerText = `Jogo ${q}`;
    btn.addEventListener('click', () => setQuarter(q));
    container.appendChild(btn);
  });
}

function renderCurrentQuarterStats() {
  const q = state.currentActiveQuarter;
  document.getElementById('current-quarter-title').innerText = `Estatísticas - Jogo ${q}`;
  const qData = state.stats[q];

  if (qData) {
    document.getElementById('pts-val').innerText = qData.pts;
    document.getElementById('rb-val').innerText = qData.rb;
    document.getElementById('ass-val').innerText = qData.ass;
    document.getElementById('roubos-val').innerText = qData.roubos;
    document.getElementById('tocos-val').innerText = qData.tocos;
  }
}

function generateText() {
  const opponent = state.opponent.trim() || 'Adversário';
  const isHome = state.location === 'home';

  const header = isHome ? `Trouville x ${opponent}` : `${opponent} x Trouville`;
  let text = `${header}\n`;

  const activeQuarters = Object.keys(state.playedQuarters).filter(q => state.playedQuarters[q]);

  if (activeQuarters.length === 0) {
    return `${header}\n(Nenhum tempo jogado selecionado)`;
  }

  const totals = { pts: 0, rb: 0, ass: 0, roubos: 0, tocos: 0 };

  activeQuarters.forEach(q => {
    const data = state.stats[q];
    totals.pts += data.pts;
    totals.rb += data.rb;
    totals.ass += data.ass;
    totals.roubos += data.roubos;
    totals.tocos += data.tocos;

    text += `- Jogo ${q}\n`;
    text += ` ${data.pts} pts, ${data.rb} Rb, ${data.ass} ass, ${data.roubos} roubos, ${data.tocos} tocos\n`;
  });

  text += `\n- Total\n`;
  text += ` ${totals.pts} pts, ${totals.rb} Rb, ${totals.ass} ass, ${totals.roubos} roubos, ${totals.tocos} tocos`;

  return text.trim();
}

function updatePreview() {
  document.getElementById('preview-text').innerText = generateText();
}

// --- Ações e Eventos ---
function handleInputChange() {
  state.opponent = document.getElementById('opponent').value;
  state.location = document.getElementById('location').value;
  saveState();
  updatePreview();
}

function toggleQuarterPlayed(q) {
  const isChecked = document.getElementById(`chk-${q}`).checked;
  state.playedQuarters[q] = isChecked;

  const lbl = document.getElementById(`lbl-t${q}`);
  lbl.classList.toggle('checked', isChecked);

  const activeKeys = Object.keys(state.playedQuarters).filter(k => state.playedQuarters[k]);

  if (!isChecked && state.currentActiveQuarter === q && activeKeys.length > 0) {
    state.currentActiveQuarter = parseInt(activeKeys[0], 10);
  } else if (isChecked && activeKeys.length === 1) {
    state.currentActiveQuarter = q;
  }

  saveState();
  renderTabs();
  renderCurrentQuarterStats();
  updatePreview();
}

function setQuarter(q) {
  state.currentActiveQuarter = q;
  saveState();
  renderTabs();
  renderCurrentQuarterStats();
}

function changeStat(statKey, delta) {
  const q = state.currentActiveQuarter;
  if (state.stats[q][statKey] + delta >= 0) {
    state.stats[q][statKey] += delta;
    triggerHapticFeedback();
    saveState();
    renderCurrentQuarterStats();
    updatePreview();
  }
}

function copyToClipboard(text, btnElement, successLabel) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElement.innerText;
    btnElement.innerText = successLabel;
    setTimeout(() => { btnElement.innerText = originalText; }, 2200);
  }).catch(() => {
    alert('Não foi possível copiar automaticamente. Copie manualmente:\n\n' + text);
  });
}

function resetMatch() {
  if (confirm('Deseja zerar todas as estatísticas para iniciar uma nova partida?')) {
    state = getDefaultState();
    saveState();
    syncUIWithState();
  }
}

// --- Inicialização de Listeners ---
function bindEvents() {
  document.getElementById('opponent').addEventListener('input', handleInputChange);
  document.getElementById('location').addEventListener('change', handleInputChange);
  document.getElementById('btn-reset').addEventListener('click', resetMatch);

  document.getElementById('btn-whatsapp').addEventListener('click', (e) => {
    copyToClipboard(generateText(), e.currentTarget, '✅ Copiado para o WhatsApp!');
  });

  document.querySelectorAll('.time-checkbox-btn input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const q = parseInt(e.target.dataset.quarter, 10);
      toggleQuarterPlayed(q);
    });
  });

  document.querySelectorAll('.btn-counter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const statKey = e.currentTarget.dataset.stat;
      const delta = parseInt(e.currentTarget.dataset.delta, 10);
      changeStat(statKey, delta);
    });
  });

  // Eventos do Painel Sync (1 clique)
  document.getElementById('btn-sync-toggle').addEventListener('click', () => {
    document.getElementById('sync-panel').classList.toggle('hidden');
  });

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const room = E2EESync.createRoom('TRV');
    const cfg = {
      role: 'primary',
      firebaseUrl: FIREBASE_DB_URL,
      roomId: room.roomId,
      secret: room.secret,
      pairCode: room.pairCode
    };

    saveSyncConfig(cfg);
    updateSyncUI();
    await pushToCloud();
  });

  document.getElementById('btn-copy-invite').addEventListener('click', (e) => {
    if (!syncConfig) return;
    const link = E2EESync.buildInviteLink(syncConfig.firebaseUrl || FIREBASE_DB_URL, syncConfig.pairCode);
    copyToClipboard(link, e.currentTarget, '✅ Link Copiado!');
  });

  document.getElementById('btn-revoke-room').addEventListener('click', async () => {
    if (!syncConfig) return;
    if (confirm('Deseja encerrar a transmissão e apagar os dados desta sala no Firebase?')) {
      try {
        await E2EESync.revoke(syncConfig.firebaseUrl || FIREBASE_DB_URL, syncConfig.roomId);
      } catch (e) {
        console.warn('Erro ao apagar sala remota:', e);
      }
      saveSyncConfig(null);
      updateSyncUI();
    }
  });

  document.getElementById('btn-force-pull').addEventListener('click', pullFromCloud);

  document.getElementById('btn-leave-room').addEventListener('click', () => {
    if (confirm('Deseja desconectar desta transmissão?')) {
      stopViewerPolling();
      saveSyncConfig(null);
      state = getDefaultState();
      syncUIWithState();
      updateSyncUI();
    }
  });

  // PWA Install Prompt
  const installBtn = document.getElementById('btn-install');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.style.display = 'none';
    }
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredPrompt = null;
  });
}

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(err => console.error('Falha ao registrar Service Worker:', err));
  });
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se o app foi aberto através de um link de convite (#pair=...)
  const invite = E2EESync.consumeInviteFromHash('TRV');
  if (invite) {
    saveSyncConfig({
      role: 'viewer',
      firebaseUrl: invite.firebaseUrl || FIREBASE_DB_URL,
      roomId: invite.roomId,
      secret: invite.secret,
      pairCode: invite.pairCode
    });
  }

  bindEvents();
  syncUIWithState();
  updateSyncUI();
  requestWakeLock();

  if (syncConfig) {
    if (syncConfig.role === 'primary') {
      pushToCloud();
    } else if (syncConfig.role === 'viewer') {
      startViewerPolling();
    }
  }
});