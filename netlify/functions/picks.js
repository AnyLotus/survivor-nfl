// netlify/functions/picks.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Autenticar usuario
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado' }) };

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido' }) };

  // GET — obtener picks del jugador
  if (event.httpMethod === 'GET') {
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Jugador no encontrado' }) };

    const { data: picks, error } = await supabase
      .from('picks')
      .select(`
        id, is_correct, submitted_at,
        week:weeks(week_number, season),
        team:teams(name, abbreviation, city, primary_color)
      `)
      .eq('player_id', player.id)
      .order('week_id', { ascending: true });

    return { statusCode: 200, headers, body: JSON.stringify({ picks: picks || [] }) };
  }

  // POST — hacer un pick
  if (event.httpMethod === 'POST') {
    const { team_id } = JSON.parse(event.body || '{}');
    if (!team_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'team_id requerido' }) };

    const { data: player } = await supabase
      .from('players')
      .select('id, is_alive')
      .eq('user_id', user.id)
      .single();

    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Jugador no encontrado' }) };
    if (!player.is_alive) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ya estás eliminado' }) };

    // Verificar semana activa y no bloqueada
    const { data: activeWeek } = await supabase
      .from('weeks')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!activeWeek) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No hay semana activa' }) };
    if (activeWeek.is_locked) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Los picks están cerrados para esta semana' }) };

    // Verificar que no haya usado este equipo antes
    const { data: previousPick } = await supabase
      .from('picks')
      .select('id')
      .eq('player_id', player.id)
      .eq('team_id', team_id)
      .single();

    if (previousPick) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ya usaste este equipo' }) };

    // Upsert el pick
    const { data: pick, error } = await supabase
      .from('picks')
      .upsert({
        player_id: player.id,
        week_id: activeWeek.id,
        team_id,
        is_correct: null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'player_id,week_id' })
      .select()
      .single();

    if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, pick }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
};
