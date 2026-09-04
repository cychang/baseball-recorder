import { buildPlayerOptions, getPlayersForTeam, getTeamName } from './data-helpers.js';
import { ui } from './dom.js';
import { state } from './state.js';
import { escapeHtml } from './utils.js';

export function renderLineupEditor(game, lineups = {}) {
  if (!game) {
    ui.lineupEditor.innerHTML = '<div class="mini-card">先選擇比賽</div>';
    return;
  }
  const teams = [
    { id: game.awayTeamId, label: `客隊 ${getTeamName(game.awayTeamId)}` },
    { id: game.homeTeamId, label: `主隊 ${getTeamName(game.homeTeamId)}` },
  ];
  ui.lineupEditor.innerHTML = teams.map((team) => {
    const lineup = lineups[team.id] || { battingOrder: [] };
    const selectedByOrder = new Map((lineup.battingOrder || []).map((entry) => [Number(entry.battingOrder), entry.playerId]));
    const playerCount = Math.max(9, getPlayersForTeam(team.id).length || 1);
    const rows = Array.from({ length: playerCount }, (_, index) => {
      const order = index + 1;
      return `
        <div class="lineup-row">
          <strong>#${order}</strong>
          <select data-lineup-team="${escapeHtml(team.id)}" data-lineup-order="${order}">
            ${buildPlayerOptions(team.id, '選擇打者', selectedByOrder.get(order) || '')}
          </select>
        </div>
      `;
    }).join('');
    return `
      <div class="lineup-team">
        <h4 style="margin: 10px 0 0;">${escapeHtml(team.label)}</h4>
        ${rows}
      </div>
    `;
  }).join('');
  updateLineupPlayerLocks();
}

export function updateLineupPlayerLocks() {
  const selectedPlayersByTeam = new Map();
  ui.lineupEditor.querySelectorAll('select[data-lineup-team]').forEach((select) => {
    if (!select.value) return;
    const teamId = select.dataset.lineupTeam;
    if (!selectedPlayersByTeam.has(teamId)) selectedPlayersByTeam.set(teamId, new Set());
    selectedPlayersByTeam.get(teamId).add(select.value);
  });

  ui.lineupEditor.querySelectorAll('select[data-lineup-team]').forEach((select) => {
    const selectedPlayers = selectedPlayersByTeam.get(select.dataset.lineupTeam) || new Set();
    select.querySelectorAll('option').forEach((option) => {
      option.disabled = Boolean(option.value && selectedPlayers.has(option.value) && option.value !== select.value);
    });
  });
}

export function setLineupExpanded(expanded) {
  state.lineupExpanded = Boolean(expanded);
  if (ui.lineupBody) ui.lineupBody.hidden = !state.lineupExpanded;
  if (ui.toggleLineupBtn) {
    ui.toggleLineupBtn.setAttribute('aria-expanded', String(state.lineupExpanded));
    ui.toggleLineupBtn.textContent = state.lineupExpanded ? '收合 Order 單' : '展開 Order 單';
  }
}
