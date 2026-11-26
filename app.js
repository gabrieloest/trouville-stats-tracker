const STORAGE_KEY = 'trouville_stats_v1';

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
let deferredPrompt = null;

// --- Persistência ---
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...getDefaultState(), ...JSON.parse(saved) };
    }
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

  const header = isHome ? `Trouville x  ${opponent}` : `${opponent} x  Trouville`;
  let text = `${header}\n`;

  const activeQuarters = Object.keys(state.playedQuarters).filter(q => state.playedQuarters[q]);

  if (activeQuarters.length === 0) {
    return `${header}\n(Nenhum tempo jogado selecionado)`;
  }

  activeQuarters.forEach(q => {
    const data = state.stats[q];
    text += `- Jogo ${q}\n`;
    text += ` ${data.pts} pts, ${data.rb} Rb, ${data.ass} ass, ${data.roubos} roubos, ${data.tocos} tocos\n`;
  });

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
    saveState();
    renderCurrentQuarterStats();
    updatePreview();
  }
}

function copyToClipboard() {
  const text = generateText();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-whatsapp');
    const originalText = btn.innerText;
    btn.innerText = '✅ Copiado para o WhatsApp!';
    setTimeout(() => { btn.innerText = originalText; }, 2000);
  }).catch(() => {
    alert('Não foi possível copiar automaticamente. Selecione o texto abaixo e copie.');
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
  document.getElementById('btn-whatsapp').addEventListener('click', copyToClipboard);

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

// Boot
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  syncUIWithState();
});