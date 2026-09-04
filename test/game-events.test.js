import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseball-recorder-'));
process.env.BASEBALL_DB_PATH = path.join(tempDir, 'baseball.db');

const { app, db } = await import(`../server.js?test=${Date.now()}`);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

function readPublicAsset(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', 'public', ...segments), 'utf8');
}

function readIndexHtml() {
  return readPublicAsset('index.html');
}

function readClientSource() {
  const scriptSources = fs.readdirSync(path.join(__dirname, '..', 'public', 'js'))
    .filter((filename) => filename.endsWith('.js'))
    .sort()
    .map((filename) => readPublicAsset('js', filename));
  return [
    readPublicAsset('index.html'),
    readPublicAsset('styles.css'),
    ...scriptSources,
  ].join('\n');
}

async function importClientRenderer() {
  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  try {
    return await import(`../public/js/render-management.js?test=${Date.now()}`);
  } finally {
    globalThis.document = originalDocument;
  }
}

async function importScoringRules() {
  return import(`../public/js/scoring-rules.js?test=${Date.now()}`);
}

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

test('config exposes event and tournament enums used by the UI', async () => {
  const response = await request('/api/config');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.enums.halfInning, ['top', 'bottom']);
  assert.ok(response.body.enums.eventType.includes('PLATE_APPEARANCE'));
  assert.deepEqual(response.body.enums.gameStatus, ['not_started', 'live', 'completed', 'cancelled']);
  assert.equal(response.body.enums.gameStatus.includes('scheduled'), false);
  assert.equal(response.body.enums.playResult.includes('OTHER'), false);
});

test('defaults to games tab and hides settings from the main nav', () => {
  const indexHtml = readIndexHtml();
  const html = readClientSource();
  const scorekeeperNav = html.indexOf('data-target="scorekeeperPage">紀錄');
  const teamsNav = html.indexOf('data-target="teamsPage">球隊');
  const gamesNav = html.indexOf('data-target="gamesPage">比賽');
  const settingsNav = html.indexOf('data-target="settingsPage">資料設定');
  const scorekeeperPage = html.indexOf('<section id="scorekeeperPage" class="page">');
  const gamesPage = html.indexOf('<section id="gamesPage" class="page active">');

  assert.ok(indexHtml.includes('<link rel="stylesheet" href="/styles.css" />'));
  assert.ok(indexHtml.includes('<script type="module" src="/js/app.js"></script>'));
  assert.equal(indexHtml.includes('<style>'), false);
  assert.equal(indexHtml.includes('<script>\n'), false);
  assert.equal(html.includes('id="globalSearchInput"'), false);
  assert.ok(scorekeeperNav > -1);
  assert.ok(teamsNav > -1);
  assert.ok(gamesNav > -1);
  assert.equal(settingsNav, -1);
  assert.ok(html.includes('<section id="settingsPage" class="page">'));
  assert.equal(html.includes('data-target="overviewPage">總覽'), false);
  assert.equal(html.includes('<section id="overviewPage"'), false);
  assert.ok(teamsNav < gamesNav);
  assert.ok(gamesNav < scorekeeperNav);
  assert.ok(scorekeeperPage > -1);
  assert.ok(gamesPage > -1);
  assert.ok(scorekeeperPage < gamesPage);
  assert.ok(html.includes('id="lineupForm"'));
  assert.ok(html.includes('id="toggleLineupBtn"'));
  assert.ok(html.includes('aria-controls="lineupBody"'));
  assert.ok(html.includes('id="lineupBody" class="lineup-body" hidden'));
  assert.ok(html.includes('Order / 換人'));
  assert.ok(html.includes('id="traditionalScoreboard"'));
  assert.ok(html.includes('id="scorekeeperSelector"'));
  const lineupForm = html.indexOf('id="lineupForm"');
  const traditionalScoreboard = html.indexOf('id="traditionalScoreboard"');
  const eventForm = html.indexOf('id="eventForm"');
  assert.ok(lineupForm > -1);
  assert.ok(traditionalScoreboard > -1);
  assert.ok(eventForm > -1);
  assert.ok(traditionalScoreboard < eventForm);
  assert.ok(eventForm < lineupForm);
  assert.ok(html.includes('id="fieldDiamond"'));
  assert.ok(html.includes('id="countPanel"'));
  assert.equal(html.includes('id="scoreboardActionPanel"'), false);
  assert.ok(html.includes('data-preview-base-indicator="first"'));
  assert.ok(html.includes('data-preview-out-light'));
  assert.equal(html.includes('id="baseStateBoard"'), false);
  assert.equal(html.includes('id="playActionPanel"'), false);
  assert.ok(html.includes('data-pitch-action="BALL"'));
  assert.ok(html.includes('data-pitch-action="CALLED_STRIKE"'));
  assert.ok(html.includes('data-pitch-action="SWINGING_STRIKE"'));
  assert.ok(html.includes('data-pitch-action="FOUL"'));
  const readyAction = html.indexOf('data-ready-action');
  const singleAction = html.indexOf('data-result-action="SINGLE"');
  assert.ok(readyAction > -1);
  assert.ok(singleAction > -1);
  assert.ok(readyAction < singleAction);
  assert.ok(html.includes('data-result-action="SINGLE"'));
  assert.ok(html.includes('data-result-action="STRIKEOUT"'));
  assert.ok(html.includes('data-result-action="DROPPED_THIRD_STRIKE"'));
  assert.ok(html.includes('data-result-action="DOUBLE_PLAY"'));
  assert.ok(html.includes('name="fielderPosition" type="hidden" value=""'));
  assert.ok(html.includes('id="fielderPositionPanel"'));
  assert.ok(html.includes('data-fielder-position="P"'));
  assert.ok(html.includes('data-fielder-position="C"'));
  assert.ok(html.includes('data-fielder-position="1B"'));
  assert.ok(html.includes('data-fielder-position="2B"'));
  assert.ok(html.includes('data-fielder-position="3B"'));
  assert.ok(html.includes('data-fielder-position="SS"'));
  assert.ok(html.includes('data-fielder-position="LF"'));
  assert.ok(html.includes('data-fielder-position="CF"'));
  assert.ok(html.includes('data-fielder-position="RF"'));
  assert.equal(html.includes('data-result-action="OTHER"'), false);
  assert.equal(html.includes('>其他</button>'), false);
  assert.equal(html.includes('id="runnerActionBoard"'), false);
  assert.ok(html.includes('data-base-drop-target="first"'));
  assert.ok(html.includes('data-base-drop-target="second"'));
  assert.ok(html.includes('data-base-drop-target="third"'));
  assert.ok(html.includes('data-home-score-target'));
  assert.ok(html.includes('data-out-drop-target'));
  assert.ok(html.includes('data-runner-chip'));
  assert.equal(html.includes('id="playRunBadge"'), false);
  assert.ok(html.includes('HOME 得分'));
  assert.equal(html.includes('得分 +0'), false);
  assert.equal(html.includes('本 play'), false);
  assert.equal(html.includes('data-runs-action="decrement"'), false);
  assert.equal(html.includes('data-runs-action="increment"'), false);
  assert.equal(html.includes('減少得分'), false);
  assert.equal(html.includes('增加得分'), false);
  assert.equal(html.includes('data-outs-action="decrement"'), false);
  assert.equal(html.includes('data-outs-action="increment"'), false);
  assert.equal(html.includes('減少出局數'), false);
  assert.equal(html.includes('增加出局數'), false);
  assert.ok(html.includes('data-count-kind="${kind}"'));
  assert.ok(html.includes('data-count-value="${value}"'));
  assert.ok(html.includes("countLights(2, Number(context.strikes || 0), 'strike')"));
  assert.ok(html.includes("countLights(3, Number(context.balls || 0), 'ball')"));
  assert.ok(html.includes("countLights(2, getAbsoluteOuts(), 'out')"));
  assert.ok(html.includes('aria-label="設定'));
  assert.ok(html.includes('function setPitchCount'));
  assert.ok(html.includes('function handleCountLightClick'));
  assert.ok(html.includes('ui.countPanel.addEventListener'));
  assert.equal(html.includes('ui.scoreboardActionPanel.addEventListener'), false);
  assert.equal(html.includes('id="outAdjustmentBoard"'), false);
  assert.equal(html.includes('out-adjustment-board'), false);
  assert.ok(html.includes('name="balls"'));
  assert.ok(html.includes('name="strikes"'));
  assert.ok(html.includes('name="eventType" type="hidden"'));
  assert.ok(html.includes('name="result" type="hidden" value=""'));
  assert.ok(html.includes('name="runs" type="hidden"'));
  assert.ok(html.includes('name="outs" type="hidden"'));
  assert.ok(html.includes('class="play-event-panel"'));
  assert.ok(html.includes('class="pitch-panel"'));
  assert.ok(html.includes('class="event-submit tiny-btn"'));
  assert.ok(html.includes('class="event-submit-bar"'));
  assert.equal(html.includes('class="event-notes"'), false);
  assert.equal(html.includes('placeholder="事件註記"'), false);
  assert.equal(html.includes('name="notes"'), false);
  assert.equal(html.includes('event-submit-row'), false);
  const playEventPanel = html.indexOf('class="play-event-panel"');
  const resultActions = html.indexOf('class="result-actions"');
  const runnerActions = html.indexOf('class="runner-event-actions"');
  const eventSubmit = html.indexOf('class="event-submit tiny-btn"');
  const pitchPanel = html.indexOf('class="pitch-panel"');
  assert.ok(playEventPanel > -1);
  assert.ok(resultActions > -1);
  assert.ok(runnerActions > -1);
  assert.ok(eventSubmit > -1);
  assert.ok(pitchPanel > -1);
  assert.ok(eventForm < pitchPanel);
  assert.ok(pitchPanel < playEventPanel);
  assert.ok(playEventPanel < eventSubmit);
  assert.ok(eventSubmit < runnerActions);
  assert.ok(runnerActions < resultActions);
  const strikeLabel = html.indexOf('<span class="count-label">S</span>');
  const ballLabel = html.indexOf('<span class="count-label">B</span>');
  const outLabel = html.indexOf('<span class="count-label">O</span>');
  assert.ok(strikeLabel > -1);
  assert.ok(ballLabel > -1);
  assert.ok(outLabel > -1);
  assert.ok(strikeLabel < ballLabel);
  assert.ok(ballLabel < outLabel);
  assert.equal(html.includes('select name="result"'), false);
  assert.equal(html.includes('select name="eventType"'), false);
  assert.equal(html.includes('type="number" min="0" max="4" value="0" placeholder="得分"'), false);
  assert.equal(html.includes('type="number" min="0" max="3" value="0" placeholder="出局數"'), false);
  assert.equal(html.includes('data-lineup-pitcher'), false);
  assert.equal(html.includes('選擇先發投手'), false);
  assert.equal(html.includes('name="inning"'), false);
  assert.equal(html.includes('name="half"'), false);
  assert.equal(html.includes('name="batterId"'), false);
  assert.equal(html.includes('name="pitcherId"'), false);
  assert.equal(html.includes('id="currentSituation"'), false);
  assert.equal(html.includes('打者 ID'), false);
  assert.equal(html.includes('投手 ID'), false);
});

test('shows rule-driven play actions for hits and walks in the UI', () => {
  const html = readClientSource();

  assert.ok(html.includes('function getAutomaticPlayAction'));
  assert.ok(html.includes('function applyDefaultPlaySelection'));
  assert.ok(html.includes('function resetPendingPlaySelection'));
  assert.ok(html.includes('function setReadyPlayState'));
  assert.ok(html.includes('function renderScoreboardPreview'));
  assert.ok(html.includes("result === 'SINGLE'"));
  assert.ok(html.includes('!form.result.value'));
  assert.ok(html.includes('data-ready-action'));
  assert.equal(html.includes('確認一壘安打'), false);
  assert.equal(html.includes('套用建議跑壘'), false);
  assert.ok(html.includes('play-event-panel'));
  assert.ok(html.includes('pitch-panel'));
  assert.ok(html.includes('function renderInteractiveDiamond'));
  assert.ok(html.includes('function moveRunnerToDestination'));
  assert.ok(html.includes('function tryPushRunnerOneBase'));
  assert.equal(html.includes('function adjustPlayRuns'), false);
  assert.equal(html.includes('function renderRunControls'), false);
  assert.ok(html.includes('function applyRunnerDestinations'));
  assert.ok(html.includes('function requiresFielderPosition'));
  assert.ok(html.includes('function renderFielderPositionButtons'));
  assert.ok(html.includes('function clearFielderPosition'));
  assert.ok(html.includes('payload.fielderPosition = form.fielderPosition.value'));
  assert.ok(html.includes('守備 ${getFielderPositionLabel(event.fielderPosition)}'));
  assert.ok(html.includes('function hasOccupiedBase'));
  assert.ok(html.includes('function updateRunnerEventActionButtons'));
  assert.ok(html.includes('function requiresOccupiedBaseForResult'));
  assert.ok(html.includes('function updateResultActionAvailability'));
  assert.ok(html.includes('button.disabled = requiresOccupiedBaseForResult(button.dataset.resultAction) && !hasOccupiedBase(state.currentContext || {})'));
  assert.ok(html.includes('button.disabled = !hasOccupiedBase(state.currentContext || {})'));
  assert.ok(html.includes('function startRunnerPointerDrag'));
  assert.ok(html.includes('function moveRunnerPointerDrag'));
  assert.ok(html.includes('function finishRunnerPointerDrag'));
  assert.ok(html.includes('function selectLeadRunnerForCorrection'));
  assert.ok(html.includes("const sourceToSelect = ['third', 'second', 'first']"));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointerdown'"));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointermove'"));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointerup'"));
  assert.ok(html.includes('document.elementFromPoint(event.clientX, event.clientY)'));
  assert.ok(html.includes('touch-action: none'));
  assert.ok(html.includes('base-label'));
  assert.ok(html.includes('has-selected-runner'));
  assert.ok(html.includes('draggable="true"'));
  assert.ok(html.includes("sourceKey === 'batter'"));
  assert.ok(html.includes("target === 'home'"));
  assert.ok(html.includes("target === 'out'"));
  assert.equal(html.includes('runner-diamond-choice'), false);
  assert.ok(html.includes('data-runner-event-action="WILD_PITCH"'));
  assert.ok(html.includes('data-runner-event-action="BALK"'));
  assert.ok(html.includes('data-runner-event-action="STOLEN_BASE"'));
  assert.ok(html.includes('data-runner-event-action="PICKOFF"'));
  assert.ok(html.includes('壘上事件'));
  assert.ok(html.includes('不需送出'));
  assert.ok(html.includes('data-result-action="ERROR">失誤</button>'));
  assert.equal(html.includes('失誤上壘'), false);
  assert.ok(html.includes('async function submitCurrentPlay'));
  assert.ok(html.includes('requiresFielderPosition(form.result.value) && !form.fielderPosition.value'));
  assert.ok(html.includes('const isSwitchingPendingPlay'));
  assert.ok(html.includes('resetPendingPlaySelection();'));
  assert.ok(html.includes('const hasManualRunnerEdit = state.baseStateTouched && !isSwitchingPendingPlay'));
  assert.ok(html.includes("const requiresManualRunnerSubmit = ['WILD_PITCH', 'STOLEN_BASE', 'PICKOFF'].includes(runnerEventAction)"));
  assert.match(html, /if \(runnerEventAction\)[\s\S]+if \(!hasManualRunnerEdit\)[\s\S]+applyDefaultPlaySelection\(\)/);
  assert.match(html, /if \(runnerEventAction\)[\s\S]+if \(requiresManualRunnerSubmit\)[\s\S]+return;/);
  assert.match(html, /if \(requiresManualRunnerSubmit\)[\s\S]+selectLeadRunnerForCorrection\(\)[\s\S]+updatePlaySubmitState\(\)/);
  assert.match(html, /if \(runnerEventAction\)[\s\S]+await submitCurrentPlay\(\)/);
  assert.ok(html.includes('includeBatter'));
  assert.ok(html.includes('function setAbsoluteOuts'));
  assert.equal(html.includes('data-out-adjust="1"'), false);
  assert.equal(html.includes('data-out-adjust="-1"'), false);
  assert.ok(html.includes('isBallFour'));
  assert.ok(html.includes("result: isBallFour ? 'WALK' : undefined"));
  assert.ok(html.includes("notes: isBallFour ? '保送上一壘' : next.notes"));
});

test('only exposes one-step undo for the latest play in the UI', () => {
  const html = readClientSource();

  assert.ok(html.includes('data-undo-last-event'));
  assert.ok(html.includes('退回上一筆'));
  assert.ok(html.includes('function getLatestEventForUndo'));
  assert.ok(html.includes('Number(event.sequence || 0) > Number(latest.sequence || 0)'));
  assert.ok(html.includes('const latestEvent = getLatestEventForUndo()'));
  assert.equal(html.includes('state.currentEvents[state.currentEvents.length - 1]'), false);
  assert.equal(html.includes('data-delete-event'), false);
});

test('keeps player stats read-only and derived from play events in the UI', () => {
  const html = readClientSource();

  assert.ok(html.includes('成績會由紀錄自動累加，不在球員資料手動輸入。'));
  assert.equal(html.includes('name="battingAverage"'), false);
  assert.equal(html.includes('name="ops"'), false);
  assert.equal(html.includes('name="hr"'), false);
  assert.equal(html.includes('name="sb"'), false);
});

test('keeps management tabs list-first and opens create forms in a modal', () => {
  const indexHtml = readIndexHtml();
  const sections = [
    { id: 'playersPage', listTitle: '球員列表', createType: 'player', removedFormId: 'playerForm' },
    { id: 'tournamentsPage', listTitle: '盃賽列表', createType: 'tournament', removedFormId: 'tournamentForm' },
  ];

  for (const section of sections) {
    const start = indexHtml.indexOf(`<section id="${section.id}"`);
    const end = indexHtml.indexOf('</section>', start);
    const sectionHtml = indexHtml.slice(start, end);

    assert.ok(start > -1);
    assert.ok(sectionHtml.includes(section.listTitle));
    assert.ok(sectionHtml.includes(`data-create="${section.createType}"`));
    assert.equal(sectionHtml.includes(`id="${section.removedFormId}"`), false);
    assert.equal(sectionHtml.includes('動作</h2>'), false);
  }
});

test('keeps games tab compact with match details and right-side actions', () => {
  const html = readClientSource();
  const indexHtml = readIndexHtml();
  const managementSource = readPublicAsset('js', 'render-management.js');
  const eventHandlerSource = readPublicAsset('js', 'event-handlers.js');
  const start = indexHtml.indexOf('<section id="gamesPage"');
  const end = indexHtml.indexOf('</section>', start);
  const gamesSectionHtml = indexHtml.slice(start, end);

  assert.ok(start > -1);
  assert.ok(gamesSectionHtml.includes('比賽列表'));
  assert.ok(gamesSectionHtml.includes('data-create="game"'));
  assert.ok(gamesSectionHtml.includes('id="gamesListDetail"'));
  assert.equal(gamesSectionHtml.includes('id="gameSearchInput"'), false);
  assert.equal(gamesSectionHtml.includes('id="gameStatusFilter"'), false);
  assert.equal(gamesSectionHtml.includes('比賽動作'), false);
  assert.equal(gamesSectionHtml.includes('比賽建立後回到列表'), false);
  assert.equal((gamesSectionHtml.match(/data-create="game"/g) || []).length, 1);
  assert.ok(html.includes('class="mini-card game-card"'));
  assert.ok(html.includes('class="game-main"'));
  assert.ok(html.includes('class="game-actions"'));
  assert.ok(html.includes('data-card-actions-menu'));
  assert.ok(html.includes("renderCardActions('game-actions-row'"));
  assert.ok(html.includes('class="game-meta"'));
  assert.ok(html.includes('name="time" type="time"'));
  assert.ok(html.includes("const gameDateTime = [game.date || '未定日期', game.time || '未定時間'].join(' ');"));
  assert.ok(html.includes("const statusKey = String(game.status || 'not_started').replace(/[^a-z_]/g, '');"));
  assert.ok(html.includes('class="game-header"'));
  assert.ok(html.includes('class="game-matchup"'));
  assert.ok(html.includes('class="game-status status-${statusKey}"'));
  assert.ok(html.includes('.game-status.status-live'));
  assert.ok(html.includes('.game-status.status-completed'));
  assert.ok(html.includes('.game-card { align-items: start; }'));
  assert.ok(html.includes('.game-actions { align-self: start; align-items: flex-start; }'));
  assert.ok(html.includes('盃賽'));
  assert.ok(html.includes('class="game-scoreboard line-score-grid"'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-team"'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-heading"'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-heading scoreboard-r-heading">R</div>'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-heading">H</div>'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-heading">E</div>'));
  assert.ok(html.includes('getGameScoreboardInnings(game)'));
  assert.ok(html.includes('class="scoreboard-cell scoreboard-run-total"'));
  assert.equal(managementSource.includes('Math.max(9'), false);
  assert.equal(managementSource.includes('終場 ${escapeHtml(score)}'), false);
  assert.equal(managementSource.includes('class="game-score final-score"'), false);
  assert.equal(managementSource.includes('inning-score-cells'), false);
  assert.ok(managementSource.includes('--inning-count: ${innings.length};'));
  assert.ok(managementSource.includes('shouldRenderGameLineScore(game)'));
  assert.ok(eventHandlerSource.includes("event.target.closest('[data-score-game]')?.getAttribute('data-score-game')"));
  assert.ok(html.includes('grid-template-columns: minmax(92px, 1.25fr)'));
  assert.ok(html.includes('width: max-content'));
  assert.ok(html.includes('.scoreboard-r-heading { color: #0b1118; background: var(--accent-2); }'));
  assert.ok(html.includes('.scoreboard-run-total { color: #0b1118; background: var(--accent-2);'));
  assert.ok(html.includes('border: 1px solid rgba(148,163,184,0.28); background: rgba(4,12,18,0.38);'));
  assert.equal(html.includes('class="game-event-count"'), false);
  assert.equal(html.includes('事件 ${eventCount}'), false);
});

test('uses current inning when rendering live game line scores', async () => {
  const {
    getGameScoreboardInnings,
    shouldRenderGameLineScore,
  } = await importClientRenderer();

  assert.deepEqual(getGameScoreboardInnings({
    status: 'live',
    eventCount: 6,
    currentInning: 2,
    innings: [{ inning: 1, top: 0, bottom: 0 }],
  }), [1, 2]);
  assert.equal(shouldRenderGameLineScore({
    status: 'live',
    eventCount: 6,
    currentInning: 2,
    innings: [{ inning: 1, top: 0, bottom: 0 }],
  }), true);
  assert.equal(shouldRenderGameLineScore({
    status: 'not_started',
    eventCount: 0,
    currentInning: 1,
    innings: [],
  }), false);
  assert.equal(shouldRenderGameLineScore({
    status: 'completed',
    eventCount: 0,
    currentInning: 1,
    innings: [],
  }), true);
  assert.deepEqual(getGameScoreboardInnings({
    status: 'completed',
    eventCount: 36,
    currentInning: 7,
    innings: [
      { inning: 1, top: 0, bottom: 0 },
      { inning: 2, top: 0, bottom: 0 },
      { inning: 3, top: 0, bottom: 0 },
      { inning: 4, top: 0, bottom: 0 },
      { inning: 5, top: 0, bottom: 0 },
      { inning: 6, top: 0, bottom: 0 },
    ],
  }), [1, 2, 3, 4, 5, 6]);
});

test('scorekeeper exposes a finish game action', () => {
  const html = readIndexHtml();
  const domSource = readPublicAsset('js', 'dom.js');
  const handlersSource = readPublicAsset('js', 'event-handlers.js');

  assert.ok(html.includes('id="finishGameBtn"'));
  assert.ok(html.includes('data-finish-game'));
  assert.ok(html.includes('比賽結束'));
  assert.ok(domSource.includes('finishGameBtn: document.getElementById(\'finishGameBtn\')'));
  assert.ok(handlersSource.includes("event.target.closest('[data-finish-game]')"));
  assert.ok(handlersSource.includes("body: JSON.stringify({ status: 'completed' })"));
  assert.ok(handlersSource.includes('await openScorekeeper(state.currentScoreGameId);'));
});

test('keeps team and player cards compact with right-side actions', () => {
  const html = readClientSource();
  const indexHtml = readIndexHtml();
  const teamsStart = indexHtml.indexOf('<section id="teamsPage"');
  const playersStart = indexHtml.indexOf('<section id="playersPage"');
  const tournamentsStart = indexHtml.indexOf('<section id="tournamentsPage"');
  const teamsSectionHtml = indexHtml.slice(teamsStart, playersStart);

  assert.ok(teamsStart > -1);
  assert.ok(playersStart > teamsStart);
  assert.equal(teamsSectionHtml.includes('球隊動作'), false);
  assert.equal(teamsSectionHtml.includes('列表是主要工作區'), false);
  assert.equal((teamsSectionHtml.match(/data-create="team"/g) || []).length, 1);
  assert.ok(tournamentsStart > playersStart);
  assert.ok(html.includes('class="mini-card team-card"'));
  assert.ok(html.includes('class="team-title-line"'));
  assert.ok(html.includes('class="team-actions"'));
  assert.ok(html.includes("renderCardActions('team-actions-row'"));
  assert.ok(html.includes('球員 ${teamPlayers}'));
  assert.ok(html.includes('data-team-card="${team.id}"'));
  assert.ok(html.includes('class="team-tournament-links"'));
  assert.ok(html.includes('<a class="link-chip tournament-link" href="#tournamentsPage"'));
  assert.ok(html.includes('data-open-tournament="${tournamentId}"'));
  assert.equal(html.includes('參加盃賽'), false);
  assert.ok(html.includes('class="mini-card player-card"'));
  assert.ok(html.includes('class="player-main"'));
  assert.ok(html.includes('class="player-actions"'));
  assert.ok(html.includes("renderCardActions('player-actions-row'"));
  assert.ok(html.includes('.player-card { grid-template-columns: 1fr; align-items: start; padding-right: 16px; }'));
  assert.ok(html.includes('.player-heading-line { padding-right: 150px; }'));
  assert.ok(html.includes('.player-actions { position: absolute; top: 14px; right: 14px;'));
  assert.ok(html.includes('class="player-name-line"'));
  assert.ok(html.includes('class="player-team-links"'));
  assert.ok(html.includes('<a class="link-chip player-team-link" href="#teamsPage"'));
  assert.ok(html.includes('data-open-team="${team.id}"'));
  assert.ok(html.includes('class="player-stat-lines"'));
  assert.ok(html.includes('function renderPlayerStatTable(label, columns, className)'));
  assert.ok(html.includes('class="player-stat-table ${className}"'));
  assert.ok(html.includes('class="player-stat-grid" style="--stat-count: ${columns.length};"'));
  assert.ok(html.includes('grid-template-columns: 42px minmax(0, 1fr)'));
  assert.ok(html.includes('grid-template-columns: repeat(var(--stat-count), minmax(40px, 1fr))'));
  assert.ok(html.includes("renderPlayerStatTable('打者', battingStats, 'batting-stat-table')"));
  assert.ok(html.includes("renderPlayerStatTable('投手', pitchingStats, 'pitching-stat-table')"));
  assert.ok(html.includes("['G', player.gamesPlayed || 0]"));
  assert.ok(html.includes("['PA', player.plateAppearances || 0]"));
  assert.ok(html.includes("['AB', player.atBats || 0]"));
  assert.ok(html.includes("['2B', player.doubles || 0]"));
  assert.ok(html.includes("['3B', player.triples || 0]"));
  assert.ok(html.includes("['BB', player.walks || 0]"));
  assert.ok(html.includes("['SO', player.strikeouts || 0]"));
  assert.ok(html.includes("['OBP', formatStat(player.onBasePercentage)]"));
  assert.ok(html.includes("['SLG', formatStat(player.sluggingPercentage)]"));
  assert.ok(html.includes("['AVG', formatStat(player.battingAverage)]"));
  assert.ok(html.includes("['W', player.pitchingWins || 0]"));
  assert.ok(html.includes("['L', player.pitchingLosses || 0]"));
  assert.ok(html.includes("['SV', player.saves || 0]"));
  assert.ok(html.includes("['ERA', formatStat(player.earnedRunAverage)]"));
  assert.equal(html.includes("['2B', player.doublesAllowed || 0]"), false);
  assert.equal(html.includes("['3B', player.triplesAllowed || 0]"), false);
  assert.equal(html.includes("['AVG', formatStat(player.battingAverageAgainst)]"), false);
  assert.equal(html.includes('class="stat-line batting-stat-line"'), false);
  assert.equal(html.includes('class="stat-line pitching-stat-line"'), false);
  assert.equal(html.includes('G ${player.gamesPlayed || 0}'), false);
  const battingColumnOrder = [
    "['G', player.gamesPlayed || 0]",
    "['PA', player.plateAppearances || 0]",
    "['AB', player.atBats || 0]",
    "['H', player.hits || 0]",
    "['2B', player.doubles || 0]",
    "['3B', player.triples || 0]",
    "['HR', player.hr || 0]",
    "['BB', player.walks || 0]",
    "['SO', player.strikeouts || 0]",
    "['RBI', player.rbi || 0]",
    "['R', player.runsScored || 0]",
    "['OBP', formatStat(player.onBasePercentage)]",
    "['SLG', formatStat(player.sluggingPercentage)]",
    "['AVG', formatStat(player.battingAverage)]",
  ];
  const pitchingColumnOrder = [
    "['W', player.pitchingWins || 0]",
    "['L', player.pitchingLosses || 0]",
    "['SV', player.saves || 0]",
    "['G', player.pitchingGames || 0]",
    "['IP', player.inningsPitched || '0']",
    "['AB', player.atBatsAgainst || 0]",
    "['H', player.hitsAllowed || 0]",
    "['HR', player.homeRunsAllowed || 0]",
    "['BB', player.walksAllowed || 0]",
    "['SO', player.strikeoutsThrown || 0]",
    "['R', player.runsAllowed || 0]",
    "['ER', player.earnedRunsAllowed || 0]",
    "['ERA', formatStat(player.earnedRunAverage)]",
  ];
  for (let index = 1; index < battingColumnOrder.length; index += 1) {
    assert.ok(html.indexOf(battingColumnOrder[index - 1]) < html.indexOf(battingColumnOrder[index]));
  }
  for (let index = 1; index < pitchingColumnOrder.length; index += 1) {
    assert.ok(html.indexOf(pitchingColumnOrder[index - 1]) < html.indexOf(pitchingColumnOrder[index]));
  }
  assert.equal(html.includes('WHIP ${formatStat(player.whip)}'), false);
  assert.ok(html.includes("<span class=\"jersey-number\">#${escapeHtml(player.jersey || '--')}</span>"));
  assert.equal(html.includes('背號 ${escapeHtml(player.jersey)}'), false);
  assert.equal(html.includes('球員動作'), false);
  assert.ok(html.includes('class="mini-card tournament-card"'));
  assert.ok(html.includes('class="tournament-actions"'));
  assert.ok(html.includes("renderCardActions('tournament-actions-row'"));
  assert.ok(html.includes('賽季 ${escapeHtml(item.season)} · 比賽 ${gameCount}'));
  assert.equal(html.includes('<span class="chip">${escapeHtml(item.season)}</span>'), false);
  assert.ok(html.includes('class="tournament-game-links"'));
  assert.ok(html.includes('<a class="link-chip tournament-game-link" href="#gamesPage"'));
  assert.ok(html.includes('data-open-game="${game.id}"'));
  assert.ok(html.includes('formatTournamentGameResult(game, teams)'));
  assert.equal(html.includes('盃賽動作'), false);
});

test('defines mobile-first card actions and scorekeeper layout', () => {
  const html = readClientSource();
  const styles = readPublicAsset('styles.css');
  const appSource = readPublicAsset('js', 'app.js');
  const handlersSource = readPublicAsset('js', 'event-handlers.js');

  assert.ok(styles.includes('@media (max-width: 640px)'));
  assert.ok(styles.includes('[hidden] { display: none !important; }'));
  assert.ok(styles.includes('@media (min-width: 641px)'));
  assert.ok(styles.includes('@media (min-width: 1025px)'));
  assert.ok(styles.includes('.game-card, .team-card, .player-card, .tournament-card'));
  assert.ok(styles.includes('grid-template-columns: 1fr'));
  assert.ok(styles.includes('.card-actions-menu'));
  assert.ok(styles.includes('[data-card-actions-menu]'));
  assert.ok(styles.includes('.card-actions-inline'));
  assert.ok(styles.includes('.actions-open .card-actions-inline'));
  assert.ok(styles.includes('.scorebug'));
  assert.ok(styles.includes('.scorekeeper-panel'));
  assert.ok(styles.includes('.play-event-panel'));
  assert.ok(styles.includes('.pitch-panel'));
  assert.equal(styles.includes('min-width: 520px'), false);
  assert.equal(styles.includes('min-width: 640px'), false);
  assert.equal(styles.includes('min-width: 760px'), false);
  assert.equal(styles.includes('grid-template-columns: 1fr 250px 160px'), false);
  assert.ok(html.includes('class="line-score-table"'));
  assert.ok(html.includes('class="scorekeeper-line-score line-score-grid"'));
  assert.ok(handlersSource.includes("event.target.closest('[data-card-actions-menu]')"));
  assert.ok(handlersSource.includes("event.target.closest('[data-open-team]')"));
  assert.ok(handlersSource.includes("event.target.closest('[data-open-game]')"));
  assert.ok(handlersSource.includes("closest('.mini-card')"));
  assert.ok(handlersSource.includes("classList.toggle('actions-open'"));
  assert.ok(appSource.includes('state.lineupExpanded = false;'));
  assert.ok(appSource.includes('ui.scorekeeperSelector.hidden = true;'));
  assert.ok(appSource.includes('ui.scorekeeperSelector.hidden = false;'));
});

test('imports scorekeeper helpers used by the play submit flow', () => {
  const handlersSource = readPublicAsset('js', 'event-handlers.js');
  const scorekeeperImportStart = handlersSource.indexOf('} from \'./scorekeeper-ui.js\';');
  const scorekeeperImport = handlersSource.slice(0, scorekeeperImportStart);

  assert.ok(handlersSource.includes('const bases = getBaseStateBoardValues();'));
  assert.ok(scorekeeperImportStart > -1);
  assert.ok(scorekeeperImport.includes('getBaseStateBoardValues'));
});

test('uses current scoring context to enable occupied-base actions', () => {
  const handlersSource = readPublicAsset('js', 'event-handlers.js');
  const scorekeeperSource = readPublicAsset('js', 'scorekeeper-ui.js');

  assert.ok(handlersSource.includes('requiresOccupiedBaseForResult(resultAction) && !hasOccupiedBase(state.currentContext || {})'));
  assert.ok(handlersSource.includes('if (!hasOccupiedBase(state.currentContext || {})) return;'));
  assert.ok(scorekeeperSource.includes('button.disabled = requiresOccupiedBaseForResult(button.dataset.resultAction) && !hasOccupiedBase(state.currentContext || {})'));
  assert.ok(scorekeeperSource.includes('button.disabled = !hasOccupiedBase(state.currentContext || {})'));
  assert.equal(handlersSource.includes('requiresOccupiedBaseForResult(resultAction) && !hasOccupiedBase())'), false);
  assert.equal(scorekeeperSource.includes('!hasOccupiedBase()'), false);
});

test('does not preview runs when the inning-ending out retires the batter', async () => {
  const { summarizeRunnerDestinations } = await importScoringRules();

  const inningEndingGroundout = summarizeRunnerDestinations(
    { third: 'home', batter: 'out' },
    {
      outsInHalf: 2,
      batterId: 'p12',
      bases: { first: '', second: '', third: 'p03' },
    },
    true,
  );
  assert.equal(inningEndingGroundout.runs, 0);
  assert.equal(inningEndingGroundout.outs, 1);

  const secondOutGroundout = summarizeRunnerDestinations(
    { third: 'home', batter: 'out' },
    {
      outsInHalf: 1,
      batterId: 'p12',
      bases: { first: '', second: '', third: 'p03' },
    },
    true,
  );
  assert.equal(secondOutGroundout.runs, 1);
  assert.equal(secondOutGroundout.outs, 1);
});

test('locks batting order selects to one slot per player in the UI', () => {
  const html = readClientSource();

  assert.ok(html.includes('function updateLineupPlayerLocks()'));
  assert.ok(html.includes('selectedPlayersByTeam'));
  assert.ok(html.includes('option.disabled = Boolean(option.value && selectedPlayers.has(option.value) && option.value !== select.value);'));
  assert.ok(html.includes("event.target.matches('select[data-lineup-team]')"));
});

test('seeds a ready-to-score demo game with complete lineups', async () => {
  const overview = await request('/api/overview');
  const demoGame = overview.body.games.find((game) => game.status === 'live');

  assert.ok(demoGame);
  for (const teamId of overview.body.teams.map((team) => team.id)) {
    const roster = overview.body.players.filter((player) => player.teamId === teamId);
    assert.ok(roster.length >= 9);
  }

  const lineups = await request(`/api/games/${demoGame.id}/lineups`);

  assert.equal(lineups.status, 200);
  assert.equal(lineups.body.context.lineupReady, true);
  assert.ok(lineups.body.context.batterId);
  assert.ok(lineups.body.context.pitcherId);
  assert.equal(lineups.body.context.inning, 1);
  assert.equal(lineups.body.context.half, 'top');
  assert.equal(lineups.body.lineups[demoGame.homeTeamId].battingOrder.length, 9);
  assert.equal(lineups.body.lineups[demoGame.awayTeamId].battingOrder.length, 9);

  const firstPlay = await request(`/api/games/${demoGame.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'GROUNDOUT',
      outs: 1,
      runs: 0,
      bases: { first: '', second: '', third: '' },
      fielderPosition: 'SS',
    },
  });

  assert.equal(firstPlay.status, 201);
  assert.equal(firstPlay.body.event.sequence, 1);
  assert.ok(firstPlay.body.event.batterId);
  assert.ok(firstPlay.body.event.pitcherId);
  assert.equal(firstPlay.body.context.outsInHalf, 1);
});

test('saves batting orders and derives the pitcher without a separate pitcher selector', async () => {
  const response = await request('/api/games/g03/lineups', {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03'] },
        { teamId: 't03', battingOrder: ['p04'] },
      ],
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.lineups.t02.battingOrder[0].playerId, 'p03');
  assert.equal(response.body.lineups.t02.startingPitcherId, 'p03');
  assert.equal(response.body.context.inning, 1);
  assert.equal(response.body.context.half, 'top');
  assert.equal(response.body.context.offenseTeamId, 't03');
  assert.equal(response.body.context.defenseTeamId, 't02');
  assert.equal(response.body.context.batterId, 'p04');
  assert.equal(response.body.context.pitcherId, 'p03');
  assert.deepEqual(response.body.context.bases, { first: '', second: '', third: '' });
});

test('rejects duplicate players in a batting order', async () => {
  const response = await request('/api/games/g03/lineups', {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p03'], startingPitcherId: 'p03' },
      ],
    },
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /打序不能重複/);
});

test('auto-fills inning, half, batter, pitcher, and base state from the lineup', async () => {
  await request('/api/games/g03/lineups', {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03'], startingPitcherId: 'p03' },
        { teamId: 't03', battingOrder: ['p04'], startingPitcherId: 'p04' },
      ],
    },
  });

  const single = await request('/api/games/g03/events', {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
      runs: 0,
      outs: 0,
      bases: { first: 'p04', second: '', third: '' },
      notes: '打者上一壘',
    },
  });

  assert.equal(single.status, 201);
  assert.equal(single.body.event.inning, 1);
  assert.equal(single.body.event.half, 'top');
  assert.equal(single.body.event.offenseTeamId, 't03');
  assert.equal(single.body.event.defenseTeamId, 't02');
  assert.equal(single.body.event.batterId, 'p04');
  assert.equal(single.body.event.pitcherId, 'p03');
  assert.deepEqual(single.body.event.bases, { first: 'p04', second: '', third: '' });
  assert.deepEqual(single.body.context.bases, { first: 'p04', second: '', third: '' });

  const thirdOut = await request('/api/games/g03/events', {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'GROUNDOUT',
      runs: 0,
      outs: 3,
      bases: { first: '', second: '', third: '' },
      fielderPosition: 'P',
    },
  });

  assert.equal(thirdOut.status, 201);
  assert.equal(thirdOut.body.context.inning, 1);
  assert.equal(thirdOut.body.context.half, 'bottom');
  assert.equal(thirdOut.body.context.offenseTeamId, 't02');
  assert.equal(thirdOut.body.context.defenseTeamId, 't03');
  assert.equal(thirdOut.body.context.batterId, 'p03');
  assert.equal(thirdOut.body.context.pitcherId, 'p04');
  assert.equal(thirdOut.body.context.outsInHalf, 0);
  assert.deepEqual(thirdOut.body.context.bases, { first: '', second: '', third: '' });
});

test('records balls and strikes as part of the scoring context', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-06',
      venue: '保送測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12'], startingPitcherId: 'p12' },
        { teamId: 't01', battingOrder: ['p01', 'p02'], startingPitcherId: 'p01' },
      ],
    },
  });

  const pitch = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PITCH',
      balls: 2,
      strikes: 1,
      outs: 0,
      bases: { first: '', second: '', third: '' },
    },
  });

  assert.equal(pitch.status, 201);
  assert.equal(pitch.body.event.balls, 2);
  assert.equal(pitch.body.event.strikes, 1);
  assert.equal(pitch.body.context.balls, 2);
  assert.equal(pitch.body.context.strikes, 1);

  const walk = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PITCH',
      balls: 4,
      strikes: 0,
    },
  });

  assert.equal(walk.status, 201);
  assert.equal(walk.body.event.eventType, 'PLATE_APPEARANCE');
  assert.equal(walk.body.event.result, 'WALK');
  assert.equal(walk.body.context.balls, 0);
  assert.equal(walk.body.context.strikes, 0);
  assert.equal(walk.body.context.bases.first, 'p03');
});

test('applies default runner advancement for singles when bases are not manually edited', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-05',
      venue: '自動推進測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'], startingPitcherId: 'p12' },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'], startingPitcherId: 'p01' },
      ],
    },
  });

  const firstSingle = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
    },
  });

  assert.equal(firstSingle.status, 201);
  assert.equal(firstSingle.body.event.bases.first, 'p03');
  assert.equal(firstSingle.body.context.bases.first, 'p03');

  const secondSingle = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
    },
  });

  assert.equal(secondSingle.status, 201);
  assert.equal(secondSingle.body.event.bases.first, 'p12');
  assert.equal(secondSingle.body.event.bases.second, 'p03');
  assert.equal(secondSingle.body.context.bases.first, 'p12');
  assert.equal(secondSingle.body.context.bases.second, 'p03');
});

test('records wild pitches, balks, and steals as runner events without changing the batter', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-09',
      venue: '跑壘事件測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PITCH', balls: 1, strikes: 1 },
  });

  const steal = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'RUNNER_ADVANCEMENT', result: 'STOLEN_BASE' },
  });
  assert.equal(steal.status, 201);
  assert.equal(steal.body.event.result, 'STOLEN_BASE');
  assert.equal(steal.body.context.batterId, 'p12');
  assert.equal(steal.body.context.balls, 1);
  assert.equal(steal.body.context.strikes, 1);
  assert.deepEqual(steal.body.context.bases, { first: '', second: 'p03', third: '' });
  const stealingRunner = await request('/api/players/p03');
  assert.equal(stealingRunner.status, 200);
  assert.equal(stealingRunner.body.sb, 1);

  const wildPitch = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'RUNNER_ADVANCEMENT', result: 'WILD_PITCH' },
  });
  assert.equal(wildPitch.status, 201);
  assert.deepEqual(wildPitch.body.context.bases, { first: '', second: '', third: 'p03' });

  const balk = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'RUNNER_ADVANCEMENT', result: 'BALK' },
  });
  assert.equal(balk.status, 201);
  assert.equal(balk.body.event.runs, 1);
  assert.deepEqual(balk.body.context.bases, { first: '', second: '', third: '' });
  assert.equal(balk.body.summary.awayRuns, 1);
});

test('records manual multi-base advancement on wild pitches', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-10',
      venue: '暴投測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const single = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  assert.equal(single.status, 201);
  assert.deepEqual(single.body.context.bases, { first: 'p03', second: '', third: '' });

  const wildPitch = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'WILD_PITCH',
      bases: { first: '', second: '', third: 'p03' },
    },
  });

  assert.equal(wildPitch.status, 201);
  assert.equal(wildPitch.body.event.result, 'WILD_PITCH');
  assert.equal(wildPitch.body.context.batterId, 'p12');
  assert.deepEqual(wildPitch.body.context.bases, { first: '', second: '', third: 'p03' });
});

test('records manual multi-base advancement on stolen bases', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-10',
      venue: '盜壘測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const single = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  assert.equal(single.status, 201);
  assert.deepEqual(single.body.context.bases, { first: 'p03', second: '', third: '' });

  const steal = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'STOLEN_BASE',
      bases: { first: '', second: '', third: 'p03' },
    },
  });

  assert.equal(steal.status, 201);
  assert.equal(steal.body.event.result, 'STOLEN_BASE');
  assert.equal(steal.body.context.batterId, 'p12');
  assert.deepEqual(steal.body.context.bases, { first: '', second: '', third: 'p03' });
});

test('records manual stolen-base runner movement and can undo it', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-09',
      venue: '盜壘手動測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const firstSingle = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  const secondSingle = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const defaultSteal = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'STOLEN_BASE',
    },
  });

  assert.equal(defaultSteal.status, 201);
  assert.deepEqual(defaultSteal.body.context.bases, { first: '', second: 'p12', third: 'p03' });

  const undoDefaultSteal = await request(`/api/games/${game.body.id}/events/${defaultSteal.body.event.id}`, {
    method: 'DELETE',
  });

  assert.equal(undoDefaultSteal.status, 200);
  assert.deepEqual(undoDefaultSteal.body.events.map((event) => event.id), [firstSingle.body.event.id, secondSingle.body.event.id]);
  assert.deepEqual(undoDefaultSteal.body.context.bases, { first: 'p12', second: 'p03', third: '' });

  const steal = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'STOLEN_BASE',
      bases: { first: 'p12', second: '', third: 'p03' },
    },
  });

  assert.equal(steal.status, 201);
  assert.equal(steal.body.event.result, 'STOLEN_BASE');
  assert.equal(steal.body.context.batterId, 'p13');
  assert.deepEqual(steal.body.context.bases, { first: 'p12', second: '', third: 'p03' });

  const undo = await request(`/api/games/${game.body.id}/events/${steal.body.event.id}`, {
    method: 'DELETE',
  });

  assert.equal(undo.status, 200);
  assert.equal(undo.body.deletedId, steal.body.event.id);
  assert.deepEqual(undo.body.events.map((event) => event.id), [firstSingle.body.event.id, secondSingle.body.event.id]);
  assert.equal(undo.body.context.batterId, 'p13');
  assert.deepEqual(undo.body.context.bases, { first: 'p12', second: 'p03', third: '' });
});

test('records pickoffs as runner events without changing batter or count', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-16',
      venue: '牽制出局測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const firstSingle = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PITCH', balls: 2, strikes: 1 },
  });

  const defaultPickoff = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'RUNNER_ADVANCEMENT', result: 'PICKOFF' },
  });

  assert.equal(defaultPickoff.status, 201);
  assert.equal(defaultPickoff.body.event.result, 'PICKOFF');
  assert.equal(defaultPickoff.body.event.outs, 1);
  assert.equal(defaultPickoff.body.context.outsInHalf, 1);
  assert.equal(defaultPickoff.body.context.batterId, 'p12');
  assert.equal(defaultPickoff.body.context.balls, 2);
  assert.equal(defaultPickoff.body.context.strikes, 1);
  assert.deepEqual(defaultPickoff.body.context.bases, { first: '', second: '', third: '' });

  const undo = await request(`/api/games/${game.body.id}/events/${defaultPickoff.body.event.id}`, {
    method: 'DELETE',
  });

  assert.equal(undo.status, 200);
  assert.equal(undo.body.events.some((event) => event.id === firstSingle.body.event.id), true);
  assert.equal(undo.body.context.batterId, 'p12');
  assert.equal(undo.body.context.balls, 2);
  assert.equal(undo.body.context.strikes, 1);
  assert.deepEqual(undo.body.context.bases, { first: 'p03', second: '', third: '' });

  const manualPickoff = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'PICKOFF',
      outs: 1,
      bases: { first: '', second: '', third: '' },
    },
  });

  assert.equal(manualPickoff.status, 201);
  assert.equal(manualPickoff.body.event.outs, 1);
  assert.deepEqual(manualPickoff.body.context.bases, { first: '', second: '', third: '' });
});

test('rejects invalid pickoff runner events', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-17',
      venue: '牽制防呆測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  for (const result of ['WILD_PITCH', 'BALK', 'STOLEN_BASE', 'PICKOFF']) {
    const noRunner = await request(`/api/games/${game.body.id}/events`, {
      method: 'POST',
      body: { eventType: 'RUNNER_ADVANCEMENT', result },
    });

    assert.equal(noRunner.status, 400);
    assert.match(noRunner.body.error, /壘上跑者/);
  }

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const noOut = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'PICKOFF',
      outs: 0,
      bases: { first: '', second: '', third: '' },
    },
  });

  assert.equal(noOut.status, 400);
  assert.match(noOut.body.error, /新增出局/);

  const noRemovedRunner = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'RUNNER_ADVANCEMENT',
      result: 'PICKOFF',
      outs: 1,
      bases: { first: 'p03', second: '', third: '' },
    },
  });

  assert.equal(noRemovedRunner.status, 400);
  assert.match(noRemovedRunner.body.error, /壘上跑者/);
});

test('supports double plays and manual outs on fielder choices', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-10',
      venue: '雙殺測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const fielderChoice = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'FIELDERS_CHOICE',
      outs: 1,
      bases: { first: 'p12', second: '', third: '' },
    },
  });

  assert.equal(fielderChoice.status, 201);
  assert.equal(fielderChoice.body.event.outs, 1);
  assert.equal(fielderChoice.body.context.outsInHalf, 1);
  assert.deepEqual(fielderChoice.body.context.bases, { first: 'p12', second: '', third: '' });

  const doublePlayGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-11',
      venue: '雙殺預設測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${doublePlayGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });
  await request(`/api/games/${doublePlayGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const doublePlay = await request(`/api/games/${doublePlayGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DOUBLE_PLAY' },
  });

  assert.equal(doublePlay.status, 201);
  assert.equal(doublePlay.body.event.result, 'DOUBLE_PLAY');
  assert.equal(doublePlay.body.event.outs, 2);
  assert.equal(doublePlay.body.context.outsInHalf, 2);
});

test('advances lead runners on default double plays with multiple runners forced', async () => {
  const twoOnGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-20',
      venue: '一二壘雙殺測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${twoOnGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13', 'p14'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05', 'p06'] },
      ],
    },
  });

  await request(`/api/games/${twoOnGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${twoOnGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const twoOnDoublePlay = await request(`/api/games/${twoOnGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DOUBLE_PLAY' },
  });

  assert.equal(twoOnDoublePlay.status, 201);
  assert.equal(twoOnDoublePlay.body.event.outs, 2);
  assert.equal(twoOnDoublePlay.body.event.runs, 0);
  assert.deepEqual(twoOnDoublePlay.body.context.bases, { first: '', second: '', third: 'p03' });

  const fullBasesGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-21',
      venue: '滿壘雙殺測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${fullBasesGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13', 'p14'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05', 'p06'] },
      ],
    },
  });

  await request(`/api/games/${fullBasesGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${fullBasesGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${fullBasesGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const fullBasesDoublePlay = await request(`/api/games/${fullBasesGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DOUBLE_PLAY' },
  });

  assert.equal(fullBasesDoublePlay.status, 201);
  assert.equal(fullBasesDoublePlay.body.event.outs, 2);
  assert.equal(fullBasesDoublePlay.body.event.runs, 1);
  assert.deepEqual(fullBasesDoublePlay.body.context.bases, { first: '', second: '', third: 'p12' });
  assert.equal(fullBasesDoublePlay.body.summary.awayRuns, 1);
});

test('requires runners on base for double plays, fielder choices, and sacrifices', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-18',
      venue: '雙殺野選防呆測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  for (const result of ['DOUBLE_PLAY', 'FIELDERS_CHOICE', 'SACRIFICE']) {
    const response = await request(`/api/games/${game.body.id}/events`, {
      method: 'POST',
      body: {
        eventType: 'PLATE_APPEARANCE',
        result,
      },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /壘上跑者/);
  }

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const fielderChoice = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'FIELDERS_CHOICE' },
  });

  assert.equal(fielderChoice.status, 201);
  assert.equal(fielderChoice.body.event.result, 'FIELDERS_CHOICE');
});

test('forces runners on dropped third strikes, errors, and fielder choices', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-12',
      venue: '強迫進壘測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const errorReach = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'ERROR' },
  });
  assert.equal(errorReach.status, 201);
  assert.deepEqual(errorReach.body.context.bases, { first: 'p12', second: 'p03', third: '' });

  const fielderChoice = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'FIELDERS_CHOICE' },
  });
  assert.equal(fielderChoice.status, 201);
  assert.deepEqual(fielderChoice.body.context.bases, { first: 'p13', second: 'p12', third: 'p03' });

  const droppedThirdStrikeGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-13',
      venue: '不死三振強迫測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${droppedThirdStrikeGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });
  await request(`/api/games/${droppedThirdStrikeGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });
  await request(`/api/games/${droppedThirdStrikeGame.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'NOTE',
      outs: 2,
      bases: { first: 'p03', second: '', third: '' },
      notes: '兩出局情境',
    },
  });

  const droppedThirdStrike = await request(`/api/games/${droppedThirdStrikeGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DROPPED_THIRD_STRIKE' },
  });
  assert.equal(droppedThirdStrike.status, 201);
  assert.deepEqual(droppedThirdStrike.body.context.bases, { first: 'p12', second: 'p03', third: '' });
});

test('advances runners by one base on sacrifice plays by default', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-14',
      venue: '犧牲打測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SINGLE' },
  });

  const sacrifice = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'SACRIFICE' },
  });

  assert.equal(sacrifice.status, 201);
  assert.equal(sacrifice.body.event.outs, 1);
  assert.deepEqual(sacrifice.body.context.bases, { first: '', second: 'p03', third: '' });
  assert.equal(sacrifice.body.context.batterId, 'p13');
});

test('does not count runs on a third out that retires the batter before first', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-22',
      venue: '第三出局得分測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const setup = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'NOTE',
      outs: 2,
      bases: { first: '', second: '', third: 'p03' },
    },
  });
  assert.equal(setup.status, 201);
  assert.equal(setup.body.context.outsInHalf, 2);
  assert.deepEqual(setup.body.context.bases, { first: '', second: '', third: 'p03' });

  const groundout = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'GROUNDOUT',
      fielderPosition: 'SS',
      runs: 1,
      rbi: 1,
      outs: 1,
      bases: { first: '', second: '', third: '' },
    },
  });

  assert.equal(groundout.status, 201);
  assert.equal(groundout.body.event.runs, 0);
  assert.equal(groundout.body.event.rbi, 0);
  assert.equal(groundout.body.summary.awayRuns, 0);
  assert.equal(groundout.body.summary.score, '0-0');
  assert.equal(groundout.body.context.half, 'bottom');

  const fielderChoiceGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-23',
      venue: '野選第三出局得分測試球場',
      status: 'live',
    },
  });
  await request(`/api/games/${fielderChoiceGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });
  await request(`/api/games/${fielderChoiceGame.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'NOTE',
      outs: 2,
      bases: { first: '', second: '', third: 'p03' },
    },
  });
  const fielderChoiceBatterOut = await request(`/api/games/${fielderChoiceGame.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'FIELDERS_CHOICE',
      runs: 1,
      rbi: 1,
      outs: 1,
      bases: { first: '', second: '', third: '' },
    },
  });

  assert.equal(fielderChoiceBatterOut.status, 201);
  assert.equal(fielderChoiceBatterOut.body.event.runs, 0);
  assert.equal(fielderChoiceBatterOut.body.event.rbi, 0);
  assert.equal(fielderChoiceBatterOut.body.summary.awayRuns, 0);

  const loadedDoublePlayGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-24',
      venue: '一出局滿壘雙殺第三出局測試球場',
      status: 'live',
    },
  });
  await request(`/api/games/${loadedDoublePlayGame.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13', 'p14'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05', 'p06'] },
      ],
    },
  });
  await request(`/api/games/${loadedDoublePlayGame.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'NOTE',
      outs: 1,
      bases: { first: 'p13', second: 'p12', third: 'p03' },
    },
  });
  const loadedDoublePlayThirdOut = await request(`/api/games/${loadedDoublePlayGame.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DOUBLE_PLAY' },
  });

  assert.equal(loadedDoublePlayThirdOut.status, 201);
  assert.equal(loadedDoublePlayThirdOut.body.event.runs, 0);
  assert.equal(loadedDoublePlayThirdOut.body.summary.awayRuns, 0);
  assert.equal(loadedDoublePlayThirdOut.body.context.half, 'bottom');
});

test('turns strike three into a strikeout and supports dropped third strike reach', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-07',
      venue: '三振測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12'] },
        { teamId: 't01', battingOrder: ['p01', 'p02'] },
      ],
    },
  });

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PITCH', strikes: 2 },
  });
  const strikeout = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PITCH', strikes: 3 },
  });

  assert.equal(strikeout.status, 201);
  assert.equal(strikeout.body.event.eventType, 'PLATE_APPEARANCE');
  assert.equal(strikeout.body.event.result, 'STRIKEOUT');
  assert.equal(strikeout.body.event.outs, 1);
  assert.equal(strikeout.body.context.outsInHalf, 1);
  assert.equal(strikeout.body.context.batterId, 'p12');

  const droppedThirdStrike = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DROPPED_THIRD_STRIKE' },
  });

  assert.equal(droppedThirdStrike.status, 201);
  assert.equal(droppedThirdStrike.body.event.result, 'DROPPED_THIRD_STRIKE');
  assert.equal(droppedThirdStrike.body.event.outs, 0);
  assert.equal(droppedThirdStrike.body.context.bases.first, 'p12');

  const illegalDroppedThirdStrike = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PLATE_APPEARANCE', result: 'DROPPED_THIRD_STRIKE' },
  });

  assert.equal(illegalDroppedThirdStrike.status, 400);
  assert.match(illegalDroppedThirdStrike.body.error, /不死三振/);
});

test('does not let stale pitch payloads override strike-three strikeouts', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-08',
      venue: '第三好球測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12'] },
        { teamId: 't01', battingOrder: ['p01', 'p02'] },
      ],
    },
  });

  const strikeout = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: { eventType: 'PITCH', strikes: 3, outs: 0 },
  });

  assert.equal(strikeout.status, 201);
  assert.equal(strikeout.body.event.result, 'STRIKEOUT');
  assert.equal(strikeout.body.event.outs, 1);
  assert.equal(strikeout.body.context.outsInHalf, 1);
});

test('creates teams, players, tournaments, and games with simplified fields', async () => {
  const team = await request('/api/teams', {
    method: 'POST',
    body: { name: '台中鯨' },
  });
  assert.equal(team.status, 201);
  assert.equal(team.body.name, '台中鯨');
  assert.equal('shortName' in team.body, false);

  const player = await request('/api/players', {
    method: 'POST',
    body: {
      name: '黃志明',
      teamId: team.body.id,
      jersey: '9',
      battingAverage: 0.999,
      ops: 2.5,
      hr: 99,
      rbi: 99,
      sb: 99,
    },
  });
  assert.equal(player.status, 201);
  assert.equal(player.body.teamId, team.body.id);
  assert.equal(player.body.battingAverage, 0);
  assert.equal(player.body.ops, 0);
  assert.equal(player.body.hr, 0);
  assert.equal(player.body.rbi, 0);
  assert.equal(player.body.sb, 0);
  assert.equal('position' in player.body, false);

  const invalidPlayer = await request('/api/players', {
    method: 'POST',
    body: { name: '沒有球隊的人', teamId: 'missing-team' },
  });
  assert.equal(invalidPlayer.status, 400);
  assert.match(invalidPlayer.body.error, /無效的球隊/);

  const tournament = await request('/api/tournaments', {
    method: 'POST',
    body: { name: '秋季盃', season: '2026' },
  });
  assert.equal(tournament.status, 201);
  assert.equal(tournament.body.name, '秋季盃');
  assert.equal(tournament.body.season, '2026');
  assert.equal('type' in tournament.body, false);

  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: tournament.body.id,
      homeTeamId: team.body.id,
      awayTeamId: 't01',
      date: '2026-09-02',
      time: '18:35',
      venue: '洲際棒球場',
    },
  });
  assert.equal(game.status, 201);
  assert.equal(game.body.score, '0-0');
  assert.equal(game.body.winnerTeamId, '');
  assert.equal(game.body.status, 'not_started');
  assert.equal(game.body.time, '18:35');

  const scoredGame = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: tournament.body.id,
      homeTeamId: team.body.id,
      awayTeamId: 't01',
      date: '2026-09-03',
      venue: '洲際棒球場',
      score: '3-1',
      status: 'completed',
      winnerTeamId: 't01',
    },
  });
  assert.equal(scoredGame.status, 201);
  assert.notEqual(scoredGame.body.id, game.body.id);
  assert.equal(scoredGame.body.winnerTeamId, team.body.id);
  assert.equal(scoredGame.body.time, '');
});

test('supports players belonging to multiple teams', async () => {
  const teamA = await request('/api/teams', {
    method: 'POST',
    body: { name: '多隊 A' },
  });
  const teamB = await request('/api/teams', {
    method: 'POST',
    body: { name: '多隊 B' },
  });
  const player = await request('/api/players', {
    method: 'POST',
    body: { name: '跨隊球員', teamIds: [teamA.body.id, teamB.body.id], jersey: '34' },
  });

  assert.equal(player.status, 201);
  assert.equal(player.body.teamId, teamA.body.id);
  assert.deepEqual(player.body.teamIds, [teamA.body.id, teamB.body.id]);
  assert.deepEqual(player.body.teams.map((team) => team.id), [teamA.body.id, teamB.body.id]);

  const updated = await request(`/api/players/${player.body.id}`, {
    method: 'PUT',
    body: { name: '跨隊球員', teamIds: [teamB.body.id], jersey: '35' },
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.teamId, teamB.body.id);
  assert.deepEqual(updated.body.teamIds, [teamB.body.id]);
});

test('allows lineup selection from any team linked to the player', async () => {
  const linkedPlayer = await request('/api/players', {
    method: 'POST',
    body: {
      name: '雙隊打者',
      jersey: '88',
      teamIds: ['t02', 't01'],
    },
  });
  assert.equal(linkedPlayer.status, 201);
  assert.ok(linkedPlayer.body.teamIds.includes('t01'));

  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-10-02',
      venue: '多隊測試球場',
      status: 'live',
    },
  });

  const lineup = await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't01', battingOrder: [linkedPlayer.body.id, 'p01'], startingPitcherId: 'p01' },
        { teamId: 't02', battingOrder: ['p12', 'p13'], startingPitcherId: 'p12' },
      ],
    },
  });

  assert.equal(lineup.status, 200);
  assert.equal(lineup.body.lineups.t01.battingOrder[0].playerId, linkedPlayer.body.id);
});

test('derives player batting stats from recorded play events', async () => {
  const homeTeam = await request('/api/teams', {
    method: 'POST',
    body: { name: '成績主隊' },
  });
  const awayTeam = await request('/api/teams', {
    method: 'POST',
    body: { name: '成績客隊' },
  });
  const homePitcher = await request('/api/players', {
    method: 'POST',
    body: { name: '主隊投手', teamId: homeTeam.body.id, jersey: '11' },
  });
  const awayBatter = await request('/api/players', {
    method: 'POST',
    body: { name: '客隊一棒', teamId: awayTeam.body.id, jersey: '1' },
  });
  const awayPitcher = await request('/api/players', {
    method: 'POST',
    body: { name: '客隊投手', teamId: awayTeam.body.id, jersey: '22' },
  });
  const tournament = await request('/api/tournaments', {
    method: 'POST',
    body: { name: '成績盃', season: '2026' },
  });
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: tournament.body.id,
      homeTeamId: homeTeam.body.id,
      awayTeamId: awayTeam.body.id,
      date: '2026-09-04',
      venue: '成績球場',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: homeTeam.body.id, battingOrder: [homePitcher.body.id], startingPitcherId: homePitcher.body.id },
        { teamId: awayTeam.body.id, battingOrder: [awayBatter.body.id], startingPitcherId: awayPitcher.body.id },
      ],
    },
  });
  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'HOME_RUN',
      runs: 1,
      rbi: 1,
      outs: 0,
      bases: { first: '', second: '', third: '' },
    },
  });

  const player = await request(`/api/players/${awayBatter.body.id}`);

  assert.equal(player.status, 200);
  assert.equal(player.body.plateAppearances, 1);
  assert.equal(player.body.atBats, 1);
  assert.equal(player.body.hits, 1);
  assert.equal(player.body.doubles, 0);
  assert.equal(player.body.triples, 0);
  assert.equal(player.body.hr, 1);
  assert.equal(player.body.walks, 0);
  assert.equal(player.body.strikeouts, 0);
  assert.equal(player.body.rbi, 1);
  assert.equal(player.body.runsScored, 1);
  assert.equal(player.body.totalBases, 4);
  assert.equal(player.body.battingAverage, 1);
  assert.equal(player.body.onBasePercentage, 1);
  assert.equal(player.body.sluggingPercentage, 4);
  assert.equal(player.body.ops, 5);

  await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'STRIKEOUT',
      runs: 0,
      outs: 1,
      bases: { first: '', second: '', third: '' },
    },
  });

  const pitcher = await request(`/api/players/${homePitcher.body.id}`);

  assert.equal(pitcher.status, 200);
  assert.equal(pitcher.body.pitchingGames, 1);
  assert.equal(pitcher.body.pitchingWins, 0);
  assert.equal(pitcher.body.pitchingLosses, 0);
  assert.equal(pitcher.body.saves, 0);
  assert.equal(pitcher.body.battersFaced, 2);
  assert.equal(pitcher.body.atBatsAgainst, 2);
  assert.equal(pitcher.body.pitchingOuts, 1);
  assert.equal(pitcher.body.inningsPitched, '0.1');
  assert.equal(pitcher.body.hitsAllowed, 1);
  assert.equal(pitcher.body.doublesAllowed, 0);
  assert.equal(pitcher.body.triplesAllowed, 0);
  assert.equal(pitcher.body.homeRunsAllowed, 1);
  assert.equal(pitcher.body.runsAllowed, 1);
  assert.equal(pitcher.body.earnedRunsAllowed, 1);
  assert.equal(pitcher.body.walksAllowed, 0);
  assert.equal(pitcher.body.strikeoutsThrown, 1);
  assert.equal(pitcher.body.battingAverageAgainst, 0.5);
  assert.equal(pitcher.body.earnedRunAverage, 27);
  assert.equal(pitcher.body.whip, 3);
});

test('records game events and derives the game score from the timeline', async () => {
  const created = await request('/api/games/g01/events', {
    method: 'POST',
    body: {
      inning: 1,
      half: 'top',
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
      runs: 1,
      outs: 0,
      notes: 'Lead runner scores from second.',
    },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.event.sequence, 1);
  assert.equal(created.body.event.offenseTeamId, 't02');
  assert.equal(created.body.summary.awayRuns, 1);
  assert.equal(created.body.summary.homeRuns, 0);
  assert.equal(created.body.summary.score, '0-1');

  const overview = await request('/api/overview');
  const game = overview.body.games.find((entry) => entry.id === 'g01');
  assert.equal(game.score, '0-1');
  assert.equal(game.eventCount, 1);
  assert.equal(game.eventScore, '0-1');
});

test('finishes a game with score and winner derived from recorded events', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-21',
      venue: '完賽測試球場',
      status: 'live',
      score: '0-0',
    },
  });

  const event = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      inning: 1,
      half: 'top',
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
      runs: 2,
      bases: { first: 'p03', second: '', third: '' },
    },
  });
  assert.equal(event.status, 201);

  const staleManualScore = await request(`/api/games/${game.body.id}`, {
    method: 'PUT',
    body: {
      score: '9-9',
      status: 'live',
    },
  });
  assert.equal(staleManualScore.status, 200);
  assert.equal(staleManualScore.body.score, '9-9');

  const finished = await request(`/api/games/${game.body.id}`, {
    method: 'PUT',
    body: {
      status: 'completed',
    },
  });

  assert.equal(finished.status, 200);
  assert.equal(finished.body.status, 'completed');
  assert.equal(finished.body.score, '0-2');
  assert.equal(finished.body.winnerTeamId, 't02');
});

test('overview exposes current inning after a scoreless inning change', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-20',
      venue: '第二局測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const topOuts = [
    { result: 'GROUNDOUT', fielderPosition: 'SS' },
    { result: 'FLYOUT', fielderPosition: 'CF' },
    { result: 'STRIKEOUT' },
  ];
  for (const play of topOuts) {
    const response = await request(`/api/games/${game.body.id}/events`, {
      method: 'POST',
      body: {
        eventType: 'PLATE_APPEARANCE',
        ...play,
      },
    });
    assert.equal(response.status, 201);
  }

  const bottomOuts = [
    { result: 'GROUNDOUT', fielderPosition: '2B' },
    { result: 'FLYOUT', fielderPosition: 'RF' },
    { result: 'STRIKEOUT' },
  ];
  for (const play of bottomOuts) {
    const response = await request(`/api/games/${game.body.id}/events`, {
      method: 'POST',
      body: {
        eventType: 'PLATE_APPEARANCE',
        ...play,
      },
    });
    assert.equal(response.status, 201);
  }

  const overview = await request('/api/overview');
  const listedGame = overview.body.games.find((entry) => entry.id === game.body.id);

  assert.equal(listedGame.eventCount, 6);
  assert.equal(listedGame.currentInning, 2);
  assert.equal(listedGame.currentHalf, 'top');
  assert.deepEqual(listedGame.innings, [{ inning: 1, top: 0, bottom: 0 }]);
});

test('rejects invalid game event input at the API boundary', async () => {
  const response = await request('/api/games/g01/events', {
    method: 'POST',
    body: {
      inning: 0,
      half: 'top',
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
    },
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /局數/);
});

test('requires structured fielder positions for groundouts and flyouts', async () => {
  const game = await request('/api/games', {
    method: 'POST',
    body: {
      tournamentId: 'cup01',
      homeTeamId: 't01',
      awayTeamId: 't02',
      date: '2026-09-15',
      venue: '守備位置測試球場',
      status: 'live',
    },
  });

  await request(`/api/games/${game.body.id}/lineups`, {
    method: 'PUT',
    body: {
      lineups: [
        { teamId: 't02', battingOrder: ['p03', 'p12', 'p13'] },
        { teamId: 't01', battingOrder: ['p01', 'p02', 'p05'] },
      ],
    },
  });

  const missingGroundoutFielder = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'GROUNDOUT',
    },
  });

  assert.equal(missingGroundoutFielder.status, 400);
  assert.match(missingGroundoutFielder.body.error, /守備位置/);

  const invalidFlyoutFielder = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'FLYOUT',
      fielderPosition: 'OF',
    },
  });

  assert.equal(invalidFlyoutFielder.status, 400);
  assert.match(invalidFlyoutFielder.body.error, /守備位置/);

  const groundout = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'GROUNDOUT',
      fielderPosition: 'SS',
    },
  });

  assert.equal(groundout.status, 201);
  assert.equal(groundout.body.event.fielderPosition, 'SS');
  assert.equal(groundout.body.events.at(-1).fielderPosition, 'SS');

  const flyout = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'FLYOUT',
      fielderPosition: 'CF',
    },
  });

  assert.equal(flyout.status, 201);
  assert.equal(flyout.body.event.fielderPosition, 'CF');
  assert.equal(flyout.body.events.at(-1).fielderPosition, 'CF');

  const single = await request(`/api/games/${game.body.id}/events`, {
    method: 'POST',
    body: {
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
      fielderPosition: 'P',
    },
  });

  assert.equal(single.status, 201);
  assert.equal(single.body.event.fielderPosition, '');
  assert.equal(single.body.events.at(-1).fielderPosition, '');
});

test('only rolls back the latest game event one step at a time', async () => {
  const first = await request('/api/games/g02/events', {
    method: 'POST',
    body: {
      inning: 1,
      half: 'bottom',
      eventType: 'PLATE_APPEARANCE',
      result: 'HOME_RUN',
      runs: 1,
      outs: 0,
    },
  });
  const second = await request('/api/games/g02/events', {
    method: 'POST',
    body: {
      inning: 1,
      half: 'bottom',
      eventType: 'PLATE_APPEARANCE',
      result: 'SINGLE',
    },
  });

  const rejected = await request(`/api/games/g02/events/${first.body.event.id}`, {
    method: 'DELETE',
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.error, /最後一筆/);

  const deleted = await request(`/api/games/g02/events/${second.body.event.id}`, {
    method: 'DELETE',
  });

  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.summary.eventCount, 1);
  assert.equal(deleted.body.summary.score, '1-0');
});
