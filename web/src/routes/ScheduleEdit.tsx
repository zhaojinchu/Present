// /schedule/edit/:classId? — one class, by hand.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { deleteClass, listMyClasses, saveClass } from '@/lib/api/schedule';
import { useInvalidateState, useMe } from '@/lib/appState';
import { errorMessage } from '@/lib/supabase';
import { DOW_SHORT } from '@/lib/time';
import { Button, Chip, ErrorText, Field, Input, useToast } from '@/ui';
import { BackButton } from './_Stub';
import { CLASSES_KEY } from './Schedule';

export default function ScheduleEdit() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const qc = useQueryClient();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const classes = useQuery({ queryKey: CLASSES_KEY, queryFn: listMyClasses, enabled: !!classId });
  const existing = classId ? (classes.data ?? []).find((c) => c.id === classId) : undefined;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState('09:30');
  const [end, setEnd] = useState('10:20');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setCode(existing.course_code);
    setName(existing.name ?? '');
    setLocation(existing.location_text ?? '');
    setDays(existing.days_of_week);
    setStart(existing.start_time.slice(0, 5));
    setEnd(existing.end_time.slice(0, 5));
  }, [existing]);

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    if (days.length === 0) return setErr('Pick at least one day');
    if (end <= start) return setErr('The class ends before it starts');
    setBusy('save');
    setErr(null);
    try {
      await saveClass(classId ?? null, {
        course_code: code.trim(),
        name: name.trim() || null,
        location_text: location.trim() || null,
        lat: existing?.lat ?? null,
        lng: existing?.lng ?? null,
        radius_m: existing?.radius_m ?? null,
        tz: existing?.tz ?? me.tz,
        days_of_week: days,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        term_start: existing?.term_start ?? null,
        term_end: existing?.term_end ?? null,
        exdates: existing?.exdates ?? [],
      });
      await Promise.all([qc.invalidateQueries({ queryKey: CLASSES_KEY }), invalidate()]);
      toast(classId ? 'Saved' : `${code.trim()} added`);
      navigate(-1);
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!classId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setBusy('delete');
    try {
      await deleteClass(classId);
      await Promise.all([qc.invalidateQueries({ queryKey: CLASSES_KEY }), invalidate()]);
      navigate(-1);
    } catch (x) {
      setErr(errorMessage(x));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header title={classId ? 'Class' : 'New class'} left={<BackButton />} />
      <Main>
        <form onSubmit={submit} className="flex flex-col gap-4 mt-2">
          <Field label="Course code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="15-122" required maxLength={32} autoCapitalize="characters" />
          </Field>
          <Field label="Name (optional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Principles of Imperative Computation" maxLength={120} />
          </Field>
          <Field label="Room (optional)" hint="Free text. The first on-time post pins the location.">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="GHC 4401" maxLength={120} />
          </Field>
          <Field label="Days">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip key={d} label={DOW_SHORT[d]} selected={days.includes(d)} onClick={() => toggleDay(d)} />
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Ends">
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </Field>
          </div>
          <Button type="submit" title={classId ? 'Save' : 'Add class'} size="lg" loading={busy === 'save'} disabled={!code.trim() || busy === 'delete'} />
          {classId ? <Button title={confirmDelete ? 'Tap again to delete' : 'Delete class'} variant="destructive" size="lg" loading={busy === 'delete'} disabled={busy === 'save'} onClick={remove} /> : null}
          <ErrorText>{err}</ErrorText>
        </form>
      </Main>
    </Screen>
  );
}
