// Weekly stats from get_stats(). Mock mode serves numbers derived from the fixture.
import { z } from 'zod';
import { env } from '../config';
import { supabase } from '../supabase';

// ---------------------------------------------------------------- stats

const int = z.number().int();

export const UserStats = z.object({
  id: z.string(),
  username: z.string().optional(),
  display_name: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
  week_on_time: int,
  week_late: int,
  week_missed: int,
  week_excused: int,
  week_total: int,
  week_upcoming: int,
  term_on_time: int,
  term_posted: int,
  term_missed: int,
  term_total: int,
  minutes_in_class: int,
  best_streak: int,
});
export type UserStats = z.infer<typeof UserStats>;

export const StatsState = z.object({
  week_start: z.string(),
  today: z.string(),
  me: UserStats,
  friends: z.array(UserStats),
});
export type StatsState = z.infer<typeof StatsState>;

export async function getStats(): Promise<StatsState> {
  if (env.mockState) {
    const { buildMockState } = await import('@/mock/state');
    const s = buildMockState();
    const friend = (id: string, onTime: number, late: number, missed: number, minutes: number, best: number) => ({
      id,
      username: s.friends.find((f) => f.id === id)?.username,
      display_name: s.friends.find((f) => f.id === id)?.display_name,
      avatar_url: null,
      week_on_time: onTime,
      week_late: late,
      week_missed: missed,
      week_excused: 0,
      week_total: onTime + late + missed,
      week_upcoming: 2,
      term_on_time: onTime * 4,
      term_posted: (onTime + late) * 4,
      term_missed: missed * 3,
      term_total: (onTime + late + missed) * 4,
      minutes_in_class: minutes,
      best_streak: best,
    });
    return {
      week_start: s.today,
      today: s.today,
      me: { ...friend(s.me.id, 7, 1, 0, 1930, 14), username: s.me.username, display_name: s.me.display_name },
      friends: s.friends.map((f, i) => friend(f.id, [8, 6, 4][i] ?? 5, [0, 1, 2][i] ?? 0, [0, 0, 2][i] ?? 0, 1800 - i * 200, f.best_streak)),
    };
  }
  const { data, error } = await supabase.rpc('get_stats');
  if (error) throw error;
  return StatsState.parse(data);
}
