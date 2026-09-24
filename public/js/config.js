// public/js/config.js
// ⚠️  Reemplaza estos valores con los de tu proyecto Supabase
const SUPABASE_URL = 'https://fjzdmeljgmhpeshcchtl.supabase.co';// netlify-ignore
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqemRtZWxqZ21ocGVzaGNjaHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjk5MjMsImV4cCI6MjEwNTg0NTkyM30.GFDiJHZDA7p0mv_WSQRUx56q8-ZzlwdL1AulHdeX6gs';// netlify-ignore
const API_BASE = '/api';

// Cliente Supabase (para auth en el frontend)
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers de auth
async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token || null;
}

async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

async function apiFetch(endpoint, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return res.json();
}

// Colores de equipos
function teamBadge(team, size = 'md') {
  const s = size === 'sm' ? '32px' : '48px';
  const fs = size === 'sm' ? '10px' : '13px';
  return `<span class="team-badge" style="
    background:${team.primary_color};
    width:${s};height:${s};
    font-size:${fs};
    display:inline-flex;align-items:center;justify-content:center;
    border-radius:8px;color:#fff;font-weight:700;
    font-family:'Space Grotesk',sans-serif;
  ">${team.abbreviation}</span>`;
}

// Toast notifications
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}
