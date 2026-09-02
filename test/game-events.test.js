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

test('keeps overview as the leftmost tab while scorekeeper remains the default workspace', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const scorekeeperNav = html.indexOf('data-target="scorekeeperPage">逐球紀錄');
  const overviewNav = html.indexOf('data-target="overviewPage">總覽');
  const scorekeeperPage = html.indexOf('<section id="scorekeeperPage" class="page active">');
  const gamesPage = html.indexOf('<section id="gamesPage" class="page">');

  assert.ok(scorekeeperNav > -1);
  assert.ok(overviewNav > -1);
  assert.ok(overviewNav < scorekeeperNav);
  assert.ok(scorekeeperPage > -1);
  assert.ok(scorekeeperPage < gamesPage);
  assert.equal(html.includes('<section id="overviewPage" class="page active">'), false);
  assert.ok(html.includes('id="lineupForm"'));
  assert.ok(html.includes('id="toggleLineupBtn"'));
  assert.ok(html.includes('aria-controls="lineupBody"'));
  assert.ok(html.includes('id="lineupBody"'));
  assert.ok(html.includes('id="traditionalScoreboard"'));
  assert.ok(html.includes('id="fieldDiamond"'));
  assert.ok(html.includes('id="countPanel"'));
  assert.ok(html.includes('id="scoreboardActionPanel"'));
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
  assert.equal(html.includes('data-result-action="OTHER"'), false);
  assert.equal(html.includes('>其他</button>'), false);
  assert.equal(html.includes('id="runnerActionBoard"'), false);
  assert.ok(html.includes('data-base-drop-target="first"'));
  assert.ok(html.includes('data-base-drop-target="second"'));
  assert.ok(html.includes('data-base-drop-target="third"'));
  assert.ok(html.includes('data-home-score-target'));
  assert.ok(html.includes('data-out-drop-target'));
  assert.ok(html.includes('data-runner-chip'));
  assert.ok(html.includes('id="playRunBadge"'));
  assert.ok(html.includes('得分 +0'));
  assert.equal(html.includes('本 play'), false);
  assert.ok(html.includes('data-runs-action="decrement"'));
  assert.ok(html.includes('data-runs-action="increment"'));
  assert.ok(html.includes('data-outs-action="decrement"'));
  assert.ok(html.includes('data-outs-action="increment"'));
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
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.ok(html.includes('function getAutomaticPlayAction'));
  assert.ok(html.includes('function applyDefaultPlaySelection'));
  assert.ok(html.includes('function setReadyPlayState'));
  assert.ok(html.includes('function renderScoreboardPreview'));
  assert.ok(html.includes("result === 'SINGLE'"));
  assert.ok(html.includes('!form.result.value'));
  assert.ok(html.includes('data-ready-action'));
  assert.equal(html.includes('確認一壘安打'), false);
  assert.equal(html.includes('套用建議跑壘'), false);
  assert.ok(html.includes('scorebug-controls'));
  assert.ok(html.includes('function renderInteractiveDiamond'));
  assert.ok(html.includes('function moveRunnerToDestination'));
  assert.ok(html.includes('function tryPushRunnerOneBase'));
  assert.ok(html.includes('function adjustPlayRuns'));
  assert.ok(html.includes('function renderRunControls'));
  assert.ok(html.includes('function applyRunnerDestinations'));
  assert.ok(html.includes('function startRunnerPointerDrag'));
  assert.ok(html.includes('function moveRunnerPointerDrag'));
  assert.ok(html.includes('function finishRunnerPointerDrag'));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointerdown'"));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointermove'"));
  assert.ok(html.includes("ui.fieldDiamond.addEventListener('pointerup'"));
  assert.ok(html.includes('document.elementFromPoint(event.clientX, event.clientY)'));
  assert.ok(html.includes('touch-action: none'));
  assert.ok(html.includes('draggable="true"'));
  assert.ok(html.includes("sourceKey === 'batter'"));
  assert.ok(html.includes("target === 'home'"));
  assert.ok(html.includes("target === 'out'"));
  assert.equal(html.includes('runner-diamond-choice'), false);
  assert.ok(html.includes('data-runner-event-action="WILD_PITCH"'));
  assert.ok(html.includes('data-runner-event-action="BALK"'));
  assert.ok(html.includes('data-runner-event-action="STOLEN_BASE"'));
  assert.ok(html.includes('壘上事件'));
  assert.ok(html.includes('async function submitCurrentPlay'));
  assert.ok(html.includes('const hasManualRunnerEdit = state.baseStateTouched'));
  assert.ok(html.includes("const requiresManualRunnerSubmit = ['WILD_PITCH', 'STOLEN_BASE'].includes(runnerEventAction)"));
  assert.match(html, /if \(runnerEventAction\)[\s\S]+if \(!hasManualRunnerEdit\)[\s\S]+applyDefaultPlaySelection\(\)/);
  assert.match(html, /if \(runnerEventAction\)[\s\S]+if \(requiresManualRunnerSubmit\)[\s\S]+return;/);
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
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.ok(html.includes('data-undo-last-event'));
  assert.ok(html.includes('退回上一筆'));
  assert.ok(html.includes('function getLatestEventForUndo'));
  assert.ok(html.includes('Number(event.sequence || 0) > Number(latest.sequence || 0)'));
  assert.ok(html.includes('const latestEvent = getLatestEventForUndo()'));
  assert.equal(html.includes('state.currentEvents[state.currentEvents.length - 1]'), false);
  assert.equal(html.includes('data-delete-event'), false);
});

test('keeps player stats read-only and derived from play events in the UI', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.ok(html.includes('成績會由逐球紀錄自動累加，不在球員資料手動輸入。'));
  assert.equal(html.includes('name="battingAverage"'), false);
  assert.equal(html.includes('name="ops"'), false);
  assert.equal(html.includes('name="hr"'), false);
  assert.equal(html.includes('name="sb"'), false);
});

test('keeps management tabs list-first and opens create forms in a modal', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const sections = [
    { id: 'teamsPage', listTitle: '球隊一覽', actionTitle: '球隊動作', createType: 'team', removedFormId: 'teamForm' },
    { id: 'playersPage', listTitle: '球員列表', actionTitle: '球員動作', createType: 'player', removedFormId: 'playerForm' },
    { id: 'tournamentsPage', listTitle: '盃賽列表', actionTitle: '盃賽動作', createType: 'tournament', removedFormId: 'tournamentForm' },
    { id: 'gamesPage', listTitle: '比賽列表', actionTitle: '比賽動作', createType: 'game', removedFormId: 'gameForm' },
  ];

  for (const section of sections) {
    const start = html.indexOf(`<section id="${section.id}"`);
    const end = html.indexOf('</section>', start);
    const sectionHtml = html.slice(start, end);

    assert.ok(start > -1);
    assert.ok(sectionHtml.indexOf(section.listTitle) < sectionHtml.indexOf(section.actionTitle));
    assert.ok(sectionHtml.includes(`data-create="${section.createType}"`));
    assert.equal(sectionHtml.includes(`id="${section.removedFormId}"`), false);
  }
});

test('locks batting order selects to one slot per player in the UI', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

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
      venue: '洲際棒球場',
    },
  });
  assert.equal(game.status, 201);
  assert.equal(game.body.score, '0-0');
  assert.equal(game.body.winnerTeamId, '');
  assert.equal(game.body.status, 'not_started');

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
  assert.equal(player.body.hr, 1);
  assert.equal(player.body.rbi, 1);
  assert.equal(player.body.totalBases, 4);
  assert.equal(player.body.battingAverage, 1);
  assert.equal(player.body.onBasePercentage, 1);
  assert.equal(player.body.sluggingPercentage, 4);
  assert.equal(player.body.ops, 5);
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
