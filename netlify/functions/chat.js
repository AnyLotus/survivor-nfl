// netlify/functions/chat.js
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

  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado' }) };

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido' }) };

  // GET — últimos 50 mensajes
  if (event.httpMethod === 'GET') {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select(`
        id, message, created_at,
        player:players(display_name, avatar_url, is_alive)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ messages: (messages || []).reverse() }),
    };
  }

  // POST — enviar mensaje
  if (event.httpMethod === 'POST') {
    const { message } = JSON.parse(event.body || '{}');
    if (!message?.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensaje vacío' }) };
    if (message.length > 500) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mensaje muy largo (máx 500 caracteres)' }) };

    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!player) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Jugador no encontrado' }) };

    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert({ player_id: player.id, message: message.trim() })
      .select(`id, message, created_at, player:players(display_name, avatar_url, is_alive)`)
      .single();

    if (error) return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: newMessage }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
};
