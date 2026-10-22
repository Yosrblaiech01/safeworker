// ⚠️ COLLE ICI LES VALEURS DE TON SITE WEB (le même projet Supabase = les mêmes comptes)
//
// Où les trouver dans le projet web (industrial-worker-monitor) :
//   - fichier .env        → VITE_SUPABASE_URL  et  VITE_SUPABASE_ANON_KEY (ou VITE_SUPABASE_PUBLISHABLE_KEY)
//   - ou src/integrations/supabase/client.ts (ou src/lib/supabase.ts) → SUPABASE_URL et la clé
// Ou sur supabase.com → ton projet → Project Settings → API → "Project URL" et clé "anon public".

export const SUPABASE_URL = 'https://zbgugxqjguxgpekvkkos.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ3VneHFqZ3V4Z3Bla3Zra29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODEwNjksImV4cCI6MjEwODE1NzA2OX0.tSvHj5FIUy06zYDnGXs6IJmXUm9Bimnm5OGTs3LMTUs';
