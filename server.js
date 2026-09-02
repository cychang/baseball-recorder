import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import initSqlJs from 'sql.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
const sqliteDbPath = process.env.BASEBALL_DB_PATH || path.join(dataDir, 'baseball.db');

async function createDatabase(dbPath) {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  });
  const database = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();
  let transactionDepth = 0;

  function persist() {
    fs.writeFileSync(dbPath, Buffer.from(database.export()));
  }

  function persistIfNeeded() {
    if (transactionDepth === 0) persist();
  }

  return {
    exec(sql) {
      database.run(sql);
    },
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        run(...params) {
          statement.run(params);
          const changes = database.getRowsModified();
          statement.reset();
          persistIfNeeded();
          return { changes };
        },
        get(...params) {
          statement.bind(params);
          const row = statement.step() ? statement.getAsObject() : undefined;
          statement.reset();
          return row;
        },
        all(...params) {
          statement.bind(params);
          const rows = [];
          while (statement.step()) {
            rows.push(statement.getAsObject());
          }
          statement.reset();
          return rows;
        },
      };
    },
    transaction(fn) {
      return (...args) => {
        transactionDepth += 1;
        if (transactionDepth === 1) database.run('BEGIN TRANSACTION');

        try {
          const result = fn(...args);
          transactionDepth -= 1;
          if (transactionDepth === 0) {
            database.run('COMMIT');
            persist();
          }
          return result;
        } catch (error) {
          transactionDepth -= 1;
          if (transactionDepth === 0) database.run('ROLLBACK');
          throw error;
        }
      };
    },
    close() {
      persist();
      database.close();
    },
  };
}

const defaultDatabase = {
  teams: [
    { id: 't01', name: '台北猛虎' },
    { id: 't02', name: '桃園海盜' },
    { id: 't03', name: '高雄電狼' },
  ],
  players: [
    { id: 'p01', name: '陳偉漢', teamId: 't01', jersey: '27', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p02', name: '林志豪', teamId: 't01', jersey: '8', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p05', name: '張育成', teamId: 't01', jersey: '18', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p06', name: '郭天信', teamId: 't01', jersey: '4', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p07', name: '江坤宇', teamId: 't01', jersey: '90', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p08', name: '林立', teamId: 't01', jersey: '39', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p09', name: '陳傑憲', teamId: 't01', jersey: '24', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p10', name: '吳念庭', teamId: 't01', jersey: '67', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p11', name: '林安可', teamId: 't01', jersey: '77', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p03', name: '王柏融', teamId: 't02', jersey: '15', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p12', name: '林子偉', teamId: 't02', jersey: '12', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p13', name: '申皓瑋', teamId: 't02', jersey: '29', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p14', name: '范國宸', teamId: 't02', jersey: '46', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p15', name: '岳東華', teamId: 't02', jersey: '98', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p16', name: '高宇杰', teamId: 't02', jersey: '65', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p17', name: '李凱威', teamId: 't02', jersey: '6', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p18', name: '成晉', teamId: 't02', jersey: '35', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p19', name: '戴培峰', teamId: 't02', jersey: '95', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p04', name: '鄭宗豪', teamId: 't03', jersey: '31', battingAverage: 0.075, ops: 0.42, hr: 0, rbi: 2, sb: 2, status: 'active' },
    { id: 'p20', name: '林承飛', teamId: 't03', jersey: '6', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p21', name: '王威晨', teamId: 't03', jersey: '9', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p22', name: '蘇智傑', teamId: 't03', jersey: '32', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p23', name: '陳晨威', teamId: 't03', jersey: '98', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p24', name: '梁家榮', teamId: 't03', jersey: '7', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p25', name: '林泓育', teamId: 't03', jersey: '11', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p26', name: '朱育賢', teamId: 't03', jersey: '85', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
    { id: 'p27', name: '李宗賢', teamId: 't03', jersey: '22', battingAverage: 0, ops: 0, hr: 0, rbi: 0, sb: 0, status: 'active' },
  ],
  tournaments: [
    { id: 'cup01', name: '2026 春季盃', season: '2026' },
    { id: 'cup02', name: '2026 台灣國際邀請賽', season: '2026' },
  ],
  games: [
    { id: 'g01', tournamentId: 'cup01', homeTeamId: 't01', awayTeamId: 't02', date: '2026-04-10', venue: '台北體育場', score: '7-4', winnerTeamId: 't01', status: 'completed' },
    { id: 'g02', tournamentId: 'cup01', homeTeamId: 't03', awayTeamId: 't01', date: '2026-04-12', venue: '高雄體育場', score: '5-2', winnerTeamId: 't03', status: 'completed' },
    { id: 'g03', tournamentId: 'cup01', homeTeamId: 't02', awayTeamId: 't03', date: '2026-04-18', venue: '桃園球場', score: '9-3', winnerTeamId: 't02', status: 'completed' },
    { id: 'g04', tournamentId: 'cup02', homeTeamId: 't01', awayTeamId: 't02', date: '2026-09-02', venue: '新莊棒球場', score: '0-0', winnerTeamId: '', status: 'live' },
  ],
  lineups: [
    {
      gameId: 'g04',
      teamId: 't01',
      startingPitcherId: 'p01',
      battingOrder: ['p01', 'p02', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11'],
    },
    {
      gameId: 'g04',
      teamId: 't02',
      startingPitcherId: 'p12',
      battingOrder: ['p03', 'p12', 'p13', 'p14', 'p15', 'p16', 'p17', 'p18', 'p19'],
    },
  ],
};

fs.mkdirSync(path.dirname(sqliteDbPath), { recursive: true });
const db = await createDatabase(sqliteDbPath);

const ENUMS = {
  gameStatus: ['not_started', 'live', 'completed', 'cancelled'],
  halfInning: ['top', 'bottom'],
  eventType: ['PLATE_APPEARANCE', 'PITCH', 'RUNNER_ADVANCEMENT', 'SUBSTITUTION', 'NOTE'],
  playResult: ['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN', 'WALK', 'STRIKEOUT', 'DROPPED_THIRD_STRIKE', 'GROUNDOUT', 'FLYOUT', 'DOUBLE_PLAY', 'ERROR', 'FIELDERS_CHOICE', 'HIT_BY_PITCH', 'SACRIFICE', 'WILD_PITCH', 'BALK', 'STOLEN_BASE'],
};

const EMPTY_BASES = { first: '', second: '', third: '' };
const idCounters = new Map();
const recordIdTables = new Set(['teams', 'players', 'tournaments', 'games']);

function generateRecordId(prefix, tableName) {
  if (!recordIdTables.has(tableName)) {
    throw new Error(`Unsupported ID table: ${tableName}`);
  }

  let counter = idCounters.get(prefix) || 0;

  do {
    counter += 1;
    idCounters.set(prefix, counter);
    const id = `${prefix}${Date.now()}-${counter}`;
    const existing = db.prepare(`SELECT id FROM ${tableName} WHERE id = ?`).get(id);
    if (!existing) return id;
  } while (true);
}

function validateEnum(value, enumName) {
  if (!value) return false;
  const enums = ENUMS[enumName];
  if (!enums) return false;
  return enums.includes(String(value)) || enums.includes(String(value).toLowerCase());
}

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT,
    shortName TEXT,
    city TEXT,
    league TEXT,
    stadium TEXT
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT,
    teamId TEXT,
    position TEXT,
    jersey TEXT,
    battingAverage REAL,
    ops REAL,
    hr INTEGER,
    rbi INTEGER,
    sb INTEGER,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT,
    season TEXT,
    type TEXT,
    startDate TEXT,
    endDate TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    tournamentId TEXT,
    homeTeamId TEXT,
    awayTeamId TEXT,
    date TEXT,
    venue TEXT,
    score TEXT,
    winnerTeamId TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS game_events (
    id TEXT PRIMARY KEY,
    gameId TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    inning INTEGER NOT NULL,
    half TEXT NOT NULL,
    eventType TEXT NOT NULL,
    offenseTeamId TEXT,
    defenseTeamId TEXT,
    batterId TEXT,
    pitcherId TEXT,
    result TEXT,
    runs INTEGER DEFAULT 0,
    outs INTEGER DEFAULT 0,
    balls INTEGER DEFAULT 0,
    strikes INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    baseState TEXT DEFAULT '{}',
    notes TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (gameId) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS game_lineups (
    id TEXT PRIMARY KEY,
    gameId TEXT NOT NULL,
    teamId TEXT NOT NULL,
    battingOrder INTEGER NOT NULL,
    playerId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (gameId) REFERENCES games(id),
    FOREIGN KEY (teamId) REFERENCES teams(id),
    FOREIGN KEY (playerId) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS game_lineup_settings (
    gameId TEXT NOT NULL,
    teamId TEXT NOT NULL,
    startingPitcherId TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (gameId, teamId),
    FOREIGN KEY (gameId) REFERENCES games(id),
    FOREIGN KEY (teamId) REFERENCES teams(id),
    FOREIGN KEY (startingPitcherId) REFERENCES players(id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_events_game_sequence ON game_events (gameId, sequence);
  CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events (gameId);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_lineups_game_team_order ON game_lineups (gameId, teamId, battingOrder);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_lineups_game_team_player ON game_lineups (gameId, teamId, playerId);
`);

function runOptionalMigration(sql) {
  try {
    db.exec(sql);
  } catch {
  }
}

runOptionalMigration("ALTER TABLE game_events ADD COLUMN baseState TEXT DEFAULT '{}'");
runOptionalMigration('ALTER TABLE game_events ADD COLUMN balls INTEGER DEFAULT 0');
runOptionalMigration('ALTER TABLE game_events ADD COLUMN strikes INTEGER DEFAULT 0');

function seedDatabase() {
  const insertTeam = db.prepare('INSERT OR IGNORE INTO teams (id, name, shortName, city, league, stadium) VALUES (?, ?, ?, ?, ?, ?)');
  const insertPlayer = db.prepare('INSERT OR IGNORE INTO players (id, name, teamId, position, jersey, battingAverage, ops, hr, rbi, sb, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertTournament = db.prepare('INSERT OR IGNORE INTO tournaments (id, name, season, type, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertGame = db.prepare('INSERT OR IGNORE INTO games (id, tournamentId, homeTeamId, awayTeamId, date, venue, score, winnerTeamId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertLineup = db.prepare('INSERT OR IGNORE INTO game_lineups (id, gameId, teamId, battingOrder, playerId, createdAt) VALUES (?, ?, ?, ?, ?, ?)');
  const insertLineupSetting = db.prepare('INSERT OR IGNORE INTO game_lineup_settings (gameId, teamId, startingPitcherId, updatedAt) VALUES (?, ?, ?, ?)');

  const tx = db.transaction(() => {
    for (const team of defaultDatabase.teams) {
      insertTeam.run(team.id, team.name, team.shortName || '', team.city || '', team.league || '', team.stadium || '');
    }

    for (const player of defaultDatabase.players) {
      insertPlayer.run(
        player.id,
        player.name,
        player.teamId,
        player.position || '',
        player.jersey,
        player.battingAverage,
        player.ops,
        player.hr,
        player.rbi,
        player.sb,
        player.status
      );
    }

    for (const tournament of defaultDatabase.tournaments) {
      insertTournament.run(
        tournament.id,
        tournament.name,
        tournament.season,
        tournament.type || 'cup',
        tournament.startDate || '',
        tournament.endDate || '',
        tournament.status || 'active'
      );
    }

    for (const game of defaultDatabase.games) {
      insertGame.run(
        game.id,
        game.tournamentId,
        game.homeTeamId,
        game.awayTeamId,
        game.date,
        game.venue,
        game.score,
        game.winnerTeamId,
        game.status
      );
    }

    for (const lineup of defaultDatabase.lineups) {
      const timestamp = '2026-09-02T00:00:00.000Z';
      lineup.battingOrder.forEach((playerId, index) => {
        const battingOrder = index + 1;
        insertLineup.run(
          `lineup-${lineup.gameId}-${lineup.teamId}-${battingOrder}`,
          lineup.gameId,
          lineup.teamId,
          battingOrder,
          playerId,
          timestamp
        );
      });
      insertLineupSetting.run(lineup.gameId, lineup.teamId, lineup.startingPitcherId, timestamp);
    }
  });

  tx();
}

function readDatabase() {
  return {
    teams: db.prepare('SELECT * FROM teams ORDER BY id').all().map(serializeTeam),
    players: db.prepare('SELECT * FROM players ORDER BY id').all().map(serializePlayer),
    tournaments: db.prepare('SELECT * FROM tournaments ORDER BY id').all().map(serializeTournament),
    games: db.prepare('SELECT * FROM games ORDER BY id').all().map(normalizeGame).map(attachGameEventSummary),
  };
}

function buildOverview(data) {
  const teams = data.teams || [];
  const players = data.players || [];
  const tournaments = data.tournaments || [];
  const games = data.games || [];
  const wins = games.filter((game) => game.winnerTeamId && game.winnerTeamId !== '').length;

  return {
    totalTeams: teams.length,
    totalPlayers: players.length,
    totalTournaments: tournaments.length,
    totalGames: games.length,
    totalWins: wins,
  };
}

function getGame(id) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  return game ? normalizeGame(game) : undefined;
}

function serializeTeam(team) {
  return {
    id: team.id,
    name: team.name,
  };
}

function serializePlayer(player) {
  const stats = derivePlayerStats(player.id);
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamId,
    jersey: player.jersey,
    ...stats,
    status: player.status,
  };
}

function roundStat(value) {
  return Number(Number(value || 0).toFixed(3));
}

function derivePlayerStats(playerId) {
  const plateEvents = db.prepare(`
    SELECT eventType, result, rbi
    FROM game_events
    WHERE batterId = ? AND eventType = 'PLATE_APPEARANCE'
  `).all(playerId);
  const hitBases = {
    SINGLE: 1,
    DOUBLE: 2,
    TRIPLE: 3,
    HOME_RUN: 4,
  };
  const stats = {
    plateAppearances: 0,
    atBats: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    walks: 0,
    hitByPitch: 0,
    sacrifices: 0,
    totalBases: 0,
    rbi: 0,
    sb: 0,
  };

  for (const event of plateEvents) {
    const result = event.result || '';
    stats.plateAppearances += 1;
    stats.rbi += Number(event.rbi || 0);

    if (result === 'WALK') {
      stats.walks += 1;
      continue;
    }
    if (result === 'HIT_BY_PITCH') {
      stats.hitByPitch += 1;
      continue;
    }
    if (result === 'SACRIFICE') {
      stats.sacrifices += 1;
      continue;
    }

    stats.atBats += 1;
    if (hitBases[result]) {
      stats.hits += 1;
      stats.totalBases += hitBases[result];
    }
    if (result === 'DOUBLE') stats.doubles += 1;
    if (result === 'TRIPLE') stats.triples += 1;
    if (result === 'HOME_RUN') stats.hr += 1;
  }

  const events = db.prepare(`
    SELECT gameId, sequence, eventType, result, runs, baseState
    FROM game_events
    ORDER BY gameId ASC, sequence ASC
  `).all();
  const previousBasesByGame = {};
  const baseRank = { first: 1, second: 2, third: 3 };
  for (const event of events) {
    const previousBases = previousBasesByGame[event.gameId] || { ...EMPTY_BASES };
    const nextBases = parseBaseState(event.baseState);
    if (event.eventType === 'RUNNER_ADVANCEMENT' && event.result === 'STOLEN_BASE') {
      const previousBase = Object.entries(previousBases).find(([, runnerId]) => runnerId === playerId)?.[0];
      const nextBase = Object.entries(nextBases).find(([, runnerId]) => runnerId === playerId)?.[0];
      const scored = previousBase && !nextBase && Number(event.runs || 0) > 0;
      if (previousBase && ((nextBase && baseRank[nextBase] > baseRank[previousBase]) || scored)) {
        stats.sb += 1;
      }
    }
    previousBasesByGame[event.gameId] = nextBases;
  }

  const obpDenominator = stats.atBats + stats.walks + stats.hitByPitch + stats.sacrifices;
  const battingAverage = stats.atBats > 0 ? stats.hits / stats.atBats : 0;
  const onBasePercentage = obpDenominator > 0
    ? (stats.hits + stats.walks + stats.hitByPitch) / obpDenominator
    : 0;
  const sluggingPercentage = stats.atBats > 0 ? stats.totalBases / stats.atBats : 0;

  return {
    ...stats,
    battingAverage: roundStat(battingAverage),
    onBasePercentage: roundStat(onBasePercentage),
    sluggingPercentage: roundStat(sluggingPercentage),
    ops: roundStat(onBasePercentage + sluggingPercentage),
  };
}

function serializeTournament(tournament) {
  return {
    id: tournament.id,
    name: tournament.name,
    season: tournament.season,
  };
}

function normalizeGame(game) {
  return {
    ...game,
    status: game.status === 'scheduled' ? 'not_started' : game.status,
  };
}

function listGameEvents(gameId) {
  return db.prepare('SELECT * FROM game_events WHERE gameId = ? ORDER BY sequence ASC').all(gameId).map(serializeGameEvent);
}

function serializeGameEvent(event) {
  return {
    ...event,
    inning: Number(event.inning || 1),
    sequence: Number(event.sequence || 0),
    runs: Number(event.runs || 0),
    outs: Number(event.outs || 0),
    balls: Number(event.balls || 0),
    strikes: Number(event.strikes || 0),
    rbi: Number(event.rbi || 0),
    bases: parseBaseState(event.baseState),
  };
}

function parseBaseState(value) {
  if (!value) return { ...EMPTY_BASES };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return {
      first: String(parsed?.first || ''),
      second: String(parsed?.second || ''),
      third: String(parsed?.third || ''),
    };
  } catch {
    return { ...EMPTY_BASES };
  }
}

function stringifyBaseState(bases) {
  const normalized = {
    first: String(bases?.first || ''),
    second: String(bases?.second || ''),
    third: String(bases?.third || ''),
  };
  return JSON.stringify(normalized);
}

function getPlayer(playerId) {
  const id = String(playerId || '').trim();
  if (!id) return undefined;
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

function getPlayerTeamId(playerId) {
  return getPlayer(playerId)?.teamId || '';
}

function validateBaseStateInput(value, offenseTeamId, fallback = EMPTY_BASES) {
  const bases = value === undefined ? { ...fallback } : parseBaseState(value);
  const occupied = [bases.first, bases.second, bases.third].filter(Boolean);
  if (new Set(occupied).size !== occupied.length) {
    return { error: '壘上跑者不能重複' };
  }

  for (const runnerId of occupied) {
    const runner = getPlayer(runnerId);
    if (!runner) return { error: `無效的跑者 ID: ${runnerId}` };
    if (offenseTeamId && runner.teamId !== offenseTeamId) {
      return { error: `壘上跑者必須屬於進攻球隊: ${runnerId}` };
    }
  }

  return { value: bases };
}

function advanceHitBases(currentBases, batterId, baseCount) {
  const bases = { ...EMPTY_BASES };
  let runs = 0;
  const occupiedBases = [
    { key: 'third', index: 3, runnerId: currentBases.third },
    { key: 'second', index: 2, runnerId: currentBases.second },
    { key: 'first', index: 1, runnerId: currentBases.first },
  ];

  for (const base of occupiedBases) {
    if (!base.runnerId) continue;
    const nextBase = base.index + baseCount;
    if (nextBase >= 4) {
      runs += 1;
    } else if (nextBase === 3) {
      bases.third = base.runnerId;
    } else if (nextBase === 2) {
      bases.second = base.runnerId;
    } else {
      bases.first = base.runnerId;
    }
  }

  if (batterId) {
    if (baseCount >= 4) {
      runs += 1;
    } else if (baseCount === 3) {
      bases.third = batterId;
    } else if (baseCount === 2) {
      bases.second = batterId;
    } else {
      bases.first = batterId;
    }
  }

  return { bases, runs };
}

function advanceForcedWalk(currentBases, batterId) {
  const bases = { ...currentBases };
  let runs = 0;

  if (currentBases.first) {
    if (currentBases.second) {
      if (currentBases.third) runs += 1;
      bases.third = currentBases.second;
    }
    bases.second = currentBases.first;
  }
  if (batterId) bases.first = batterId;

  return { bases, runs };
}

function getAutomaticPlayAction(result, currentBases, batterId) {
  if (!batterId) return undefined;
  if (result === 'SINGLE') return advanceHitBases(currentBases, batterId, 1);
  if (result === 'DOUBLE') return advanceHitBases(currentBases, batterId, 2);
  if (result === 'TRIPLE') return advanceHitBases(currentBases, batterId, 3);
  if (result === 'HOME_RUN') return advanceHitBases(currentBases, batterId, 4);
  if (['WALK', 'HIT_BY_PITCH', 'DROPPED_THIRD_STRIKE', 'ERROR', 'FIELDERS_CHOICE'].includes(result)) {
    return advanceForcedWalk(currentBases, batterId);
  }
  if (result === 'SACRIFICE') return advanceHitBases(currentBases, '', 1);
  if (result === 'DOUBLE_PLAY') return { bases: { ...EMPTY_BASES }, runs: 0 };
  return undefined;
}

function getAutomaticRunnerAction(result, currentBases) {
  if (!['WILD_PITCH', 'BALK', 'STOLEN_BASE'].includes(result)) return undefined;
  return advanceHitBases(currentBases, '', 1);
}

function canReachOnDroppedThirdStrike(context) {
  return !context.bases?.first || Number(context.outsInHalf || 0) >= 2;
}

function getGameLineupRows(gameId, teamId) {
  return db.prepare(`
    SELECT game_lineups.teamId, game_lineups.battingOrder, game_lineups.playerId, players.name AS playerName, players.jersey
    FROM game_lineups
    LEFT JOIN players ON players.id = game_lineups.playerId
    WHERE game_lineups.gameId = ? AND game_lineups.teamId = ?
    ORDER BY game_lineups.battingOrder ASC
  `).all(gameId, teamId);
}

function getStartingPitcherId(gameId, teamId) {
  return db.prepare('SELECT startingPitcherId FROM game_lineup_settings WHERE gameId = ? AND teamId = ?')
    .get(gameId, teamId)?.startingPitcherId || '';
}

function serializeGameLineups(game) {
  const result = {};
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    const battingOrder = getGameLineupRows(game.id, teamId).map((row) => ({
      battingOrder: Number(row.battingOrder),
      playerId: row.playerId,
      playerName: row.playerName || '',
      jersey: row.jersey || '',
    }));
    result[teamId] = {
      teamId,
      startingPitcherId: getStartingPitcherId(game.id, teamId),
      battingOrder,
    };
  }
  return result;
}

function getTeamIdsForHalf(game, half) {
  return half === 'top'
    ? { offenseTeamId: game.awayTeamId, defenseTeamId: game.homeTeamId }
    : { offenseTeamId: game.homeTeamId, defenseTeamId: game.awayTeamId };
}

function advanceHalfInning(inning, half) {
  return half === 'top'
    ? { inning, half: 'bottom' }
    : { inning: inning + 1, half: 'top' };
}

function deriveGameContext(game, events = listGameEvents(game.id)) {
  let inning = 1;
  let half = 'top';
  let outsInHalf = 0;
  let balls = 0;
  let strikes = 0;
  let bases = { ...EMPTY_BASES };
  const plateAppearancesByTeam = {};

  for (const event of events) {
    const offenseTeamId = event.offenseTeamId || getTeamIdsForHalf(game, event.half).offenseTeamId;
    const eventOuts = Number(event.outs || 0);
    if (event.eventType === 'PLATE_APPEARANCE') {
      plateAppearancesByTeam[offenseTeamId] = Number(plateAppearancesByTeam[offenseTeamId] || 0) + 1;
      balls = 0;
      strikes = 0;
    } else if (event.eventType === 'PITCH') {
      balls = Number(event.balls || 0);
      strikes = Number(event.strikes || 0);
    }

    outsInHalf += eventOuts;
    if (outsInHalf >= 3) {
      const next = advanceHalfInning(Number(event.inning || inning), event.half || half);
      inning = next.inning;
      half = next.half;
      outsInHalf = 0;
      balls = 0;
      strikes = 0;
      bases = { ...EMPTY_BASES };
    } else {
      inning = Number(event.inning || inning);
      half = event.half || half;
      bases = parseBaseState(event.bases || event.baseState);
    }
  }

  const teams = getTeamIdsForHalf(game, half);
  const battingOrder = getGameLineupRows(game.id, teams.offenseTeamId);
  const batterIndex = battingOrder.length === 0
    ? -1
    : Number(plateAppearancesByTeam[teams.offenseTeamId] || 0) % battingOrder.length;
  const batterId = batterIndex >= 0 ? battingOrder[batterIndex].playerId : '';
  const pitcherId = getStartingPitcherId(game.id, teams.defenseTeamId);
  const lineups = serializeGameLineups(game);
  const lineupReady = [game.homeTeamId, game.awayTeamId].every((teamId) =>
    lineups[teamId]?.battingOrder?.length > 0 && lineups[teamId]?.startingPitcherId
  );

  return {
    inning,
    half,
    outsInHalf,
    balls,
    strikes,
    bases,
    offenseTeamId: teams.offenseTeamId,
    defenseTeamId: teams.defenseTeamId,
    batterId,
    pitcherId,
    lineupReady,
  };
}

function buildGameEventSummary(game, events = listGameEvents(game.id)) {
  let homeRuns = 0;
  let awayRuns = 0;
  let outs = 0;

  const innings = [];
  for (const event of events) {
    const runs = Number(event.runs || 0);
    const inning = Number(event.inning);
    let row = innings.find((entry) => entry.inning === inning);
    if (!row) {
      row = { inning, top: 0, bottom: 0 };
      innings.push(row);
    }

    if (event.half === 'top') {
      awayRuns += runs;
      row.top += runs;
    } else {
      homeRuns += runs;
      row.bottom += runs;
    }
    outs += Number(event.outs || 0);
  }

  return {
    eventCount: events.length,
    homeRuns,
    awayRuns,
    score: `${homeRuns}-${awayRuns}`,
    outs,
    innings: innings.sort((a, b) => a.inning - b.inning),
  };
}

function attachGameEventSummary(game) {
  const summary = buildGameEventSummary(game);
  return {
    ...game,
    eventCount: summary.eventCount,
    eventScore: summary.eventCount > 0 ? summary.score : game.score,
    homeRuns: summary.homeRuns,
    awayRuns: summary.awayRuns,
  };
}

function updateGameScoreFromEvents(gameId) {
  const game = getGame(gameId);
  if (!game) return null;
  const summary = buildGameEventSummary(game);
  const winnerTeamId = summary.homeRuns === summary.awayRuns
    ? ''
    : summary.homeRuns > summary.awayRuns
      ? game.homeTeamId
      : game.awayTeamId;

  db.prepare('UPDATE games SET score = ?, winnerTeamId = ? WHERE id = ?')
    .run(summary.score, winnerTeamId, gameId);

  return {
    game: attachGameEventSummary({ ...game, score: summary.score, winnerTeamId }),
    summary,
  };
}

function getTeam(id) {
  return db.prepare('SELECT id FROM teams WHERE id = ?').get(id);
}

function requireText(value, fieldLabel) {
  const text = String(value || '').trim();
  if (!text) return { error: `${fieldLabel}必填` };
  return { value: text };
}

function requireExistingTeam(teamId, fieldLabel) {
  const id = String(teamId || '').trim();
  if (!id) return { error: `${fieldLabel}必填` };
  if (!getTeam(id)) return { error: `無效的${fieldLabel}: ${id}` };
  return { value: id };
}

function deriveWinnerTeamIdFromScore(score, homeTeamId, awayTeamId) {
  const match = String(score || '').trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return '';

  const homeRuns = Number(match[1]);
  const awayRuns = Number(match[2]);
  if (homeRuns === awayRuns) return '';
  return homeRuns > awayRuns ? homeTeamId : awayTeamId;
}

function parseInteger(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  return Number.parseInt(value, 10);
}

function validateGameEventInput(game, body) {
  const context = deriveGameContext(game);
  const inning = body.inning === undefined ? context.inning : parseInteger(body.inning);
  const outs = parseInteger(body.outs, 0);
  let balls = body.balls === undefined ? Number(context.balls || 0) : parseInteger(body.balls, 0);
  let strikes = body.strikes === undefined ? Number(context.strikes || 0) : parseInteger(body.strikes, 0);
  const half = String(body.half || context.half);
  let eventType = String(body.eventType || 'PLATE_APPEARANCE');
  let result = body.result ? String(body.result) : 'SINGLE';
  let completedByStrikeThree = false;

  if (!Number.isInteger(inning) || inning < 1 || inning > 30) {
    return { error: '局數必須是 1 到 30 的整數' };
  }
  if (!validateEnum(half, 'halfInning')) {
    return { error: `上下半局必須是以下之一: ${ENUMS.halfInning.join(', ')}` };
  }
  if (!validateEnum(eventType, 'eventType')) {
    return { error: `事件類型必須是以下之一: ${ENUMS.eventType.join(', ')}` };
  }

  if (eventType === 'PITCH' && balls === 4) {
    eventType = 'PLATE_APPEARANCE';
    result = 'WALK';
    balls = 0;
    strikes = 0;
  }
  if (eventType === 'PITCH' && strikes === 3) {
    eventType = 'PLATE_APPEARANCE';
    result = 'STRIKEOUT';
    balls = 0;
    strikes = 0;
    completedByStrikeThree = true;
  }

  if (['PLATE_APPEARANCE', 'RUNNER_ADVANCEMENT'].includes(eventType) && !validateEnum(result, 'playResult')) {
    return { error: `打席結果必須是以下之一: ${ENUMS.playResult.join(', ')}` };
  }
  const hasManualOuts = body.outs !== undefined && body.outs !== null && body.outs !== '';
  const defaultOuts = eventType === 'PLATE_APPEARANCE'
    ? result === 'DOUBLE_PLAY'
      ? 2
      : ['STRIKEOUT', 'GROUNDOUT', 'FLYOUT', 'SACRIFICE'].includes(result)
        ? 1
        : outs
    : outs;
  const resultOuts = completedByStrikeThree ? 1 : hasManualOuts ? outs : defaultOuts;
  if (result === 'DROPPED_THIRD_STRIKE' && !canReachOnDroppedThirdStrike(context)) {
    return { error: '不死三振只有一壘空著，或兩出局時才可讓打者上壘' };
  }
  if (!Number.isInteger(resultOuts) || resultOuts < 0 || resultOuts > 3) {
    return { error: '出局數必須是 0 到 3 的整數' };
  }
  if (!Number.isInteger(balls) || balls < 0 || balls > 3) {
    return { error: '壞球必須是 0 到 3 的整數' };
  }
  if (!Number.isInteger(strikes) || strikes < 0 || strikes > 2) {
    return { error: '好球必須是 0 到 2 的整數' };
  }
  if (body.offenseTeamId && !getTeam(body.offenseTeamId)) {
    return { error: `無效的進攻球隊 ID: ${body.offenseTeamId}` };
  }
  if (body.defenseTeamId && !getTeam(body.defenseTeamId)) {
    return { error: `無效的防守球隊 ID: ${body.defenseTeamId}` };
  }
  if (body.batterId && !getPlayer(body.batterId)) {
    return { error: `無效的打者 ID: ${body.batterId}` };
  }
  if (body.pitcherId && !getPlayer(body.pitcherId)) {
    return { error: `無效的投手 ID: ${body.pitcherId}` };
  }

  const teams = getTeamIdsForHalf(game, half);
  const offenseTeamId = body.offenseTeamId || teams.offenseTeamId;
  const defenseTeamId = body.defenseTeamId || teams.defenseTeamId;
  const batterId = body.batterId || context.batterId || '';
  const pitcherId = body.pitcherId || context.pitcherId || '';
  const hasManualBases = body.bases !== undefined || body.baseState !== undefined;
  const hasManualRuns = body.runs !== undefined && body.runs !== null && body.runs !== '';
  const automaticPlayAction = eventType === 'PLATE_APPEARANCE'
    ? getAutomaticPlayAction(result, context.bases, batterId)
    : eventType === 'RUNNER_ADVANCEMENT'
      ? getAutomaticRunnerAction(result, context.bases)
      : undefined;
  const baseInput = hasManualBases || !automaticPlayAction
    ? body.bases ?? body.baseState
    : automaticPlayAction.bases;

  const baseState = validateBaseStateInput(baseInput, offenseTeamId, context.bases);
  if (baseState.error) return { error: baseState.error };
  const bases = context.outsInHalf + resultOuts >= 3 ? { ...EMPTY_BASES } : baseState.value;
  const runs = parseInteger(body.runs, !hasManualRuns && automaticPlayAction ? automaticPlayAction.runs : 0);
  const rbi = parseInteger(body.rbi, runs);

  if (!Number.isInteger(runs) || runs < 0 || runs > 4) {
    return { error: '得分必須是 0 到 4 的整數' };
  }
  if (!Number.isInteger(rbi) || rbi < 0 || rbi > 4) {
    return { error: '打點必須是 0 到 4 的整數' };
  }

  return {
    value: {
      inning,
      half,
      eventType,
      offenseTeamId,
      defenseTeamId,
      batterId,
      pitcherId,
      result: ['PLATE_APPEARANCE', 'RUNNER_ADVANCEMENT'].includes(eventType) ? result : '',
      runs,
      outs: resultOuts,
      balls,
      strikes,
      rbi,
      bases,
      baseState: stringifyBaseState(bases),
      notes: body.notes || '',
    },
  };
}

function normalizeLineupEntry(entry, index) {
  if (typeof entry === 'string') {
    return { battingOrder: index + 1, playerId: entry };
  }
  return {
    battingOrder: parseInteger(entry?.battingOrder, index + 1),
    playerId: String(entry?.playerId || '').trim(),
  };
}

function validateLineupInput(game, body) {
  const lineups = Array.isArray(body?.lineups) ? body.lineups : [];
  if (lineups.length === 0) return { error: '至少要提供一隊打序' };

  const gameTeamIds = new Set([game.homeTeamId, game.awayTeamId]);
  const seenTeams = new Set();
  const value = [];

  for (const item of lineups) {
    const teamId = String(item?.teamId || '').trim();
    if (!gameTeamIds.has(teamId)) return { error: `打序球隊必須是本場主隊或客隊: ${teamId}` };
    if (seenTeams.has(teamId)) return { error: `同一隊打序不能重複提交: ${teamId}` };
    seenTeams.add(teamId);

    const battingOrder = Array.isArray(item?.battingOrder)
      ? item.battingOrder.map(normalizeLineupEntry)
      : [];
    if (battingOrder.length === 0) return { error: '打序至少需要一名球員' };

    const seenOrders = new Set();
    const seenPlayers = new Set();
    for (const entry of battingOrder) {
      if (!Number.isInteger(entry.battingOrder) || entry.battingOrder < 1 || entry.battingOrder > 20) {
        return { error: '打序必須是 1 到 20 的整數' };
      }
      if (seenOrders.has(entry.battingOrder) || seenPlayers.has(entry.playerId)) {
        return { error: '打序不能重複' };
      }
      seenOrders.add(entry.battingOrder);
      seenPlayers.add(entry.playerId);

      const player = getPlayer(entry.playerId);
      if (!player) return { error: `無效的打序球員 ID: ${entry.playerId}` };
      if (player.teamId !== teamId) return { error: `打序球員必須屬於該球隊: ${entry.playerId}` };
    }

    const startingPitcherId = String(item?.startingPitcherId || battingOrder[0]?.playerId || '').trim();
    const pitcher = getPlayer(startingPitcherId);
    if (!pitcher) return { error: `無效的先發投手 ID: ${startingPitcherId}` };
    if (pitcher.teamId !== teamId) return { error: `先發投手必須屬於該球隊: ${startingPitcherId}` };

    value.push({
      teamId,
      startingPitcherId,
      battingOrder: battingOrder.sort((a, b) => a.battingOrder - b.battingOrder),
    });
  }

  return { value };
}

function saveGameLineups(game, lineups) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const lineup of lineups) {
      db.prepare('DELETE FROM game_lineups WHERE gameId = ? AND teamId = ?').run(game.id, lineup.teamId);
      db.prepare('DELETE FROM game_lineup_settings WHERE gameId = ? AND teamId = ?').run(game.id, lineup.teamId);

      for (const entry of lineup.battingOrder) {
        db.prepare('INSERT INTO game_lineups (id, gameId, teamId, battingOrder, playerId, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(`lineup-${game.id}-${lineup.teamId}-${entry.battingOrder}`, game.id, lineup.teamId, entry.battingOrder, entry.playerId, now);
      }

      db.prepare('INSERT INTO game_lineup_settings (gameId, teamId, startingPitcherId, updatedAt) VALUES (?, ?, ?, ?)')
        .run(game.id, lineup.teamId, lineup.startingPitcherId, now);
    }
  });
  tx();
}

seedDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_, res) => {
  res.json({ ok: true, mode: 'SQLite', timestamp: new Date().toISOString() });
});

app.get('/api/config', (_, res) => {
  res.json({
    dataSource: 'SQLite',
    hasCredentials: false,
    folderId: null,
    enums: ENUMS,
  });
});

app.get('/api/overview', (_, res) => {
  const data = readDatabase();
  res.json({
    overview: buildOverview(data),
    teams: data.teams || [],
    players: data.players || [],
    tournaments: data.tournaments || [],
    games: data.games || [],
  });
});

app.get('/api/teams', (_, res) => {
  res.json(readDatabase().teams || []);
});

app.get('/api/teams/:id', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(serializeTeam(team));
});

app.get('/api/players', (_, res) => {
  res.json(readDatabase().players || []);
});

app.get('/api/players/:id', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(serializePlayer(player));
});

app.get('/api/tournaments', (_, res) => {
  res.json(readDatabase().tournaments || []);
});

app.get('/api/tournaments/:id', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json(serializeTournament(tournament));
});

app.get('/api/games', (_, res) => {
  res.json(readDatabase().games || []);
});

app.get('/api/games/:id', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(attachGameEventSummary(game));
});

app.get('/api/games/:id/lineups', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const events = listGameEvents(req.params.id);

  res.json({
    game: attachGameEventSummary(game),
    lineups: serializeGameLineups(game),
    context: deriveGameContext(game, events),
  });
});

app.put('/api/games/:id/lineups', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const validation = validateLineupInput(game, req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  saveGameLineups(game, validation.value);
  const events = listGameEvents(req.params.id);

  res.json({
    game: attachGameEventSummary(game),
    lineups: serializeGameLineups(game),
    context: deriveGameContext(game, events),
  });
});

app.get('/api/games/:id/events', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const events = listGameEvents(req.params.id);
  res.json({
    game: attachGameEventSummary(game),
    events,
    summary: buildGameEventSummary(game, events),
    lineups: serializeGameLineups(game),
    context: deriveGameContext(game, events),
  });
});

app.post('/api/games/:id/events', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const validation = validateGameEventInput(game, req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  const nextSequence = db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM game_events WHERE gameId = ?')
    .get(req.params.id).sequence;
  const event = {
    id: `evt-${req.params.id}-${nextSequence}`,
    gameId: req.params.id,
    sequence: nextSequence,
    createdAt: new Date().toISOString(),
    ...validation.value,
  };

  db.prepare(`
    INSERT INTO game_events (
      id, gameId, sequence, inning, half, eventType, offenseTeamId, defenseTeamId,
      batterId, pitcherId, result, runs, outs, balls, strikes, rbi, baseState, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.gameId,
    event.sequence,
    event.inning,
    event.half,
    event.eventType,
    event.offenseTeamId,
    event.defenseTeamId,
    event.batterId,
    event.pitcherId,
    event.result,
    event.runs,
    event.outs,
    event.balls,
    event.strikes,
    event.rbi,
    event.baseState,
    event.notes,
    event.createdAt
  );

  const updated = updateGameScoreFromEvents(req.params.id);
  res.status(201).json({
    event,
    events: listGameEvents(req.params.id),
    summary: updated.summary,
    game: updated.game,
    lineups: serializeGameLineups(game),
    context: deriveGameContext(game),
  });
});

app.delete('/api/games/:id/events/:eventId', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const latestEvent = db.prepare('SELECT id FROM game_events WHERE gameId = ? ORDER BY sequence DESC LIMIT 1').get(req.params.id);
  if (!latestEvent) return res.status(404).json({ error: 'Game event not found' });
  if (latestEvent.id !== req.params.eventId) {
    return res.status(400).json({ error: '只能退回最後一筆事件' });
  }

  const result = db.prepare('DELETE FROM game_events WHERE gameId = ? AND id = ?').run(req.params.id, req.params.eventId);
  if (result.changes === 0) return res.status(404).json({ error: 'Game event not found' });

  const updated = updateGameScoreFromEvents(req.params.id);
  res.json({
    ok: true,
    deletedId: req.params.eventId,
    events: listGameEvents(req.params.id),
    summary: updated.summary,
    game: updated.game,
    lineups: serializeGameLineups(game),
    context: deriveGameContext(game),
  });
});

app.post('/api/teams', (req, res) => {
  const name = requireText(req.body.name, '球隊名稱');
  if (name.error) return res.status(400).json({ error: name.error });

  const team = {
    id: generateRecordId('t', 'teams'),
    name: name.value,
    shortName: '',
    city: '',
    league: '',
    stadium: '',
  };

  db.prepare('INSERT INTO teams (id, name, shortName, city, league, stadium) VALUES (?, ?, ?, ?, ?, ?)')
    .run(team.id, team.name, team.shortName, team.city, team.league, team.stadium);

  res.status(201).json(serializeTeam(team));
});

app.put('/api/teams/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Team not found' });
  const name = requireText(req.body.name ?? current.name, '球隊名稱');
  if (name.error) return res.status(400).json({ error: name.error });

  const team = {
    ...current,
    name: name.value,
  };

  db.prepare('UPDATE teams SET name = ?, shortName = ?, city = ?, league = ?, stadium = ? WHERE id = ?')
    .run(team.name, team.shortName, team.city, team.league, team.stadium, req.params.id);

  res.json(serializeTeam(team));
});

app.delete('/api/teams/:id', (req, res) => {
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Team not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/players', (req, res) => {
  const name = requireText(req.body.name, '球員姓名');
  if (name.error) return res.status(400).json({ error: name.error });
  const teamId = requireExistingTeam(req.body.teamId, '球隊');
  if (teamId.error) return res.status(400).json({ error: teamId.error });

  const player = {
    id: generateRecordId('p', 'players'),
    name: name.value,
    teamId: teamId.value,
    position: '',
    jersey: req.body.jersey || '0',
    battingAverage: 0,
    ops: 0,
    hr: 0,
    rbi: 0,
    sb: 0,
  };

  db.prepare('INSERT INTO players (id, name, teamId, position, jersey, battingAverage, ops, hr, rbi, sb, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(player.id, player.name, player.teamId, player.position, player.jersey, player.battingAverage, player.ops, player.hr, player.rbi, player.sb, 'active');

  res.status(201).json(serializePlayer(player));
});

app.put('/api/players/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Player not found' });
  const name = requireText(req.body.name ?? current.name, '球員姓名');
  if (name.error) return res.status(400).json({ error: name.error });
  const teamId = req.body.teamId === undefined
    ? { value: current.teamId }
    : requireExistingTeam(req.body.teamId, '球隊');
  if (teamId.error) return res.status(400).json({ error: teamId.error });

  const player = {
    ...current,
    name: name.value,
    teamId: teamId.value,
    position: '',
    jersey: req.body.jersey || current.jersey,
    battingAverage: 0,
    ops: 0,
    hr: 0,
    rbi: 0,
    sb: 0,
  };

  db.prepare('UPDATE players SET name = ?, teamId = ?, position = ?, jersey = ?, battingAverage = ?, ops = ?, hr = ?, rbi = ?, sb = ?, status = ? WHERE id = ?')
    .run(player.name, player.teamId, player.position, player.jersey, player.battingAverage, player.ops, player.hr, player.rbi, player.sb, 'active', req.params.id);

  res.json(serializePlayer(player));
});

app.delete('/api/players/:id', (req, res) => {
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Player not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/tournaments', (req, res) => {
  const name = requireText(req.body.name, '盃賽名稱');
  if (name.error) return res.status(400).json({ error: name.error });
  const season = requireText(req.body.season, '賽季');
  if (season.error) return res.status(400).json({ error: season.error });

  const tournament = {
    id: generateRecordId('cup', 'tournaments'),
    name: name.value,
    season: season.value,
    type: 'cup',
    startDate: '',
    endDate: '',
    status: 'active',
  };

  db.prepare('INSERT INTO tournaments (id, name, season, type, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(tournament.id, tournament.name, tournament.season, tournament.type, tournament.startDate, tournament.endDate, tournament.status);

  res.status(201).json(serializeTournament(tournament));
});

app.put('/api/tournaments/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Tournament not found' });
  const name = requireText(req.body.name ?? current.name, '盃賽名稱');
  if (name.error) return res.status(400).json({ error: name.error });
  const season = requireText(req.body.season ?? current.season, '賽季');
  if (season.error) return res.status(400).json({ error: season.error });

  const tournament = {
    ...current,
    name: name.value,
    season: season.value,
    type: 'cup',
  };

  db.prepare('UPDATE tournaments SET name = ?, season = ?, type = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?')
    .run(tournament.name, tournament.season, tournament.type, current.startDate, current.endDate, 'active', req.params.id);

  res.json(serializeTournament(tournament));
});

app.delete('/api/tournaments/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/games', (req, res) => {
  const tournaments = db.prepare('SELECT id FROM tournaments').all();
  const validTournamentIds = tournaments.map(t => t.id);
  if (!validTournamentIds.includes(req.body.tournamentId)) {
    return res.status(400).json({ error: `盃賽 ID 必須是有效的盃賽: ${validTournamentIds.join(', ')}` });
  }
  const status = req.body.status || 'not_started';
  if (!validateEnum(status, 'gameStatus')) {
    return res.status(400).json({ error: `比賽狀態必須是以下之一: ${ENUMS.gameStatus.join(', ')}` });
  }
  const homeTeamId = requireExistingTeam(req.body.homeTeamId, '主隊');
  if (homeTeamId.error) return res.status(400).json({ error: homeTeamId.error });
  const awayTeamId = requireExistingTeam(req.body.awayTeamId, '客隊');
  if (awayTeamId.error) return res.status(400).json({ error: awayTeamId.error });
  if (homeTeamId.value === awayTeamId.value) {
    return res.status(400).json({ error: '主隊和客隊不能相同' });
  }

  const score = String(req.body.score || '').trim() || '0-0';

  const game = {
    id: generateRecordId('g', 'games'),
    tournamentId: req.body.tournamentId,
    homeTeamId: homeTeamId.value,
    awayTeamId: awayTeamId.value,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    venue: req.body.venue || '未定地點',
    score,
    winnerTeamId: deriveWinnerTeamIdFromScore(score, homeTeamId.value, awayTeamId.value),
    status,
  };

  db.prepare('INSERT INTO games (id, tournamentId, homeTeamId, awayTeamId, date, venue, score, winnerTeamId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(game.id, game.tournamentId, game.homeTeamId, game.awayTeamId, game.date, game.venue, game.score, game.winnerTeamId, game.status);

  res.status(201).json(normalizeGame(game));
});

app.put('/api/games/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Game not found' });

  if (req.body.tournamentId) {
    const tournament = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(req.body.tournamentId);
    if (!tournament) return res.status(400).json({ error: `無效的盃賽 ID: ${req.body.tournamentId}` });
  }
  if (req.body.status && !validateEnum(req.body.status, 'gameStatus')) {
    return res.status(400).json({ error: `比賽狀態必須是以下之一: ${ENUMS.gameStatus.join(', ')}` });
  }
  const homeTeamId = req.body.homeTeamId === undefined
    ? { value: current.homeTeamId }
    : requireExistingTeam(req.body.homeTeamId, '主隊');
  if (homeTeamId.error) return res.status(400).json({ error: homeTeamId.error });
  const awayTeamId = req.body.awayTeamId === undefined
    ? { value: current.awayTeamId }
    : requireExistingTeam(req.body.awayTeamId, '客隊');
  if (awayTeamId.error) return res.status(400).json({ error: awayTeamId.error });
  if (homeTeamId.value === awayTeamId.value) {
    return res.status(400).json({ error: '主隊和客隊不能相同' });
  }

  const score = req.body.score === undefined
    ? current.score
    : String(req.body.score || '').trim() || '0-0';

  const game = {
    ...current,
    tournamentId: req.body.tournamentId || current.tournamentId,
    homeTeamId: homeTeamId.value,
    awayTeamId: awayTeamId.value,
    date: req.body.date || current.date,
    venue: req.body.venue || current.venue,
    score,
    winnerTeamId: deriveWinnerTeamIdFromScore(score, homeTeamId.value, awayTeamId.value),
    status: req.body.status || current.status,
  };

  db.prepare('UPDATE games SET tournamentId = ?, homeTeamId = ?, awayTeamId = ?, date = ?, venue = ?, score = ?, winnerTeamId = ?, status = ? WHERE id = ?')
    .run(game.tournamentId, game.homeTeamId, game.awayTeamId, game.date, game.venue, game.score, game.winnerTeamId, game.status, req.params.id);

  res.json(normalizeGame(game));
});

app.delete('/api/games/:id', (req, res) => {
  const result = db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Game not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/reset', (_, res) => {
  db.exec('DELETE FROM game_events; DELETE FROM game_lineups; DELETE FROM game_lineup_settings; DELETE FROM games; DELETE FROM tournaments; DELETE FROM players; DELETE FROM teams;');
  seedDatabase();
  res.json({ ok: true, message: 'Demo data reset successfully.' });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(PORT, () => {
    console.log(`Baseball record app running at http://localhost:${PORT}`);
  });
}

export { app, db, buildGameEventSummary };
