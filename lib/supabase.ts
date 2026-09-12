import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = url.startsWith('http') && anonKey.length > 20;

if (!supabaseConfigured) {
  console.warn(
    '[present] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env and restart with `npx expo start -c`.',
  );
}

export const supabase = createClient(
  supabaseConfigured ? url : 'http://localhost:54321',
  supabaseConfigured ? anonKey : 'anon',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/** Turn a Supabase/Postgres error into one line of user-facing copy. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  const any = e as { message?: string; details?: string; hint?: string };
  return any.message || any.details || any.hint || 'Something went wrong';
}
