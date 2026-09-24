-- =============================================
-- NFL SURVIVOR POOL — Supabase Schema
-- Pega esto en el SQL Editor de Supabase
-- =============================================

-- Tabla de semanas de la temporada
CREATE TABLE weeks (
  id SERIAL PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE,
  season INTEGER NOT NULL DEFAULT 2024,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de equipos NFL
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('AFC', 'NFC')),
  division TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de partidos
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  week_id INTEGER REFERENCES weeks(id),
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  game_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final')),
  espn_game_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de jugadores (liga)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_alive BOOLEAN DEFAULT TRUE,
  eliminated_week INTEGER,
  total_correct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de picks
CREATE TABLE picks (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  week_id INTEGER REFERENCES weeks(id),
  team_id INTEGER REFERENCES teams(id),
  is_correct BOOLEAN,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, week_id)
);

-- Tabla de chat
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Semanas y equipos son públicos (lectura)
CREATE POLICY "Public read weeks" ON weeks FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);

-- Jugadores: todos ven a todos, solo editas el tuyo
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Insert own player" ON players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own player" ON players FOR UPDATE USING (auth.uid() = user_id);

-- Picks: todos ven todos, solo insertas/editas el tuyo
CREATE POLICY "Public read picks" ON picks FOR SELECT USING (true);
CREATE POLICY "Insert own pick" ON picks FOR INSERT
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));
CREATE POLICY "Update own pick" ON picks FOR UPDATE
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- Chat: todos leen, solo insertas con tu player_id
CREATE POLICY "Public read chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Insert own message" ON chat_messages FOR INSERT
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- =============================================
-- DATOS INICIALES — 32 Equipos NFL
-- =============================================

INSERT INTO teams (name, abbreviation, city, conference, division, primary_color) VALUES
('Cardinals', 'ARI', 'Arizona', 'NFC', 'West', '#97233F'),
('Falcons', 'ATL', 'Atlanta', 'NFC', 'South', '#A71930'),
('Ravens', 'BAL', 'Baltimore', 'AFC', 'North', '#241773'),
('Bills', 'BUF', 'Buffalo', 'AFC', 'East', '#00338D'),
('Panthers', 'CAR', 'Carolina', 'NFC', 'South', '#0085CA'),
('Bears', 'CHI', 'Chicago', 'NFC', 'North', '#0B162A'),
('Bengals', 'CIN', 'Cincinnati', 'AFC', 'North', '#FB4F14'),
('Browns', 'CLE', 'Cleveland', 'AFC', 'North', '#311D00'),
('Cowboys', 'DAL', 'Dallas', 'NFC', 'East', '#003594'),
('Broncos', 'DEN', 'Denver', 'AFC', 'West', '#FB4F14'),
('Lions', 'DET', 'Detroit', 'NFC', 'North', '#0076B6'),
('Packers', 'GB', 'Green Bay', 'NFC', 'North', '#203731'),
('Texans', 'HOU', 'Houston', 'AFC', 'South', '#03202F'),
('Colts', 'IND', 'Indianapolis', 'AFC', 'South', '#002C5F'),
('Jaguars', 'JAX', 'Jacksonville', 'AFC', 'South', '#006778'),
('Chiefs', 'KC', 'Kansas City', 'AFC', 'West', '#E31837'),
('Raiders', 'LV', 'Las Vegas', 'AFC', 'West', '#000000'),
('Chargers', 'LAC', 'Los Angeles', 'AFC', 'West', '#0080C6'),
('Rams', 'LAR', 'Los Angeles', 'NFC', 'West', '#003594'),
('Dolphins', 'MIA', 'Miami', 'AFC', 'East', '#008E97'),
('Vikings', 'MIN', 'Minnesota', 'NFC', 'North', '#4F2683'),
('Patriots', 'NE', 'New England', 'AFC', 'East', '#002244'),
('Saints', 'NO', 'New Orleans', 'NFC', 'South', '#D3BC8D'),
('Giants', 'NYG', 'New York', 'NFC', 'East', '#0B2265'),
('Jets', 'NYJ', 'New York', 'AFC', 'East', '#125740'),
('Eagles', 'PHI', 'Philadelphia', 'NFC', 'East', '#004C54'),
('Steelers', 'PIT', 'Pittsburgh', 'AFC', 'North', '#FFB612'),
('49ers', 'SF', 'San Francisco', 'NFC', 'West', '#AA0000'),
('Seahawks', 'SEA', 'Seattle', 'NFC', 'West', '#002244'),
('Buccaneers', 'TB', 'Tampa Bay', 'NFC', 'South', '#D50A0A'),
('Titans', 'TEN', 'Tennessee', 'AFC', 'South', '#0C2340'),
('Commanders', 'WSH', 'Washington', 'NFC', 'East', '#5A1414');

-- Semanas de la temporada 2024 (ajusta las fechas según necesites)
INSERT INTO weeks (week_number, season, start_date, end_date, is_active) VALUES
(1, 2024, '2024-09-05', '2024-09-09', false),
(2, 2024, '2024-09-12', '2024-09-16', false),
(3, 2024, '2024-09-19', '2024-09-23', false),
(4, 2024, '2024-09-26', '2024-09-30', false),
(5, 2024, '2024-10-03', '2024-10-07', false),
(6, 2024, '2024-10-10', '2024-10-14', false),
(7, 2024, '2024-10-17', '2024-10-21', false),
(8, 2024, '2024-10-24', '2024-10-28', false),
(9, 2024, '2024-10-31', '2024-11-04', false),
(10, 2024, '2024-11-07', '2024-11-11', false),
(11, 2024, '2024-11-14', '2024-11-18', false),
(12, 2024, '2024-11-21', '2024-11-25', false),
(13, 2024, '2024-11-28', '2024-12-02', false),
(14, 2024, '2024-12-05', '2024-12-09', false),
(15, 2024, '2024-12-12', '2024-12-16', false),
(16, 2024, '2024-12-19', '2024-12-23', false),
(17, 2024, '2024-12-26', '2024-12-30', false),
(18, 2024, '2025-01-02', '2025-01-05', false);
