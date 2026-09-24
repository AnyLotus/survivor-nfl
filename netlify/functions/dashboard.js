// netlify/functions/dashboard.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Semana activa con partidos
    const { data: activeWeek } = await supabase
      .from('weeks')
      .select(`*, games(*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))`)
      .eq('is_active', true)
      .single();

    // Equipos que ya empezaron o terminaron esta semana (bloqueados por hora)
    const now = new Date();
    let lockedTeamIds = [];

    if (activeWeek?.games) {
      const startedGames = activeWeek.games.filter(g => {
        const gameTime = new Date(g.game_time);
        return gameTime <= now; // ya empezó o ya terminó
      });
      startedGames.forEach(g => {
        if (g.home_team_id) lockedTeamIds.push(g.home_team_id);
        if (g.away_team_id) lockedTeamIds.push(g.away_team_id);
      });
    }

    // Todos los jugadores
    const { data: players } = await supabase
      .from('players')
      .select(`
        id, display_name, avatar_url, is_alive, eliminated_week, total_correct,
        picks(id, is_correct, submitted_at, week_id, team:teams(name, abbreviation, primary_color))
      `)
      .order('is_alive', { ascending: false })
      .order('total_correct', { ascending: false });

    // Equipos usados por el usuario autenticado
    let usedTeams = [];
    let myPlayerId = null;

    const token = event.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single();
        if (player) {
          myPlayerId = player.id;
          const { data: myPicks } = await supabase.from('picks').select('team_id').eq('player_id', player.id);
          usedTeams = (myPicks || []).map(p => p.team_id);
        }
      }
    }

    // Todos los equipos
    const { data: teams } = await supabase.from('teams').select('*').order('name');

    const alive = (players || []).filter(p => p.is_alive).length;
    const total = (players || []).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        activeWeek,
        players: players || [],
        teams: teams || [],
        usedTeams,
        lockedTeamIds,  // equipos cuyo partido ya empezó
        myPlayerId,
        stats: { alive, eliminated: total - alive, total },
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
