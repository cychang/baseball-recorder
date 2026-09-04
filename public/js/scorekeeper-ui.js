import { formatBases, getHalfLabel, getPlayerName, getTeamName } from './data-helpers.js';
import { ui } from './dom.js';
import { renderLineupEditor, setLineupExpanded } from './lineup.js';
import { state } from './state.js';
import {
  BASE_LABELS,
  formatPlayChange,
  getAdvancedDestination,
  getAutomaticPlayAction,
  getDefaultRunnerDestinations,
  getFielderPositionLabel,
  getResultLabel,
  getRunnerSources,
  getStatusLabel,
  hasOccupiedBase,
  requiresFielderPosition,
  requiresOccupiedBaseForResult,
  summarizeRunnerDestinations,
} from './scoring-rules.js';
import { escapeHtml } from './utils.js';

export function renderTraditionalScoreboard(game, summary = {}, context = {}) {
  const maxSummaryInning = Math.max(0, ...(summary.innings || []).map((entry) => Number(entry.inning || 0)));
  const maxInning = game.status === 'completed'
    ? Math.max(1, maxSummaryInning)
    : Math.max(1, maxSummaryInning, Number(context.inning || 1));
  const innings = Array.from({ length: maxInning }, (_, index) => index + 1);
  const inningCells = (half) => innings.map((inning) => {
    const row = (summary.innings || []).find((entry) => Number(entry.inning) === inning) || {};
    return `<div class="scoreboard-cell">${Number(row[half] || 0)}</div>`;
  }).join('');

  ui.lineScoreTable.innerHTML = `
    <div class="scorekeeper-line-score line-score-grid" style="--inning-count: ${innings.length};" aria-label="傳統棒球計分板">
      <div class="scoreboard-cell scoreboard-corner">隊伍</div>
      ${innings.map((inning) => `<div class="scoreboard-cell scoreboard-heading">${inning}</div>`).join('')}
      <div class="scoreboard-cell scoreboard-heading scoreboard-r-heading">R</div>
      <div class="scoreboard-cell scoreboard-heading">H</div>
      <div class="scoreboard-cell scoreboard-heading">E</div>
      <div class="scoreboard-cell scoreboard-team">${escapeHtml(getTeamName(game.awayTeamId))}</div>
      ${inningCells('top')}
      <strong class="scoreboard-cell scoreboard-run-total">${Number(summary.awayRuns || 0)}</strong>
      <div class="scoreboard-cell">${Number(summary.awayHits || 0)}</div>
      <div class="scoreboard-cell">${Number(summary.awayErrors || 0)}</div>
      <div class="scoreboard-cell scoreboard-team">${escapeHtml(getTeamName(game.homeTeamId))}</div>
      ${inningCells('bottom')}
      <strong class="scoreboard-cell scoreboard-run-total">${Number(summary.homeRuns || 0)}</strong>
      <div class="scoreboard-cell">${Number(summary.homeHits || 0)}</div>
      <div class="scoreboard-cell">${Number(summary.homeErrors || 0)}</div>
    </div>
  `;

  const halfLabel = context.half === 'bottom' ? '下半' : '上半';
  ui.matchupPanel.innerHTML = `
    <strong>${Number(context.inning || 1)} 局 ${halfLabel}</strong>
    <span>打者 ${escapeHtml(getPlayerName(context.batterId) || '尚未排打序')}</span>
    <span>投手 ${escapeHtml(getPlayerName(context.pitcherId) || '尚未選投手')}</span>
    <span>壘上 ${escapeHtml(formatBases(context.bases || {}))}</span>
  `;

  const countLabels = { strike: '好球數', ball: '壞球數', out: '出局數' };
  const countLights = (total, active, kind) => Array.from({ length: total }, (_, index) => {
    const value = index + 1;
    const classes = `count-light ${index < active ? `on ${kind}` : ''}`;
    const previewAttribute = kind === 'out' ? ' data-preview-out-light' : '';
    return `<button class="${classes}" type="button" data-count-kind="${kind}" data-count-value="${value}" aria-label="設定${countLabels[kind]}為${value}"${previewAttribute}></button>`;
  }).join('');
  ui.countPanel.innerHTML = `
    <div class="count-row"><span class="count-label">S</span><span class="count-lights">${countLights(2, Number(context.strikes || 0), 'strike')}</span></div>
    <div class="count-row"><span class="count-label">B</span><span class="count-lights">${countLights(3, Number(context.balls || 0), 'ball')}</span></div>
    <div class="count-row out-row">
      <span class="count-label">O</span>
      <span class="count-lights">${countLights(2, getAbsoluteOuts(), 'out')}</span>
    </div>
  `;

  ui.eventForm.balls.value = Number(context.balls || 0);
  ui.eventForm.strikes.value = Number(context.strikes || 0);
  renderScoreboardPreview();
}

export function setBaseStateBoardValues(bases = {}) {
  state.pendingBases = {
    first: bases.first || '',
    second: bases.second || '',
    third: bases.third || '',
  };
  renderScoreboardPreview();
}

export function getBaseStateBoardValues() {
  return state.pendingBases || state.currentContext?.bases || { first: '', second: '', third: '' };
}

export function getRunnerDestination(sourceKey) {
  if (state.runnerDestinations[sourceKey]) return state.runnerDestinations[sourceKey];
  return sourceKey === 'batter' ? 'batter' : sourceKey;
}

export function getDestinationOccupant(destinations, target, ignoredSourceKey = '') {
  return Object.keys(destinations).find((sourceKey) => sourceKey !== ignoredSourceKey && destinations[sourceKey] === target);
}

export function tryPushRunnerOneBase(destinations, target, movingSourceKey) {
  const pushedSourceKey = getDestinationOccupant(destinations, target, movingSourceKey);
  if (!pushedSourceKey) return true;

  const pushedTarget = getAdvancedDestination(target, 1);
  if (pushedTarget !== 'home' && getDestinationOccupant(destinations, pushedTarget, pushedSourceKey)) return false;

  destinations[pushedSourceKey] = pushedTarget;
  return true;
}

export function moveRunnerToDestination(sourceKey, target) {
  const includeBatter = ui.eventForm.eventType.value === 'PLATE_APPEARANCE';
  const sources = getRunnerSources(state.currentContext || {}, includeBatter);
  if (!sources.some((source) => source.key === sourceKey)) return false;

  const destinations = { ...state.runnerDestinations };
  sources.forEach((source) => {
    if (!destinations[source.key]) destinations[source.key] = source.key === 'batter' ? 'batter' : source.key;
  });

  if (target === 'home' || target === 'out') {
    destinations[sourceKey] = target;
  } else if (['first', 'second', 'third'].includes(target) && !tryPushRunnerOneBase(destinations, target, sourceKey)) {
    renderInteractiveDiamond();
    return false;
  } else {
    destinations[sourceKey] = target;
  }

  state.runnerDestinations = destinations;
  state.selectedRunnerSource = '';
  state.baseStateTouched = true;
  applyRunnerDestinations();
  return true;
}

export function startRunnerPointerDrag(event, chip) {
  const rect = chip.getBoundingClientRect();
  state.runnerDrag = {
    chip,
    sourceKey: chip.dataset.runnerSource,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    moved: false,
    wasSelected: state.selectedRunnerSource === chip.dataset.runnerSource,
  };
  state.selectedRunnerSource = chip.dataset.runnerSource;
  chip.classList.add('selected');
  chip.setPointerCapture?.(event.pointerId);
}

export function moveRunnerPointerDrag(event) {
  if (!state.runnerDrag) return;
  const drag = state.runnerDrag;
  drag.moved = true;
  drag.chip.classList.add('dragging');
  drag.chip.style.position = 'fixed';
  drag.chip.style.left = `${event.clientX - drag.offsetX}px`;
  drag.chip.style.top = `${event.clientY - drag.offsetY}px`;
  drag.chip.style.transform = 'none';
  drag.chip.style.zIndex = '1000';
}

export function finishRunnerPointerDrag(event) {
  const drag = state.runnerDrag;
  if (!drag) return;
  state.runnerDrag = null;

  if (!drag.moved) {
    state.selectedRunnerSource = drag.wasSelected ? '' : drag.sourceKey;
    renderInteractiveDiamond();
    return;
  }
  state.ignoreNextRunnerClick = true;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-runner-target]');
  if (target) {
    moveRunnerToDestination(drag.sourceKey, target.dataset.runnerTarget);
  } else {
    renderInteractiveDiamond();
  }
}

export function selectLeadRunnerForCorrection() {
  const sources = getRunnerSources(state.currentContext || {}, false);
  const sourceToSelect = ['third', 'second', 'first']
    .map((sourceKey) => sources.find((source) => source.key === sourceKey))
    .find(Boolean);
  state.selectedRunnerSource = sourceToSelect?.key || '';
  renderScoreboardPreview();
}

export function applyRunnerDestinations() {
  const includeBatter = ui.eventForm.eventType.value === 'PLATE_APPEARANCE';

  for (const source of getRunnerSources(state.currentContext || {}, includeBatter)) {
    if (!state.runnerDestinations[source.key]) state.runnerDestinations[source.key] = source.key === 'batter' ? 'batter' : source.key;
  }

  const playState = summarizeRunnerDestinations(state.runnerDestinations, state.currentContext || {}, includeBatter);
  setBaseStateBoardValues(playState.bases);
  ui.eventForm.runs.value = String(playState.runs);
  setAbsoluteOuts(Number(state.currentContext?.outsInHalf || 0) + playState.outs);
}

export function getAbsoluteOuts() {
  return Number(state.currentContext?.outsInHalf || 0) + Number(ui.eventForm.outs.value || 0);
}

export function setAbsoluteOuts(targetOuts) {
  state.baseStateTouched = true;
  const currentOuts = Number(state.currentContext?.outsInHalf || 0);
  const absoluteOuts = Math.max(currentOuts, Math.min(3, Number(targetOuts || 0)));
  ui.eventForm.outs.value = String(Math.max(0, absoluteOuts - currentOuts));
  renderOutControls();
}

export function setPitchCount(kind, targetCount) {
  const maxCounts = { ball: 3, strike: 2 };
  const inputName = kind === 'ball' ? 'balls' : 'strikes';
  const maxCount = maxCounts[kind];
  if (!maxCount || !ui.eventForm?.[inputName]) return;
  const nextCount = Math.max(0, Math.min(maxCount, Number(targetCount || 0)));
  ui.eventForm[inputName].value = String(nextCount);
  renderScoreboardPreview();
}

export function handleCountLightClick(light) {
  const kind = light.dataset.countKind;
  const value = Number(light.dataset.countValue || 0);
  if (!kind || !value) return;
  const currentValue = kind === 'out' ? getAbsoluteOuts() : Number(ui.eventForm?.[kind === 'ball' ? 'balls' : 'strikes']?.value || 0);
  const targetValue = currentValue === value ? value - 1 : value;
  if (kind === 'out') setAbsoluteOuts(targetValue);
  else setPitchCount(kind, targetValue);
}

export function renderOutControls() {
  renderScoreboardPreview();
}

export function renderScoreboardPreview() {
  const bases = getBaseStateBoardValues();
  renderInteractiveDiamond(bases);
  ui.countPanel?.querySelectorAll('[data-count-kind]').forEach((light, index) => {
    const kind = light.dataset.countKind;
    const value = Number(light.dataset.countValue || index + 1);
    const activeCount = kind === 'out'
      ? getAbsoluteOuts()
      : Number(ui.eventForm?.[kind === 'ball' ? 'balls' : 'strikes']?.value || 0);
    light.classList.toggle('on', value <= activeCount);
    light.classList.toggle(kind, value <= activeCount);
  });
}

export function renderInteractiveDiamond(bases = getBaseStateBoardValues()) {
  if (!ui.fieldDiamond) return;
  const includeBatter = ui.eventForm?.eventType?.value === 'PLATE_APPEARANCE';
  const sources = getRunnerSources(state.currentContext || {}, includeBatter);
  const baseButton = (baseName) => `
    <button class="base-indicator ${baseName} ${bases[baseName] ? 'occupied' : ''}" type="button" data-base-indicator="${baseName}" data-preview-base-indicator="${baseName}" data-base-drop-target="${baseName}" data-runner-target="${baseName}" aria-label="${BASE_LABELS[baseName]}">
      <span class="base-label">${BASE_LABELS[baseName]}</span>
    </button>
  `;
  const runnerChip = (source) => {
    const destination = getRunnerDestination(source.key);
    const target = ['first', 'second', 'third', 'home', 'out'].includes(destination) ? destination : 'batter';
    const chipLabel = `${source.label.replace('跑者', '')} ${getPlayerName(source.runnerId)}`;
    const selected = state.selectedRunnerSource === source.key ? ' selected' : '';
    return `<button class="runner-chip at-${target}${selected}" type="button" draggable="true" data-runner-chip data-runner-source="${escapeHtml(source.key)}" aria-pressed="${state.selectedRunnerSource === source.key}" aria-label="移動${escapeHtml(chipLabel)}">${escapeHtml(chipLabel)}</button>`;
  };

  ui.fieldDiamond.innerHTML = `
    ${baseButton('second')}
    ${baseButton('third')}
    ${baseButton('first')}
    <button class="diamond-target home-score-target" type="button" data-home-score-target data-runner-target="home">HOME 得分</button>
    <button class="diamond-target out-drop-target" type="button" data-out-drop-target data-runner-target="out">出局</button>
    <div class="batter-zone">打者區</div>
    ${sources.map((source) => runnerChip(source)).join('')}
  `;
  ui.fieldDiamond.classList.toggle('preview', Boolean(state.pendingBases));
  ui.fieldDiamond.classList.toggle('has-selected-runner', Boolean(state.selectedRunnerSource));
}

export function updatePlaySubmitState() {
  const submitButton = ui.eventForm?.querySelector('button[type="submit"]');
  if (!submitButton) return;
  const missingFielderPosition = requiresFielderPosition(ui.eventForm.result.value) && !ui.eventForm.fielderPosition.value;
  const missingRunnerForRunnerEvent = ui.eventForm.eventType.value === 'RUNNER_ADVANCEMENT' && !hasOccupiedBase(state.currentContext || {});
  submitButton.disabled = !state.currentContext?.lineupReady || !ui.eventForm.result.value || missingFielderPosition || missingRunnerForRunnerEvent;
}

export function clearFielderPosition() {
  if (ui.eventForm?.fielderPosition) ui.eventForm.fielderPosition.value = '';
}

export function renderFielderPositionButtons() {
  if (!ui.fielderPositionPanel) return;
  const showPanel = ui.eventForm.eventType.value === 'PLATE_APPEARANCE' && requiresFielderPosition(ui.eventForm.result.value);
  ui.fielderPositionPanel.hidden = !showPanel;
  ui.fielderPositionPanel.querySelectorAll('[data-fielder-position]').forEach((button) => {
    button.classList.toggle('active', showPanel && button.dataset.fielderPosition === ui.eventForm.fielderPosition.value);
  });
}

export function getLatestEventForUndo(events = state.currentEvents) {
  return (events || []).reduce((latest, event) => {
    if (!latest) return event;
    return Number(event.sequence || 0) > Number(latest.sequence || 0) ? event : latest;
  }, null);
}

export function renderResultActionButtons() {
  const selectedResult = ui.eventForm.result.value;
  const readyButton = ui.eventForm.querySelector('[data-ready-action]');
  if (readyButton) {
    readyButton.classList.toggle('active', ui.eventForm.eventType.value === 'PLATE_APPEARANCE' && !selectedResult);
  }
  ui.eventForm.querySelectorAll('[data-result-action]').forEach((button) => {
    button.classList.toggle('active', ui.eventForm.eventType.value === 'PLATE_APPEARANCE' && button.dataset.resultAction === selectedResult);
  });
  document.querySelectorAll('[data-runner-event-action]').forEach((button) => {
    button.classList.toggle('active', ui.eventForm.eventType.value === 'RUNNER_ADVANCEMENT' && button.dataset.runnerEventAction === selectedResult);
  });
  renderFielderPositionButtons();
  updateResultActionAvailability();
  updateRunnerEventActionButtons();
  updatePlaySubmitState();
}

export function updateResultActionAvailability() {
  ui.eventForm.querySelectorAll('[data-result-action]').forEach((button) => {
    button.disabled = requiresOccupiedBaseForResult(button.dataset.resultAction) && !hasOccupiedBase(state.currentContext || {});
  });
}

export function updateRunnerEventActionButtons() {
  document.querySelectorAll('[data-runner-event-action]').forEach((button) => {
    button.disabled = !hasOccupiedBase(state.currentContext || {});
  });
}

export function setReadyPlayState(context = state.currentContext || {}) {
  const form = ui.eventForm;
  form.eventType.value = 'PLATE_APPEARANCE';
  form.result.value = '';
  resetPendingPlaySelection(context);
  renderResultActionButtons();
  renderScoreboardPreview();
  renderOutControls();
}

export function resetPendingPlaySelection(context = state.currentContext || {}) {
  const form = ui.eventForm;
  form.runs.value = '0';
  form.outs.value = '0';
  form.balls.value = Number(context.balls || 0);
  form.strikes.value = Number(context.strikes || 0);
  clearFielderPosition();
  state.baseStateTouched = false;
  state.runnerDestinations = {};
  state.selectedRunnerSource = '';
  state.pendingBases = null;
}

export function applyDefaultPlaySelection() {
  if (!state.currentContext?.lineupReady) return;
  const form = ui.eventForm;
  const result = form.result.value;
  const action = getAutomaticPlayAction(result, state.currentContext || {}, form.eventType.value);

  if (!action) {
    renderResultActionButtons();
    renderInteractiveDiamond();
    renderOutControls();
    return;
  }

  if (!state.baseStateTouched) {
    state.runnerDestinations = getDefaultRunnerDestinations(result, state.currentContext || {}, form.eventType.value);
    applyRunnerDestinations();
    if (form.eventType.value === 'PLATE_APPEARANCE') {
      form.balls.value = 0;
      form.strikes.value = 0;
    }
    state.baseStateTouched = false;
  }

  renderResultActionButtons();
  renderInteractiveDiamond();
  renderOutControls();
}

export function renderBaseStateBoard(context = {}) {
  setReadyPlayState(context);
}

export function renderScorekeeper(data) {
  const game = data.game;
  const events = data.events || [];
  const summary = data.summary || {};
  const homeName = getTeamName(game.homeTeamId);
  const awayName = getTeamName(game.awayTeamId);
  const context = data.context || {};
  state.currentLineups = data.lineups || {};
  state.currentContext = context;
  state.currentEvents = events;
  if (!context.lineupReady) state.lineupExpanded = true;

  ui.scorekeeperTitle.textContent = `${homeName} vs ${awayName}`;
  ui.scorekeeperMeta.textContent = `${game.date || '未定日期'} / ${game.venue || '未定場地'} / ${getStatusLabel(game.status)}`;
  if (ui.finishGameBtn) ui.finishGameBtn.disabled = game.status === 'completed';
  renderTraditionalScoreboard(game, summary, context);
  renderLineupEditor(game, state.currentLineups);
  setLineupExpanded(state.lineupExpanded);
  renderBaseStateBoard(context);
  updatePlaySubmitState();
  if (ui.undoLastEventBtn) ui.undoLastEventBtn.disabled = events.length === 0;

  ui.eventTimeline.innerHTML = events.length > 0 ? events.slice().reverse().map((event) => {
    const batter = event.batterId ? ` / 打者 ${escapeHtml(getPlayerName(event.batterId))}` : '';
    const pitcher = event.pitcherId ? ` / 投手 ${escapeHtml(getPlayerName(event.pitcherId))}` : '';
    const bases = event.bases ? ` / 壘上 ${escapeHtml(formatBases(event.bases))}` : '';
    const fielderPosition = event.fielderPosition ? ` 守備 ${getFielderPositionLabel(event.fielderPosition)}` : '';
    const count = event.eventType === 'PITCH' ? `B-S ${event.balls || 0}-${event.strikes || 0}` : '';
    const playChange = event.eventType === 'PITCH' ? '' : `${escapeHtml(formatPlayChange(event.runs, event.outs))}`;
    const countDetail = playChange && count ? ` / ${count}` : '';
    const eventDetail = `${playChange || count}${countDetail}${batter}${pitcher}${bases}`;
    const notes = event.notes ? `<div style="margin-top: 4px; color: var(--muted);">${escapeHtml(event.notes)}</div>` : '';
    return `
      <div class="event-row">
        <div class="event-seq">#${event.sequence}</div>
        <div>
          <strong>${event.inning}${getHalfLabel(event.half)} ${escapeHtml(getResultLabel(event.result || event.eventType))}${fielderPosition}</strong>
          <div style="margin-top: 4px; color: var(--muted);">${eventDetail}</div>
          ${notes}
        </div>
      </div>
    `;
  }).join('') : '<div class="mini-card">尚未記錄事件</div>';
}
