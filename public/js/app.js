import { fetchJson } from './api.js';
import { bindEventHandlers } from './event-handlers.js';
import { refreshFormOptions } from './form-options.js';
import { closeEditModal } from './modals.js';
import {
  renderGames,
  renderPlayers,
  renderTeams,
  renderTournaments,
  setActivePage,
} from './render-management.js';
import { ui } from './dom.js';
import { renderScorekeeper } from './scorekeeper-ui.js';
import { state } from './state.js';

async function loadConfig() {
  const config = await fetchJson('/api/config');
  ui.dataSourceBadge.textContent = config.dataSource || 'Local File';
  ui.configStatus.innerHTML = `
    <strong>資料來源：</strong> ${config.dataSource || 'Local File'}<br />
    <strong>Google Drive 啟用：</strong> ${config.googleDriveEnabled ? '是' : '否'}<br />
    <strong>憑證狀態：</strong> ${config.hasCredentials ? '已配置' : '未配置'}
  `;
}

async function loadOverview() {
  const data = await fetchJson('/api/overview');
  state.tournaments = data.tournaments || [];
  state.teams = data.teams || [];
  state.players = data.players || [];
  state.games = data.games || [];
  renderTeams(data.teams, data.players, data.games);
  renderGames(data.games, data.teams);
  renderPlayers(data.players, data.teams);
  renderTournaments(data.tournaments, data.games, data.teams);
  refreshFormOptions();
}

async function openScorekeeper(gameId) {
  state.currentScoreGameId = gameId;
  state.lineupExpanded = false;
  ui.scorekeeperPanel.hidden = false;
  if (ui.scorekeeperSelector) ui.scorekeeperSelector.hidden = true;
  if (ui.activeGameSelect) ui.activeGameSelect.value = gameId;
  setActivePage('scorekeeperPage');
  const data = await fetchJson(`/api/games/${gameId}/events`);
  renderScorekeeper(data);
}

function closeScorekeeper() {
  state.currentScoreGameId = null;
  state.currentLineups = {};
  state.currentContext = null;
  state.currentEvents = [];
  state.lineupExpanded = false;
  state.baseStateTouched = false;
  state.runnerDestinations = {};
  state.selectedRunnerSource = '';
  state.pendingBases = null;
  ui.scorekeeperPanel.hidden = true;
  if (ui.scorekeeperSelector) ui.scorekeeperSelector.hidden = false;
  if (ui.finishGameBtn) ui.finishGameBtn.disabled = false;
  if (ui.undoLastEventBtn) ui.undoLastEventBtn.disabled = true;
  if (ui.activeGameSelect) ui.activeGameSelect.value = '';
  ui.eventTimeline.innerHTML = '';
  ui.lineScoreTable.innerHTML = '';
  ui.matchupPanel.innerHTML = '';
  ui.countPanel.innerHTML = '';
  ui.lineupEditor.innerHTML = '';
  ui.fieldDiamond.querySelectorAll('[data-base-indicator]').forEach((base) => base.classList.remove('occupied'));
}

function openDefaultPage() {
  closeScorekeeper();
  setActivePage('gamesPage');
}

async function submitEdit(event) {
  event.preventDefault();
  if (!state.currentEditType) return;

  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  if (state.currentEditType === 'player') {
    payload.teamIds = formData.getAll('teamIds').filter(Boolean);
    payload.teamId = payload.teamIds[0] || '';
  }

  const collectionMap = {
    team: '/api/teams',
    player: '/api/players',
    tournament: '/api/tournaments',
    game: '/api/games',
  };
  const endpoint = state.currentEditId
    ? `${collectionMap[state.currentEditType]}/${state.currentEditId}`
    : collectionMap[state.currentEditType];

  await fetchJson(endpoint, {
    method: state.currentEditId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  closeEditModal();
  await loadOverview();
}

async function init() {
  await loadConfig();
  await loadOverview();
  refreshFormOptions();
  openDefaultPage();
}

bindEventHandlers({
  closeScorekeeper,
  loadConfig,
  loadOverview,
  openDefaultPage,
  openScorekeeper,
  submitEdit,
});

init();
