import { fetchJson } from './api.js';
import { getCurrentScoreGame } from './data-helpers.js';
import { ui } from './dom.js';
import { setLineupExpanded, updateLineupPlayerLocks } from './lineup.js';
import { closeEditModal, openCreateModal, openEditModal } from './modals.js';
import { setActivePage } from './render-management.js';
import {
  applyDefaultPlaySelection,
  applyRunnerDestinations,
  clearFielderPosition,
  finishRunnerPointerDrag,
  getBaseStateBoardValues,
  getLatestEventForUndo,
  handleCountLightClick,
  moveRunnerPointerDrag,
  moveRunnerToDestination,
  renderFielderPositionButtons,
  renderInteractiveDiamond,
  renderOutControls,
  renderResultActionButtons,
  renderScoreboardPreview,
  renderScorekeeper,
  resetPendingPlaySelection,
  selectLeadRunnerForCorrection,
  setReadyPlayState,
  startRunnerPointerDrag,
  updatePlaySubmitState,
} from './scorekeeper-ui.js';
import { state } from './state.js';
import {
  getAutomaticPlayAction,
  getDefaultRunnerDestinations,
  hasOccupiedBase,
  requiresFielderPosition,
  requiresOccupiedBaseForResult,
} from './scoring-rules.js';

export function bindEventHandlers({
  closeScorekeeper,
  loadConfig,
  loadOverview,
  openDefaultPage,
  openScorekeeper,
  submitEdit,
}) {
  document.querySelectorAll('.nav button').forEach(button => {
    button.addEventListener('click', () => {
      setActivePage(button.dataset.target);
    });
  });

  document.getElementById('resetDemoBtn').addEventListener('click', async () => {
    await fetchJson('/api/reset', { method: 'POST' });
    closeScorekeeper();
    await loadOverview();
    await loadConfig();
    openDefaultPage();
  });

  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('closeScorekeeperBtn').addEventListener('click', closeScorekeeper);
  ui.toggleLineupBtn.addEventListener('click', () => {
    setLineupExpanded(!state.lineupExpanded);
  });
  ui.lineupEditor.addEventListener('change', (event) => {
    if (event.target.matches('select[data-lineup-team]')) updateLineupPlayerLocks();
  });
  ui.fieldDiamond.addEventListener('dragstart', (event) => {
    const chip = event.target.closest('[data-runner-chip]');
    if (!chip) return;
    state.selectedRunnerSource = chip.dataset.runnerSource;
    event.dataTransfer.setData('text/plain', chip.dataset.runnerSource);
    event.dataTransfer.effectAllowed = 'move';
    ui.fieldDiamond.querySelectorAll('[data-runner-chip]').forEach((runner) => {
      runner.classList.toggle('selected', runner.dataset.runnerSource === state.selectedRunnerSource);
    });
  });
  ui.fieldDiamond.addEventListener('dragover', (event) => {
    if (!event.target.closest('[data-runner-target]')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  });
  ui.fieldDiamond.addEventListener('dragenter', (event) => {
    const target = event.target.closest('[data-runner-target]');
    if (target) target.classList.add('drop-ready');
  });
  ui.fieldDiamond.addEventListener('dragleave', (event) => {
    const target = event.target.closest('[data-runner-target]');
    if (target) target.classList.remove('drop-ready');
  });
  ui.fieldDiamond.addEventListener('drop', (event) => {
    const target = event.target.closest('[data-runner-target]');
    if (!target) return;
    event.preventDefault();
    target.classList.remove('drop-ready');
    const sourceKey = event.dataTransfer.getData('text/plain') || state.selectedRunnerSource;
    moveRunnerToDestination(sourceKey, target.dataset.runnerTarget);
  });
  ui.fieldDiamond.addEventListener('pointerdown', (event) => {
    const chip = event.target.closest('[data-runner-chip]');
    if (!chip || event.button > 0) return;
    event.preventDefault();
    startRunnerPointerDrag(event, chip);
  });
  ui.fieldDiamond.addEventListener('pointermove', (event) => {
    moveRunnerPointerDrag(event);
  });
  ui.fieldDiamond.addEventListener('pointerup', (event) => {
    finishRunnerPointerDrag(event);
  });
  ui.fieldDiamond.addEventListener('pointercancel', () => {
    state.runnerDrag = null;
    renderInteractiveDiamond();
  });
  ui.fieldDiamond.addEventListener('click', (event) => {
    if (state.ignoreNextRunnerClick) {
      state.ignoreNextRunnerClick = false;
      return;
    }

    const chip = event.target.closest('[data-runner-chip]');
    if (chip) {
      state.selectedRunnerSource = state.selectedRunnerSource === chip.dataset.runnerSource ? '' : chip.dataset.runnerSource;
      renderInteractiveDiamond();
      return;
    }

    const target = event.target.closest('[data-runner-target]');
    if (!target || !state.selectedRunnerSource) return;
    moveRunnerToDestination(state.selectedRunnerSource, target.dataset.runnerTarget);
  });
  ui.countPanel.addEventListener('click', (event) => {
    const light = event.target.closest('[data-count-kind]');
    if (light) {
      handleCountLightClick(light);
      return;
    }
  });
  ui.activeGameSelect.addEventListener('change', async (event) => {
    const gameId = event.target.value;
    if (!gameId) {
      closeScorekeeper();
      ui.eventTimeline.innerHTML = '<div class="mini-card">選擇比賽後開始記錄</div>';
      return;
    }
    await openScorekeeper(gameId);
  });
  ui.editModal.addEventListener('click', (event) => {
    if (event.target === ui.editModal) closeEditModal();
  });
  ui.editForm.addEventListener('submit', submitEdit);
  ui.lineupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.currentScoreGameId) return;

    const game = getCurrentScoreGame();
    const lineups = [game.awayTeamId, game.homeTeamId].map((teamId) => {
      const battingOrder = Array.from(ui.lineupEditor.querySelectorAll('select[data-lineup-team]'))
        .filter((select) => select.dataset.lineupTeam === teamId)
        .map((select) => select.value)
        .filter(Boolean);
      return {
        teamId,
        battingOrder,
      };
    });

    await fetchJson(`/api/games/${state.currentScoreGameId}/lineups`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineups }),
    });
    state.lineupExpanded = false;
    await openScorekeeper(state.currentScoreGameId);
  });

  async function submitPitchAction(action) {
    if (!state.currentScoreGameId || !state.currentContext?.lineupReady) return;

    const currentBalls = Number(state.currentContext.balls || 0);
    const currentStrikes = Number(state.currentContext.strikes || 0);
    const next = {
      BALL: { balls: Math.min(3, currentBalls + 1), strikes: currentStrikes, notes: 'Ball' },
      CALLED_STRIKE: { balls: currentBalls, strikes: currentStrikes + 1, notes: 'Called strike' },
      SWINGING_STRIKE: { balls: currentBalls, strikes: currentStrikes + 1, notes: 'Swinging strike' },
      FOUL: { balls: currentBalls, strikes: Math.min(2, currentStrikes + (currentStrikes < 2 ? 1 : 0)), notes: 'Foul' },
    }[action];
    if (!next) return;

    const isBallFour = action === 'BALL' && currentBalls >= 3;
    const data = await fetchJson(`/api/games/${state.currentScoreGameId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: isBallFour ? 'PLATE_APPEARANCE' : 'PITCH',
        result: isBallFour ? 'WALK' : undefined,
        balls: isBallFour ? 0 : next.balls,
        strikes: isBallFour ? 0 : next.strikes,
        notes: isBallFour ? '保送上一壘' : next.notes,
      }),
    });
    renderScorekeeper(data);
    await loadOverview();
  }

  async function submitCurrentPlay(form = ui.eventForm) {
    if (!state.currentScoreGameId) return;

    if (!form.result.value) return;
    if (requiresFielderPosition(form.result.value) && !form.fielderPosition.value) return;
    const selectedPlayAction = getAutomaticPlayAction(form.result.value, state.currentContext || {}, form.eventType.value);
    if (!state.baseStateTouched && selectedPlayAction) {
      state.runnerDestinations = getDefaultRunnerDestinations(form.result.value, state.currentContext || {}, form.eventType.value);
      applyRunnerDestinations();
    }
    const bases = getBaseStateBoardValues();
    const payload = {
      eventType: form.eventType.value,
      result: form.result.value,
      runs: Number(form.runs.value || 0),
      outs: Number(form.outs.value || 0),
      balls: selectedPlayAction ? 0 : Number(form.balls.value || 0),
      strikes: selectedPlayAction ? 0 : Number(form.strikes.value || 0),
      bases,
      notes: '',
    };
    if (form.fielderPosition.value) payload.fielderPosition = form.fielderPosition.value;

    const data = await fetchJson(`/api/games/${state.currentScoreGameId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    form.reset();
    form.eventType.value = 'PLATE_APPEARANCE';
    form.result.value = '';
    clearFielderPosition();
    state.baseStateTouched = false;
    renderScorekeeper(data);
    await loadOverview();
  }

  ui.eventForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitCurrentPlay(event.target);
  });

  document.addEventListener('click', async (event) => {
    const teamId = event.target.closest('[data-delete-team]')?.getAttribute('data-delete-team');
    const playerId = event.target.closest('[data-delete-player]')?.getAttribute('data-delete-player');
    const tournamentId = event.target.closest('[data-delete-tournament]')?.getAttribute('data-delete-tournament');
    const gameId = event.target.closest('[data-delete-game]')?.getAttribute('data-delete-game');
    const scoreGameId = event.target.closest('[data-score-game]')?.getAttribute('data-score-game');
    const readyAction = event.target.closest('[data-ready-action]');
    const resultAction = event.target.closest('[data-result-action]')?.getAttribute('data-result-action');
    const runnerEventAction = event.target.closest('[data-runner-event-action]')?.getAttribute('data-runner-event-action');
    const fielderPositionAction = event.target.closest('[data-fielder-position]')?.getAttribute('data-fielder-position');
    const undoLastEvent = event.target.closest('[data-undo-last-event]');
    const editTeamId = event.target.closest('[data-edit-team]')?.getAttribute('data-edit-team');
    const editPlayerId = event.target.closest('[data-edit-player]')?.getAttribute('data-edit-player');
    const editTournamentId = event.target.closest('[data-edit-tournament]')?.getAttribute('data-edit-tournament');
    const editGameId = event.target.closest('[data-edit-game]')?.getAttribute('data-edit-game');
    const createType = event.target.closest('[data-create]')?.getAttribute('data-create');
    const pitchAction = event.target.closest('[data-pitch-action]')?.getAttribute('data-pitch-action');
    const openTournamentId = event.target.closest('[data-open-tournament]')?.getAttribute('data-open-tournament');
    const openTeamId = event.target.closest('[data-open-team]')?.getAttribute('data-open-team');
    const openGameId = event.target.closest('[data-open-game]')?.getAttribute('data-open-game');
    const finishGame = event.target.closest('[data-finish-game]');
    const cardActionsMenu = event.target.closest('[data-card-actions-menu]');

    if (cardActionsMenu) {
      const card = cardActionsMenu.closest('.mini-card');
      const isOpen = card?.classList.contains('actions-open');
      document.querySelectorAll('.mini-card.actions-open').forEach((item) => {
        if (item !== card) item.classList.remove('actions-open');
      });
      card?.classList.toggle('actions-open', !isOpen);
      cardActionsMenu.setAttribute('aria-expanded', String(!isOpen));
      return;
    }

    if (!event.target.closest('.card-actions-inline')) {
      document.querySelectorAll('.mini-card.actions-open').forEach((item) => item.classList.remove('actions-open'));
    }

    if (pitchAction) {
      await submitPitchAction(pitchAction);
      return;
    }

    if (finishGame && state.currentScoreGameId) {
      await fetchJson(`/api/games/${state.currentScoreGameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      await openScorekeeper(state.currentScoreGameId);
      await loadOverview();
      return;
    }

    if (readyAction) {
      setReadyPlayState();
      return;
    }

    if (resultAction) {
      if (requiresOccupiedBaseForResult(resultAction) && !hasOccupiedBase(state.currentContext || {})) return;
      if (ui.eventForm.result.value !== resultAction) clearFielderPosition();
      ui.eventForm.eventType.value = 'PLATE_APPEARANCE';
      ui.eventForm.result.value = resultAction;
      state.baseStateTouched = false;
      applyDefaultPlaySelection();
      return;
    }

    if (runnerEventAction) {
      if (!hasOccupiedBase(state.currentContext || {})) return;
      const isSwitchingPendingPlay = Boolean(ui.eventForm.result.value && ui.eventForm.result.value !== runnerEventAction);
      if (isSwitchingPendingPlay) resetPendingPlaySelection();
      const hasManualRunnerEdit = state.baseStateTouched && !isSwitchingPendingPlay;
      const requiresManualRunnerSubmit = ['WILD_PITCH', 'STOLEN_BASE', 'PICKOFF'].includes(runnerEventAction);
      clearFielderPosition();
      ui.eventForm.eventType.value = 'RUNNER_ADVANCEMENT';
      ui.eventForm.result.value = runnerEventAction;
      if (!hasManualRunnerEdit) {
        state.baseStateTouched = false;
        applyDefaultPlaySelection();
      } else {
        renderResultActionButtons();
        renderScoreboardPreview();
        renderOutControls();
      }
      if (requiresManualRunnerSubmit) {
        selectLeadRunnerForCorrection();
        updatePlaySubmitState();
        return;
      }
      await submitCurrentPlay();
      return;
    }

    if (fielderPositionAction) {
      if (!requiresFielderPosition(ui.eventForm.result.value)) return;
      ui.eventForm.fielderPosition.value = fielderPositionAction;
      renderFielderPositionButtons();
      updatePlaySubmitState();
      return;
    }

    if (undoLastEvent && state.currentScoreGameId) {
      const latestEvent = getLatestEventForUndo();
      if (!latestEvent) return;
      const data = await fetchJson(`/api/games/${state.currentScoreGameId}/events/${latestEvent.id}`, { method: 'DELETE' });
      renderScorekeeper(data);
      await loadOverview();
      return;
    }

    if (createType) {
      openCreateModal(createType);
      return;
    }

    if (openTournamentId) {
      event.preventDefault();
      const tournamentSearchInput = document.getElementById('tournamentSearchInput');
      if (tournamentSearchInput) tournamentSearchInput.value = '';
      await loadOverview();
      setActivePage('tournamentsPage');
      const target = document.querySelector(`[data-tournament-card="${openTournamentId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('linked-card-highlight');
        setTimeout(() => target.classList.remove('linked-card-highlight'), 1600);
      }
      return;
    }

    if (openTeamId) {
      event.preventDefault();
      const teamSearchInput = document.getElementById('teamSearchInput');
      if (teamSearchInput) teamSearchInput.value = '';
      await loadOverview();
      setActivePage('teamsPage');
      const target = document.querySelector(`[data-team-card="${openTeamId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('linked-card-highlight');
        setTimeout(() => target.classList.remove('linked-card-highlight'), 1600);
      }
      return;
    }

    if (openGameId) {
      event.preventDefault();
      await loadOverview();
      setActivePage('gamesPage');
      const target = document.querySelector(`[data-game-card="${openGameId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('linked-card-highlight');
        setTimeout(() => target.classList.remove('linked-card-highlight'), 1600);
      }
      return;
    }

    if (scoreGameId) {
      await openScorekeeper(scoreGameId);
      return;
    }

    if (teamId) {
      await fetchJson(`/api/teams/${teamId}`, { method: 'DELETE' });
      loadOverview();
      return;
    }

    if (playerId) {
      await fetchJson(`/api/players/${playerId}`, { method: 'DELETE' });
      loadOverview();
      return;
    }

    if (tournamentId) {
      await fetchJson(`/api/tournaments/${tournamentId}`, { method: 'DELETE' });
      loadOverview();
      return;
    }

    if (gameId) {
      await fetchJson(`/api/games/${gameId}`, { method: 'DELETE' });
      if (state.currentScoreGameId === gameId) closeScorekeeper();
      loadOverview();
      return;
    }

    if (editTeamId) {
      const data = await fetchJson('/api/overview');
      const item = data.teams.find((entry) => entry.id === editTeamId);
      if (item) openEditModal('team', item);
      return;
    }

    if (editPlayerId) {
      const data = await fetchJson('/api/overview');
      const item = data.players.find((entry) => entry.id === editPlayerId);
      if (item) openEditModal('player', item);
      return;
    }

    if (editTournamentId) {
      const data = await fetchJson('/api/overview');
      const item = data.tournaments.find((entry) => entry.id === editTournamentId);
      if (item) openEditModal('tournament', item);
      return;
    }

    if (editGameId) {
      const data = await fetchJson('/api/overview');
      const item = data.games.find((entry) => entry.id === editGameId);
      if (item) openEditModal('game', item);
      return;
    }

  });

  ['teamSearchInput', 'playerSearchInput', 'tournamentSearchInput']
    .forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.addEventListener('input', async () => { await loadOverview(); });
      if (node) node.addEventListener('change', async () => { await loadOverview(); });
    });
}
