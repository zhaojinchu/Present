import { createClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from './config';

if (!supabaseConfigured && !env.mockState) {
  console.warn('[present] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy web/.env.example to web/.env.');
}

export const supabase = createClient(
  supabaseConfigured ? env.supabaseUrl : 'http://localhost:54321',
  supabaseConfigured ? env.supabaseAnonKey : 'anon',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
);

/** Turn a Supabase/Postgres error into one line of user-facing copy. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  const any = e as { message?: string; details?: string; hint?: string; error_description?: string };
  return any.message || any.error_description || any.details || any.hint || 'Something went wrong';
}
