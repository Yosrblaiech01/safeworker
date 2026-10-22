import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as cfg from '../config/supabase.config';

// Priorité : fichier src/config/supabase.config.js, sinon .env (EXPO_PUBLIC_…)
const pick = (fromFile, fromEnv) =>
  fromFile && !/VOTRE-PROJET|COLLE_ICI/.test(fromFile) ? fromFile : fromEnv;

export const SUPABASE_URL = (pick(cfg.SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_URL) || '').trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (pick(cfg.SUPABASE_ANON_KEY, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '').trim();

export const isConfigured =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20 && !/VOTRE|COLLE_ICI/.test(SUPABASE_URL + SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn('[SAFE WORKER] Supabase non configuré : remplis src/config/supabase.config.js');
}

export const supabase = createClient(isConfigured ? SUPABASE_URL : 'https://invalid.supabase.co', isConfigured ? SUPABASE_ANON_KEY : 'missing-key-missing-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
