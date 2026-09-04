import { ui } from './dom.js';
import { getPlayerTeams, getPlayersForTeam, getTournamentName } from './data-helpers.js';
import { getStatusLabel } from './scoring-rules.js';
import { escapeHtml, filterByQuery, getSearchValue } from './utils.js';

function formatStat(value) {
  return Number(value || 0).toFixed(3);
}

function renderPlayerStatTable(label, columns, className) {
  return `
    <section class="player-stat-table ${className}" aria-label="${label}成績">
      <div class="player-stat-title">${label}</div>
      <div class="player-stat-scroll">
        <div class="player-stat-grid" style="--stat-count: ${columns.length};">
          ${columns.map(([heading]) => `<div class="stat-heading">${escapeHtml(heading)}</div>`).join('')}
          ${columns.map(([, value]) => `<div class="stat-value-cell">${escapeHtml(String(value))}</div>`).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderCardActions(rowClass, actionsMarkup, label = '更多操作') {
  return `
    <button class="card-actions-menu tiny-btn secondary" type="button" data-card-actions-menu aria-label="${label}" aria-expanded="false">⋯</button>
    <div class="card-actions-inline ${rowClass}">
      ${actionsMarkup}
    </div>
  `;
}

export function renderStats(overview) {
  if (!ui.statsGrid) return;

  const cards = [
    { label: '球隊', value: overview.totalTeams },
    { label: '球員', value: overview.totalPlayers },
    { label: '盃賽', value: overview.totalTournaments },
    { label: '比賽', value: overview.totalGames },
    { label: '勝場', value: overview.totalWins },
  ];
  ui.statsGrid.innerHTML = cards.map(item => `
    <div class="card stat-card">
      <div class="stat-label">${item.label}</div>
      <div class="stat-value">${item.value}</div>
    </div>
  `).join('');
}

export function setActivePage(targetId) {
  document.querySelectorAll('.nav button').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  const button = document.querySelector(`.nav button[data-target="${targetId}"]`);
  const page = document.getElementById(targetId);
  if (button) button.classList.add('active');
  if (page) page.classList.add('active');
}

export function renderTeams(teams, players = [], games = []) {
  const query = getSearchValue('teamSearchInput') || getSearchValue('globalSearchInput');
  const visibleTeams = filterByQuery(teams || [], query, ['name']);

  if (ui.teamsTable) {
    ui.teamsTable.innerHTML = visibleTeams.map(team => {
      const teamPlayers = getPlayersForTeam(team.id).length;
      const teamWins = (games || []).filter((game) => game.winnerTeamId === team.id).length;
      return `
      <tr>
        <td>${escapeHtml(team.name)}</td>
        <td>${teamPlayers}</td>
        <td>${teamWins}</td>
      </tr>
    `;
    }).join('');
  }

  ui.teamList.innerHTML = visibleTeams.map(team => {
    const teamPlayers = getPlayersForTeam(team.id).length;
    const tournamentIds = [...new Set((games || [])
      .filter((game) => game.homeTeamId === team.id || game.awayTeamId === team.id)
      .map((game) => game.tournamentId))]
      .filter(Boolean);
    const tournamentLinks = tournamentIds.length > 0
      ? tournamentIds.map((tournamentId) => `
          <a class="link-chip tournament-link" href="#tournamentsPage" data-open-tournament="${tournamentId}">
            ${escapeHtml(getTournamentName(tournamentId))}
          </a>
        `).join('')
      : '<span class="muted-inline">尚未參賽</span>';
    return `
      <div class="mini-card team-card" data-team-card="${team.id}">
        <div class="team-main">
          <div class="team-title-line">
            <strong>${escapeHtml(team.name)}</strong>
            <span class="chip">球員 ${teamPlayers}</span>
          </div>
          <div class="team-tournament-links">${tournamentLinks}</div>
        </div>
        <div class="team-actions">
          ${renderCardActions('team-actions-row', `
            <button class="tiny-btn" data-edit-team="${team.id}">編輯</button>
            <button class="tiny-btn danger" data-delete-team="${team.id}">刪除</button>
          `, '球隊更多操作')}
        </div>
      </div>
    `;
  }).join('');
}

export function renderPlayers(players, teams = []) {
  const query = getSearchValue('playerSearchInput') || getSearchValue('globalSearchInput');
  const sorted = [...(players || [])]
    .filter((player) => filterByQuery([player], query, ['name', 'teamId', 'jersey']).length > 0)
    .sort((a, b) => Number(b.ops || 0) - Number(a.ops || 0));

  ui.playerList.innerHTML = sorted.map(player => {
    const playerTeams = getPlayerTeams(player);
    const battingStats = [
      ['G', player.gamesPlayed || 0],
      ['PA', player.plateAppearances || 0],
      ['AB', player.atBats || 0],
      ['H', player.hits || 0],
      ['2B', player.doubles || 0],
      ['3B', player.triples || 0],
      ['HR', player.hr || 0],
      ['BB', player.walks || 0],
      ['SO', player.strikeouts || 0],
      ['RBI', player.rbi || 0],
      ['R', player.runsScored || 0],
      ['OBP', formatStat(player.onBasePercentage)],
      ['SLG', formatStat(player.sluggingPercentage)],
      ['AVG', formatStat(player.battingAverage)],
    ];
    const pitchingStats = [
      ['W', player.pitchingWins || 0],
      ['L', player.pitchingLosses || 0],
      ['SV', player.saves || 0],
      ['G', player.pitchingGames || 0],
      ['IP', player.inningsPitched || '0'],
      ['AB', player.atBatsAgainst || 0],
      ['H', player.hitsAllowed || 0],
      ['HR', player.homeRunsAllowed || 0],
      ['BB', player.walksAllowed || 0],
      ['SO', player.strikeoutsThrown || 0],
      ['R', player.runsAllowed || 0],
      ['ER', player.earnedRunsAllowed || 0],
      ['ERA', formatStat(player.earnedRunAverage)],
    ];
    const teamLinks = playerTeams.length > 0
      ? playerTeams.map((team) => `
          <a class="link-chip player-team-link" href="#teamsPage" data-open-team="${team.id}">
            ${escapeHtml(team.name)}
          </a>
        `).join('')
      : '<span class="muted-inline">尚無球隊</span>';
    return `
      <div class="mini-card player-card">
        <div class="player-main">
          <div class="player-heading-line">
            <strong class="player-name-line">${escapeHtml(player.name)} <span class="jersey-number">#${escapeHtml(player.jersey || '--')}</span></strong>
            <span class="player-team-links">${teamLinks}</span>
          </div>
          <div class="player-stat-lines" aria-label="球員累計成績">
            ${renderPlayerStatTable('打者', battingStats, 'batting-stat-table')}
            ${renderPlayerStatTable('投手', pitchingStats, 'pitching-stat-table')}
          </div>
        </div>
        <div class="player-actions">
          ${renderCardActions('player-actions-row', `
            <button class="tiny-btn" data-edit-player="${player.id}">編輯</button>
            <button class="tiny-btn danger" data-delete-player="${player.id}">刪除</button>
          `, '球員更多操作')}
        </div>
      </div>
    `;
  }).join('');

  const topPlayersList = document.getElementById('topPlayersList');
  if (topPlayersList) {
    topPlayersList.innerHTML = sorted.slice(0, 5).map((player, index) => `
      <div class="mini-card">
        <div class="row-between">
          <strong>#${index + 1} ${escapeHtml(player.name)}</strong>
          <span class="chip">OPS ${Number(player.ops || 0).toFixed(3)}</span>
        </div>
      </div>
    `).join('');
  }
}

function formatTournamentGameResult(game, teams = []) {
  const homeName = (teams || []).find((team) => team.id === game.homeTeamId)?.name || game.homeTeamId;
  const awayName = (teams || []).find((team) => team.id === game.awayTeamId)?.name || game.awayTeamId;
  const score = game.status === 'not_started' ? '0-0' : (game.eventScore || game.score || '0-0');
  const [homeScore = '0', awayScore = '0'] = String(score).split('-').map((item) => item.trim() || '0');
  return `${homeName} ${homeScore}:${awayScore} ${awayName}`;
}

export function renderTournaments(tournaments, games = [], teams = []) {
  const query = getSearchValue('tournamentSearchInput') || getSearchValue('globalSearchInput');
  const visibleTournaments = (tournaments || [])
    .filter((tournament) => filterByQuery([tournament], query, ['name', 'season']).length > 0);

  ui.tournamentList.innerHTML = visibleTournaments.map(item => {
    const tournamentGames = (games || []).filter((game) => game.tournamentId === item.id);
    const gameCount = tournamentGames.length;
    const gameLinks = gameCount > 0
      ? tournamentGames.map((game) => `
          <a class="link-chip tournament-game-link" href="#gamesPage" data-open-game="${game.id}">
            ${escapeHtml(formatTournamentGameResult(game, teams))}
          </a>
        `).join('')
      : '<span class="muted-inline">尚無比賽</span>';
    return `
      <div class="mini-card tournament-card" data-tournament-card="${item.id}">
        <div class="tournament-main">
          <strong>${escapeHtml(item.name)}</strong>
          <div class="team-meta">賽季 ${escapeHtml(item.season)} · 比賽 ${gameCount}</div>
          <div class="tournament-game-links">${gameLinks}</div>
        </div>
        <div class="tournament-actions">
          ${renderCardActions('tournament-actions-row', `
            <button class="tiny-btn" data-edit-tournament="${item.id}">編輯</button>
            <button class="tiny-btn danger" data-delete-tournament="${item.id}">刪除</button>
          `, '盃賽更多操作')}
        </div>
      </div>
    `;
  }).join('');

  const tournamentStatusList = document.getElementById('tournamentStatusList');
  if (tournamentStatusList) {
    tournamentStatusList.innerHTML = visibleTournaments.map(item => `
      <div class="mini-card">
        <strong>${escapeHtml(item.name)}</strong>
        <div class="team-meta">賽季 ${escapeHtml(item.season)}</div>
      </div>
    `).join('');
  }
}

export function sortRecentGames(games = []) {
  return [...games].sort((gameA, gameB) => {
    const dateOrder = String(gameB.date || '').localeCompare(String(gameA.date || ''));
    if (dateOrder !== 0) return dateOrder;
    return String(gameB.id || '').localeCompare(String(gameA.id || ''));
  });
}

export function getGameScoreboardInnings(game) {
  const maxRecordedInning = Math.max(0, ...(game.innings || []).map((entry) => Number(entry.inning || 0)));
  const maxInning = game.status === 'completed'
    ? Math.max(1, maxRecordedInning)
    : Math.max(1, maxRecordedInning, Number(game.currentInning || 0));
  return Array.from({ length: maxInning }, (_, index) => index + 1);
}

export function shouldRenderGameLineScore(game) {
  return game.status === 'completed'
    || Number(game.eventCount || 0) > 0
    || (game.innings || []).length > 0
    || Number(game.currentInning || 0) > 1;
}

function renderGameCards(games, teams = []) {
  return games.map(game => {
    const homeName = (teams || []).find((team) => team.id === game.homeTeamId)?.name || game.homeTeamId;
    const awayName = (teams || []).find((team) => team.id === game.awayTeamId)?.name || game.awayTeamId;
    const score = game.eventScore || game.score;
    const [homeScore = '0', awayScore = '0'] = String(score || '0-0').split('-').map((item) => item.trim());
    const statusKey = String(game.status || 'not_started').replace(/[^a-z_]/g, '');
    const gameDateTime = [game.date || '未定日期', game.time || '未定時間'].join(' ');
    const innings = getGameScoreboardInnings(game);
    const inningScoreCells = (half) => innings.map((inning) => {
      const row = (game.innings || []).find((entry) => Number(entry.inning) === inning) || {};
      return `<div class="scoreboard-cell">${row[half] ?? ''}</div>`;
    }).join('');
    const scoreMarkup = shouldRenderGameLineScore(game)
      ? `
        <div class="game-scoreboard line-score-grid" style="--inning-count: ${innings.length};" aria-label="比賽計分板">
          <div class="scoreboard-cell scoreboard-corner">隊伍</div>
          ${innings.map((inning) => `<div class="scoreboard-cell scoreboard-heading">${inning}</div>`).join('')}
          <div class="scoreboard-cell scoreboard-heading scoreboard-r-heading">R</div>
          <div class="scoreboard-cell scoreboard-heading">H</div>
          <div class="scoreboard-cell scoreboard-heading">E</div>
          <div class="scoreboard-cell scoreboard-team">${escapeHtml(awayName)}</div>
          ${inningScoreCells('top')}
          <strong class="scoreboard-cell scoreboard-run-total">${escapeHtml(awayScore)}</strong>
          <div class="scoreboard-cell">${game.eventCount > 0 ? Number(game.awayHits || 0) : '-'}</div>
          <div class="scoreboard-cell">${game.eventCount > 0 ? Number(game.awayErrors || 0) : '-'}</div>
          <div class="scoreboard-cell scoreboard-team">${escapeHtml(homeName)}</div>
          ${inningScoreCells('bottom')}
          <strong class="scoreboard-cell scoreboard-run-total">${escapeHtml(homeScore)}</strong>
          <div class="scoreboard-cell">${game.eventCount > 0 ? Number(game.homeHits || 0) : '-'}</div>
          <div class="scoreboard-cell">${game.eventCount > 0 ? Number(game.homeErrors || 0) : '-'}</div>
        </div>
      `
      : `<div class="game-score">比分 ${escapeHtml(score)}</div>`;
    return `
      <div class="mini-card game-card" data-game-card="${game.id}">
        <div class="game-main">
          <div class="game-header">
            <strong class="game-matchup">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</strong>
            <span class="game-status status-${statusKey}">${escapeHtml(getStatusLabel(game.status))}</span>
          </div>
          <div class="game-meta">
            <span>${escapeHtml(gameDateTime)}</span>
            <span>盃賽 ${escapeHtml(getTournamentName(game.tournamentId))}</span>
          </div>
          ${scoreMarkup}
        </div>
        <div class="game-actions">
          ${renderCardActions('game-actions-row', `
            <button class="tiny-btn" data-score-game="${game.id}">記錄</button>
            <button class="tiny-btn" data-edit-game="${game.id}">編輯</button>
            <button class="tiny-btn danger" data-delete-game="${game.id}">刪除</button>
          `, '比賽更多操作')}
        </div>
      </div>
    `;
  }).join('');
}

export function renderGames(games, teams = []) {
  const query = getSearchValue('globalSearchInput');
  const visibleGames = (games || [])
    .filter((game) => filterByQuery([game], query, ['date', 'homeTeamId', 'awayTeamId', 'score', 'venue', 'status']).length > 0);

  const detailCards = renderGameCards(sortRecentGames(visibleGames), teams);

  if (ui.gamesList) ui.gamesList.innerHTML = renderGameCards(sortRecentGames(visibleGames).slice(0, 5), teams) || '<div class="mini-card">沒有近期比賽</div>';
  ui.gamesListDetail.innerHTML = detailCards || '<div class="mini-card">沒有符合條件的比賽</div>';
}
