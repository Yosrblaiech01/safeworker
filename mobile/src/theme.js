export const COLORS = {
  bg: '#0B0F14',
  surface: '#121821',
  card: '#151C26',
  cardHi: '#1A2330',
  border: 'rgba(255,255,255,0.10)',
  text: '#F2F4F7',
  muted: '#9AA4B2',
  faint: '#8A94A3',
  accent: '#F5A524',
  accentInk: '#1A1206',
  ok: '#38D9A9',
  okText: '#5FE3B8',
  danger: '#FF6B5A',
  dangerText: '#FF8A7A',
  dangerBg: 'rgba(255,107,90,0.12)',
  dangerBorder: 'rgba(255,107,90,0.40)',
};

export const FONTS = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
};

const pad = (n) => String(n).padStart(2, '0');

export const fmtTime = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const fmtHM = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtDuration = (ms) => {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
};

export const fmtAgo = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.floor(m / 60)} h`;
};
