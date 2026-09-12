import { supabase } from '../supabase';
import type { Building, ClassInput, ClassRow } from '../types';

export async function listBuildings(): Promise<Building[]> {
  const { data, error } = await supabase.from('buildings').select('*').order('name');
  if (error) throw error;
  return (data as Building[]).filter((b) => b.code !== 'DEMO');
}

export async function listMyClasses(userId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase.from('classes').select('*').eq('user_id', userId).order('start_time');
  if (error) throw error;
  return data as ClassRow[];
}

export async function saveClass(userId: string, input: ClassInput): Promise<ClassRow> {
  const row = {
    user_id: userId,
    course_code: input.course_code.trim(),
    name: input.name?.trim() || null,
    building_code: input.building_code,
    days_of_week: [...input.days_of_week].sort((a, b) => a - b),
    start_time: input.start_time,
    end_time: input.end_time,
  };
  const q = input.id
    ? supabase.from('classes').update(row).eq('id', input.id).select().single()
    : supabase.from('classes').insert(row).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data as ClassRow;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}
