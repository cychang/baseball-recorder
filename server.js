import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
const sqliteDbPath = path.join(dataDir, 'baseball.db');

const defaultDatabase = {
  teams: [
    { id: 't01', name: '台北猛虎', shortName: 'TPM', city: '台北市', league: '國家聯賽', stadium: '台北體育場' },
    { id: 't02', name: '桃園海盜', shortName: 'TYD', city: '桃園市', league: '國家聯賽', stadium: '桃園球場' },
    { id: 't03', name: '高雄電狼', shortName: 'KSW', city: '高雄市', league: '國家聯賽', stadium: '高雄體育場' },
  ],
  players: [
    { id: 'p01', name: '陳偉漢', teamId: 't01', position: 'C', jersey: '27', battingAverage: 0.318, ops: 0.942, hr: 7, rbi: 23, sb: 11, status: 'active' },
    { id: 'p02', name: '林志豪', teamId: 't01', position: 'RF', jersey: '8', battingAverage: 0.289, ops: 0.871, hr: 5, rbi: 19, sb: 8, status: 'active' },
    { id: 'p03', name: '王柏融', teamId: 't02', position: '1B', jersey: '15', battingAverage: 0.307, ops: 0.913, hr: 6, rbi: 21, sb: 4, status: 'active' },
    { id: 'p04', name: '鄭宗豪', teamId: 't03', position: 'SP', jersey: '31', battingAverage: 0.075, ops: 0.42, hr: 0, rbi: 2, sb: 2, status: 'active' },
  ],
  tournaments: [
    { id: 'cup01', name: '2026 春季盃', season: '2026', type: 'cup', startDate: '2026-03-01', endDate: '2026-05-31', status: 'active' },
    { id: 'cup02', name: '2026 台灣國際邀請賽', season: '2026', type: 'international', startDate: '2026-06-01', endDate: '2026-08-31', status: 'scheduled' },
  ],
  games: [
    { id: 'g01', tournamentId: 'cup01', homeTeamId: 't01', awayTeamId: 't02', date: '2026-04-10', venue: '台北體育場', score: '7-4', winnerTeamId: 't01', status: 'completed' },
    { id: 'g02', tournamentId: 'cup01', homeTeamId: 't03', awayTeamId: 't01', date: '2026-04-12', venue: '高雄體育場', score: '5-2', winnerTeamId: 't03', status: 'completed' },
    { id: 'g03', tournamentId: 'cup01', homeTeamId: 't02', awayTeamId: 't03', date: '2026-04-18', venue: '桃園球場', score: '9-3', winnerTeamId: 't02', status: 'completed' },
  ],
};

fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(sqliteDbPath);
db.pragma('journal_mode = WAL');

const ENUMS = {
  playerPosition: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'],
  tournamentType: ['league', 'shortterm'],
  gameStatus: ['scheduled', 'live', 'completed', 'cancelled'],
  teamLeague: ['國家聯賽', '職業聯賽', '業餘聯賽', '學生聯賽'],
};

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
`);

function seedDatabase() {
  const teamCount = db.prepare('SELECT COUNT(*) AS count FROM teams').get().count;
  if (teamCount > 0) return;

  const insertTeam = db.prepare('INSERT INTO teams (id, name, shortName, city, league, stadium) VALUES (?, ?, ?, ?, ?, ?)');
  const insertPlayer = db.prepare('INSERT INTO players (id, name, teamId, position, jersey, battingAverage, ops, hr, rbi, sb, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertTournament = db.prepare('INSERT INTO tournaments (id, name, season, type, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertGame = db.prepare('INSERT INTO games (id, tournamentId, homeTeamId, awayTeamId, date, venue, score, winnerTeamId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    for (const team of defaultDatabase.teams) {
      insertTeam.run(team.id, team.name, team.shortName, team.city, team.league, team.stadium);
    }

    for (const player of defaultDatabase.players) {
      insertPlayer.run(
        player.id,
        player.name,
        player.teamId,
        player.position,
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
        tournament.type,
        tournament.startDate,
        tournament.endDate,
        tournament.status
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
  });

  tx();
}

function readDatabase() {
  return {
    teams: db.prepare('SELECT * FROM teams ORDER BY id').all(),
    players: db.prepare('SELECT * FROM players ORDER BY id').all(),
    tournaments: db.prepare('SELECT * FROM tournaments ORDER BY id').all(),
    games: db.prepare('SELECT * FROM games ORDER BY id').all(),
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
  res.json(team);
});

app.get('/api/players', (_, res) => {
  res.json(readDatabase().players || []);
});

app.get('/api/players/:id', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(player);
});

app.get('/api/tournaments', (_, res) => {
  res.json(readDatabase().tournaments || []);
});

app.get('/api/tournaments/:id', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  res.json(tournament);
});

app.get('/api/games', (_, res) => {
  res.json(readDatabase().games || []);
});

app.get('/api/games/:id', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

app.post('/api/teams', (req, res) => {
  if (!validateEnum(req.body.league, 'teamLeague')) {
    return res.status(400).json({ error: `聯賽必須是以下之一: ${ENUMS.teamLeague.join(', ')}` });
  }

  const team = {
    id: `t${Date.now()}`,
    name: req.body.name || '未命名球隊',
    shortName: req.body.shortName || 'N/A',
    city: req.body.city || '未設定',
    league: req.body.league,
    stadium: req.body.stadium || '未設定',
  };

  db.prepare('INSERT INTO teams (id, name, shortName, city, league, stadium) VALUES (?, ?, ?, ?, ?, ?)')
    .run(team.id, team.name, team.shortName, team.city, team.league, team.stadium);

  res.status(201).json(team);
});

app.put('/api/teams/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Team not found' });

  const team = {
    ...current,
    name: req.body.name || current.name,
    shortName: req.body.shortName || current.shortName,
    city: req.body.city || current.city,
    league: req.body.league || current.league,
    stadium: req.body.stadium || current.stadium,
  };

  db.prepare('UPDATE teams SET name = ?, shortName = ?, city = ?, league = ?, stadium = ? WHERE id = ?')
    .run(team.name, team.shortName, team.city, team.league, team.stadium, req.params.id);

  res.json(team);
});

app.delete('/api/teams/:id', (req, res) => {
  const result = db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Team not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/players', (req, res) => {
  if (!validateEnum(req.body.position, 'playerPosition')) {
    return res.status(400).json({ error: `守備位置必須是以下之一: ${ENUMS.playerPosition.join(', ')}` });
  }

  const player = {
    id: `p${Date.now()}`,
    name: req.body.name || '未命名球員',
    teamId: req.body.teamId || '',
    position: req.body.position,
    jersey: req.body.jersey || '0',
    battingAverage: Number(req.body.battingAverage || 0),
    ops: Number(req.body.ops || 0),
    hr: Number(req.body.hr || 0),
    rbi: Number(req.body.rbi || 0),
    sb: Number(req.body.sb || 0),
  };

  db.prepare('INSERT INTO players (id, name, teamId, position, jersey, battingAverage, ops, hr, rbi, sb, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(player.id, player.name, player.teamId, player.position, player.jersey, player.battingAverage, player.ops, player.hr, player.rbi, player.sb, 'active');

  res.status(201).json(player);
});

app.put('/api/players/:id', (req, res) => {
  if (req.body.position && !validateEnum(req.body.position, 'playerPosition')) {
    return res.status(400).json({ error: `守備位置必須是以下之一: ${ENUMS.playerPosition.join(', ')}` });
  }

  const current = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Player not found' });

  const player = {
    ...current,
    name: req.body.name || current.name,
    teamId: req.body.teamId || current.teamId,
    position: req.body.position || current.position,
    jersey: req.body.jersey || current.jersey,
    battingAverage: Number(req.body.battingAverage ?? current.battingAverage),
    ops: Number(req.body.ops ?? current.ops),
    hr: Number(req.body.hr ?? current.hr),
    rbi: Number(req.body.rbi ?? current.rbi),
    sb: Number(req.body.sb ?? current.sb),
  };

  db.prepare('UPDATE players SET name = ?, teamId = ?, position = ?, jersey = ?, battingAverage = ?, ops = ?, hr = ?, rbi = ?, sb = ?, status = ? WHERE id = ?')
    .run(player.name, player.teamId, player.position, player.jersey, player.battingAverage, player.ops, player.hr, player.rbi, player.sb, 'active', req.params.id);

  res.json(player);
});

app.delete('/api/players/:id', (req, res) => {
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Player not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/tournaments', (req, res) => {
  if (!validateEnum(req.body.type, 'tournamentType')) {
    return res.status(400).json({ error: `盃賽類型必須是以下之一: ${ENUMS.tournamentType.join(', ')}` });
  }

  const tournament = {
    id: `cup${Date.now()}`,
    name: req.body.name || '新盃賽',
    season: req.body.season || new Date().getFullYear(),
    type: req.body.type,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    status: 'active',
  };

  db.prepare('INSERT INTO tournaments (id, name, season, type, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(tournament.id, tournament.name, tournament.season, tournament.type, tournament.startDate, tournament.endDate, tournament.status);

  res.status(201).json(tournament);
});

app.put('/api/tournaments/:id', (req, res) => {
  if (req.body.type && !validateEnum(req.body.type, 'tournamentType')) {
    return res.status(400).json({ error: `盃賽類型必須是以下之一: ${ENUMS.tournamentType.join(', ')}` });
  }

  const current = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Tournament not found' });

  const tournament = {
    ...current,
    name: req.body.name || current.name,
    season: req.body.season || current.season,
    type: req.body.type || current.type,
  };

  db.prepare('UPDATE tournaments SET name = ?, season = ?, type = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?')
    .run(tournament.name, tournament.season, tournament.type, current.startDate, current.endDate, 'active', req.params.id);

  res.json(tournament);
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
  if (!validateEnum(req.body.status, 'gameStatus')) {
    return res.status(400).json({ error: `比賽狀態必須是以下之一: ${ENUMS.gameStatus.join(', ')}` });
  }

  const game = {
    id: `g${Date.now()}`,
    tournamentId: req.body.tournamentId,
    homeTeamId: req.body.homeTeamId || '',
    awayTeamId: req.body.awayTeamId || '',
    date: req.body.date || new Date().toISOString().slice(0, 10),
    venue: req.body.venue || '未定地點',
    score: req.body.score || '0-0',
    winnerTeamId: req.body.winnerTeamId || '',
    status: req.body.status,
  };

  db.prepare('INSERT INTO games (id, tournamentId, homeTeamId, awayTeamId, date, venue, score, winnerTeamId, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(game.id, game.tournamentId, game.homeTeamId, game.awayTeamId, game.date, game.venue, game.score, game.winnerTeamId, game.status);

  res.status(201).json(game);
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

  const game = {
    ...current,
    tournamentId: req.body.tournamentId || current.tournamentId,
    homeTeamId: req.body.homeTeamId || current.homeTeamId,
    awayTeamId: req.body.awayTeamId || current.awayTeamId,
    date: req.body.date || current.date,
    venue: req.body.venue || current.venue,
    score: req.body.score || current.score,
    winnerTeamId: req.body.winnerTeamId || current.winnerTeamId,
    status: req.body.status || current.status,
  };

  db.prepare('UPDATE games SET tournamentId = ?, homeTeamId = ?, awayTeamId = ?, date = ?, venue = ?, score = ?, winnerTeamId = ?, status = ? WHERE id = ?')
    .run(game.tournamentId, game.homeTeamId, game.awayTeamId, game.date, game.venue, game.score, game.winnerTeamId, game.status, req.params.id);

  res.json(game);
});

app.delete('/api/games/:id', (req, res) => {
  const result = db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Game not found' });
  res.json({ ok: true, deletedId: req.params.id });
});

app.post('/api/reset', (_, res) => {
  db.exec('DELETE FROM games; DELETE FROM tournaments; DELETE FROM players; DELETE FROM teams;');
  seedDatabase();
  res.json({ ok: true, message: 'Demo data reset successfully.' });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Baseball record app running at http://localhost:${PORT}`);
});
