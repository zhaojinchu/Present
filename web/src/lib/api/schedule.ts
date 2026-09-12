// Classes: manual rows go straight to the table under RLS; imports go through import_classes().
import { env } from '../config';
import { supabase } from '../supabase';
import { ClassRow, type ImportClassInput } from '../types';
import { z } from 'zod';

const MOCK_CLASSES: ClassRow[] = [
  { id: 'c1', course_code: '15-122', name: 'Principles of Imperative Computation', location_text: 'GHC 4401', lat: 40.4436, lng: -79.9446, radius_m: 60, tz: 'America/New_York', days_of_week: [1, 3, 5], start_time: '09:30:00', end_time: '10:20:00', term_start: '2026-08-25', term_end: '2026-12-11', exdates: ['2026-09-07'], source: 'ics', ics_uid: 'sio-15122' },
  { id: 'c2', course_code: '21-241', name: 'Matrices and Linear Transformations', location_text: 'DH 2210', lat: null, lng: null, radius_m: null, tz: 'America/New_York', days_of_week: [1, 3, 5], start_time: '11:00:00', end_time: '11:50:00', term_start: '2026-08-25', term_end: '2026-12-11', exdates: [], source: 'ics', ics_uid: 'sio-21241' },
  { id: 'c3', course_code: '76-101', name: 'Interpretation and Argument', location_text: 'BH 255B', lat: null, lng: null, radius_m: null, tz: 'America/New_York', days_of_week: [2, 4], start_time: '14:00:00', end_time: '15:20:00', term_start: null, term_end: null, exdates: [], source: 'manual', ics_uid: null },
];

export async function listMyClasses(): Promise<ClassRow[]> {
  if (env.mockState) return MOCK_CLASSES;
  const { data, error } = await supabase.from('classes').select('*').order('start_time');
  if (error) throw error;
  return z.array(ClassRow).parse(data);
}

export type ClassInput = Omit<ClassRow, 'id' | 'source' | 'ics_uid'>;

export async function saveClass(id: string | null, input: ClassInput): Promise<void> {
  if (env.mockState) return;
  const { data: auth } = await supabase.auth.getUser();
  const row = { ...input, user_id: auth.user?.id };
  const q = id ? supabase.from('classes').update(row).eq('id', id) : supabase.from('classes').insert(row);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteClass(id: string): Promise<void> {
  if (env.mockState) return;
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  unchanged: number;
  retired: number;
  class_count: number;
}

export async function importClasses(rows: ImportClassInput[], replace = false): Promise<ImportResult> {
  if (env.mockState) return { inserted: rows.length, updated: 0, unchanged: 0, retired: 0, class_count: rows.length };
  const { data, error } = await supabase.rpc('import_classes', { p_classes: rows, p_replace: replace });
  if (error) throw error;
  return data as ImportResult;
}

/** Cross-origin .ics links go through the fetch-ics edge function (browsers block them directly). */
export async function fetchIcsText(url: string): Promise<string> {
  const normalized = url.trim().replace(/^webcal:\/\//i, 'https://');
  if (env.mockState) throw new Error('URL import is not available in mock mode');
  const { data, error } = await supabase.functions.invoke<{ text: string }>('fetch-ics', { body: { url: normalized } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error((body as { error?: string } | null)?.error ?? error.message);
  }
  return data!.text;
}
