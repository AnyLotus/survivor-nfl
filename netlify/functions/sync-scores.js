// netlify/functions/sync-scores.js
// Sincroniza resultados desde la API pública de ESPN
// Llámala con un cron job en Netlify o manualmente

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service key para operaciones admin
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Obtener semana activa
    const { data: activeWeek } = await supabase
      .from('weeks')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!activeWeek) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No active week' }) };
    }

    // Llamar a ESPN API (pública, sin API key)
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${activeWeek.week_number}&seasontype=2&dates=${activeWeek.season}`;
    const response = await fetch(espnUrl);
    const espnData = await response.json();

    const events = espnData.events || [];
    const updates = [];

    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const homeTeamData = competition.competitors?.find(c => c.homeAway === 'home');
      const awayTeamData = competition.competitors?.find(c => c.homeAway === 'away');

      if (!homeTeamData || !awayTeamData) continue;

      const homeAbbr = homeTeamData.team?.abbreviation;
      const awayAbbr = awayTeamData.team?.abbreviation;
      const homeScore = parseInt(homeTeamData.score) || null;
      const awayScore = parseInt(awayTeamData.score) || null;
      const statusType = event.status?.type?.name;

      let gameStatus = 'scheduled';
      if (statusType === 'STATUS_IN_PROGRESS') gameStatus = 'live';
      if (statusType === 'STATUS_FINAL') gameStatus = 'final';

      // Buscar equipos en nuestra DB
      const { data: homeTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('abbreviation', homeAbbr)
        .single();

      const { data: awayTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('abbreviation', awayAbbr)
        .single();

      if (!homeTeam || !awayTeam) continue;

      // Upsert partido
      const { data: game } = await supabase
        .from('games')
        .upsert({
          week_id: activeWeek.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          home_score: homeScore,
          away_score: awayScore,
          game_time: event.date,
          status: gameStatus,
          espn_game_id: event.id,
        }, { onConflict: 'espn_game_id' })
        .select()
        .single();

      // Si el partido terminó, evaluar picks
      if (gameStatus === 'final' && game) {
        await evaluatePicks(game, homeTeam.id, awayTeam.id, homeScore, awayScore, activeWeek.id);
      }

      updates.push({ home: homeAbbr, away: awayAbbr, status: gameStatus });
    }

    // Verificar eliminaciones
    await checkEliminations(activeWeek);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, gamesUpdated: updates.length, updates }),
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

async function evaluatePicks(game, homeTeamId, awayTeamId, homeScore, awayScore, weekId) {
  const winnerTeamId = homeScore > awayScore ? homeTeamId : awayTeamId;

  // Picks de esta semana para estos equipos
  const { data: picks } = await supabase
    .from('picks')
    .select('id, player_id, team_id')
    .eq('week_id', weekId)
    .in('team_id', [homeTeamId, awayTeamId])
    .is('is_correct', null);

  for (const pick of picks || []) {
    const isCorrect = pick.team_id === winnerTeamId;

    await supabase
      .from('picks')
      .update({ is_correct: isCorrect })
      .eq('id', pick.id);

    if (isCorrect) {
      await supabase.rpc('increment_correct', { player_id: pick.player_id });
    }
  }
}

async function checkEliminations(week) {
  // Jugadores vivos sin pick esta semana → eliminados
  const { data: alivePlayers } = await supabase
    .from('players')
    .select('id')
    .eq('is_alive', true);

  const { data: weekPicks } = await supabase
    .from('picks')
    .select('player_id')
    .eq('week_id', week.id);

  const playersWithPick = new Set((weekPicks || []).map(p => p.player_id));

  // Jugadores vivos con pick incorrecto → eliminar
  const { data: wrongPicks } = await supabase
    .from('picks')
    .select('player_id')
    .eq('week_id', week.id)
    .eq('is_correct', false);

  for (const pick of wrongPicks || []) {
    await supabase
      .from('players')
      .update({ is_alive: false, eliminated_week: week.week_number })
      .eq('id', pick.player_id);
  }
}
