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
    // Semana activa con sus partidos
    const { data: activeWeek } = await supabase
      .from('weeks')
      .select(`*, games(*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*))`)
      .eq('is_active', true)
      .single();

    // Todos los jugadores con sus picks de esta semana
    const { data: players } = await supabase
      .from('players')
      .select(`
        id, display_name, avatar_url, is_alive, eliminated_week, total_correct,
        picks(
          id, is_correct, submitted_at, week_id,
          team:teams(name, abbreviation, primary_color)
        )
      `)
      .order('is_alive', { ascending: false })
      .order('total_correct', { ascending: false });

    // Equipos ya usados por el usuario autenticado
    let usedTeams = [];
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: player } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (player) {
          const { data: myPicks } = await supabase
            .from('picks')
            .select('team_id')
            .eq('player_id', player.id);
          usedTeams = (myPicks || []).map(p => p.team_id);
        }
      }
    }

    // Todos los equipos
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .order('name');

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
        stats: { alive, eliminated: total - alive, total },
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
