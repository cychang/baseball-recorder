import { buildGameOptions, buildTeamOptions, buildTournamentOptions, getCurrentScoreGame } from './data-helpers.js';
import { ui } from './dom.js';
import { renderLineupEditor } from './lineup.js';
import { renderBaseStateBoard } from './scorekeeper-ui.js';
import { state } from './state.js';

export function refreshFormOptions() {
  document.querySelectorAll('select[name="teamId"]').forEach((select) => {
    const selectedId = select.value;
    select.innerHTML = buildTeamOptions(selectedId);
    if (selectedId) select.value = selectedId;
  });
  document.querySelectorAll('select[name="homeTeamId"]').forEach((select) => {
    const selectedId = select.value;
    select.innerHTML = buildTeamOptions(selectedId).replace('選擇球隊', '選擇主隊');
    if (selectedId) select.value = selectedId;
  });
  document.querySelectorAll('select[name="awayTeamId"]').forEach((select) => {
    const selectedId = select.value;
    select.innerHTML = buildTeamOptions(selectedId).replace('選擇球隊', '選擇客隊');
    if (selectedId) select.value = selectedId;
  });
  document.querySelectorAll('select[name="tournamentId"]').forEach((select) => {
    const selectedId = select.value;
    select.innerHTML = buildTournamentOptions(selectedId);
    if (selectedId) select.value = selectedId;
  });
  if (ui.activeGameSelect) {
    const selectedId = state.currentScoreGameId || ui.activeGameSelect.value;
    ui.activeGameSelect.innerHTML = buildGameOptions(selectedId);
    if (selectedId) ui.activeGameSelect.value = selectedId;
  }
  if (state.currentScoreGameId) {
    renderLineupEditor(getCurrentScoreGame(), state.currentLineups);
    renderBaseStateBoard(state.currentContext || {});
  }
}
