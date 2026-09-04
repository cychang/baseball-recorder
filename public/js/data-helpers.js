import { state } from './state.js';
import { BASE_LABELS } from './scoring-rules.js';
import { escapeHtml } from './utils.js';

export function getTeamName(teamId) {
  return (state.teams || []).find((team) => team.id === teamId)?.name || teamId || '未設定';
}

export function getTournamentName(tournamentId) {
  const tournament = (state.tournaments || []).find((item) => item.id === tournamentId);
  if (!tournament) return tournamentId || '未設定盃賽';
  return `${tournament.name} / ${tournament.season}`;
}

export function getPlayerName(playerId) {
  return (state.players || []).find((player) => player.id === playerId)?.name || playerId || '';
}

export function getHalfLabel(half) {
  return half === 'top' ? '上' : '下';
}

export function buildTeamOptions(selectedId = '') {
  return '<option value="">選擇球隊</option>' + (state.teams || [])
    .map((team) => `<option value="${escapeHtml(team.id)}" ${selectedId === team.id ? 'selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
}

export function buildTeamOptionsMulti(selectedIds = []) {
  const selected = new Set(selectedIds || []);
  return (state.teams || [])
    .map((team) => `<option value="${escapeHtml(team.id)}" ${selected.has(team.id) ? 'selected' : ''}>${escapeHtml(team.name)}</option>`)
    .join('');
}

export function buildTournamentOptions(selectedId = '') {
  return '<option value="">選擇盃賽</option>' + (state.tournaments || [])
    .map((tournament) => `<option value="${escapeHtml(tournament.id)}" ${selectedId === tournament.id ? 'selected' : ''}>${escapeHtml(tournament.name)} / ${escapeHtml(tournament.season)}</option>`)
    .join('');
}

export function buildGameOptions(selectedId = '') {
  return '<option value="">選擇比賽</option>' + (state.games || [])
    .map((game) => {
      const homeName = getTeamName(game.homeTeamId);
      const awayName = getTeamName(game.awayTeamId);
      const label = `${game.date || '未定日期'} / ${homeName} vs ${awayName}`;
      return `<option value="${escapeHtml(game.id)}" ${selectedId === game.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

export function getCurrentScoreGame() {
  return (state.games || []).find((game) => game.id === state.currentScoreGameId);
}

export function buildPlayerOptions(teamId, placeholder, selectedId = '') {
  const players = (state.players || []).filter((player) => !teamId || getPlayerTeamIds(player).includes(teamId));
  return `<option value="">${placeholder}</option>` + players
    .map((player) => `<option value="${escapeHtml(player.id)}" ${selectedId === player.id ? 'selected' : ''}>${escapeHtml(player.name)} #${escapeHtml(player.jersey || '')}</option>`)
    .join('');
}

export function getPlayerTeamIds(player) {
  if (Array.isArray(player?.teamIds) && player.teamIds.length > 0) return player.teamIds;
  return player?.teamId ? [player.teamId] : [];
}

export function getPlayerTeams(player) {
  if (Array.isArray(player?.teams) && player.teams.length > 0) return player.teams;
  return getPlayerTeamIds(player)
    .map((teamId) => (state.teams || []).find((team) => team.id === teamId))
    .filter(Boolean);
}

export function getPlayersForTeam(teamId) {
  return (state.players || []).filter((player) => getPlayerTeamIds(player).includes(teamId));
}

export function formatBases(bases = {}) {
  return ['first', 'second', 'third']
    .map((base) => bases[base] ? `${BASE_LABELS[base]} ${getPlayerName(bases[base])}` : '')
    .filter(Boolean)
    .join(' / ') || '壘上無人';
}
