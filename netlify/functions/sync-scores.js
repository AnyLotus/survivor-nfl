// netlify/functions/sync-scores.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // Semana activa
    const { data: activeWeek } = await supabase
      .from('weeks')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!activeWeek) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No hay semana activa' }) };
    }

    // ESPN API
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${activeWeek.week_number}`;
    const response = await fetch(espnUrl);
    const espnData = await response.json();
    const events = espnData.events || [];

    let gamesUpdated = 0;
    let picksEvaluated = 0;

    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const homeTeamData = competition.competitors?.find(c => c.homeAway === 'home');
      const awayTeamData = competition.competitors?.find(c => c.homeAway === 'away');
      if (!homeTeamData || !awayTeamData) continue;

      const homeAbbr  = homeTeamData.team?.abbreviation;
      const awayAbbr  = awayTeamData.team?.abbreviation;
      const homeScore = parseInt(homeTeamData.score) || null;
      const awayScore = parseInt(awayTeamData.score) || null;
      const statusType = event.status?.type?.name;

      let gameStatus = 'scheduled';
      if (statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME') gameStatus = 'live';
      if (statusType === 'STATUS_FINAL') gameStatus = 'final';

      // Buscar equipos
      const { data: homeTeam } = await supabase.from('teams').select('id').eq('abbreviation', homeAbbr).single();
      const { data: awayTeam } = await supabase.from('teams').select('id').eq('abbreviation', awayAbbr).single();
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

      gamesUpdated++;

      // Si el partido terminó, evaluar picks
      if (gameStatus === 'final' && game && homeScore !== null && awayScore !== null) {
        const evaluated = await evaluatePicks(game.id, homeTeam.id, awayTeam.id, homeScore, awayScore, activeWeek.id);
        picksEvaluated += evaluated;
      }
    }

    // Verificar si todos los partidos terminaron → eliminar sin pick
    const { data: allGames } = await supabase.from('games').select('status').eq('week_id', activeWeek.id);
    const allDone = allGames?.length > 0 && allGames.every(g => g.status === 'final');

    let eliminated = 0;
    if (allDone) {
      eliminated = await eliminateNoPick(activeWeek);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        gamesUpdated,
        picksEvaluated,
        allGamesDone: allDone,
        eliminatedNoPick: eliminated,
        weekNumber: activeWeek.week_number,
      }),
    };
  } catch (error) {
    console.error('Sync error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

async function evaluatePicks(gameId, homeTeamId, awayTeamId, homeScore, awayScore, weekId) {
  const winnerTeamId = homeScore > awayScore ? homeTeamId : (awayScore > homeScore ? awayTeamId : null);
  if (!winnerTeamId) return 0; // empate (no existe en NFL pero por si acaso)

  const { data: picks } = await supabase
    .from('picks')
    .select('id, player_id, team_id')
    .eq('week_id', weekId)
    .in('team_id', [homeTeamId, awayTeamId])
    .is('is_correct', null);

  for (const pick of picks || []) {
    const isCorrect = pick.team_id === winnerTeamId;
    await supabase.from('picks').update({ is_correct: isCorrect }).eq('id', pick.id);

    // Si perdió → eliminar jugador
    if (!isCorrect) {
      await supabase.from('players').update({
        is_alive: false,
        eliminated_week: (await supabase.from('weeks').select('week_number').eq('id', weekId).single()).data?.week_number
      }).eq('id', pick.player_id);
    } else {
      // Si ganó → sumar correcto
      await supabase.rpc('increment_correct', { player_id: pick.player_id }).catch(() => {});
    }
  }

  return (picks || []).length;
}

async function eliminateNoPick(activeWeek) {
  // Jugadores vivos sin pick esta semana → eliminar
  const { data: alivePlayers } = await supabase.from('players').select('id').eq('is_alive', true);
  const { data: weekPicks } = await supabase.from('picks').select('player_id').eq('week_id', activeWeek.id);

  const playersWithPick = new Set((weekPicks || []).map(p => p.player_id));
  let count = 0;

  for (const player of alivePlayers || []) {
    if (!playersWithPick.has(player.id)) {
      await supabase.from('players').update({
        is_alive: false,
        eliminated_week: activeWeek.week_number
      }).eq('id', player.id);
      count++;
    }
  }

  return count;
}
