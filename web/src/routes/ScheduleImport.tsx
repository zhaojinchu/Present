// /schedule/import — a calendar file, pasted text, or a link, reviewed as classes, then imported.
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { IoAdd, IoCalendarOutline, IoCheckmarkCircle, IoDocumentOutline, IoEllipseOutline, IoLinkOutline } from 'react-icons/io5';
import { useNavigate, useSearchParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { fetchIcsText, importClasses } from '@/lib/api/schedule';
import { useInvalidateState, useMe } from '@/lib/appState';
import { looksLikeIcs, looksLikeUrl, parseIcs, toClassDrafts, toImportRows, type ClassDraft, type Skipped } from '@/lib/ics';
import { prefs } from '@/lib/prefs';
import { errorMessage } from '@/lib/supabase';
import { DOW_SHORT, fmtClock, fmtDays } from '@/lib/time';
import { Badge, Button, Chip, cx, ErrorText, Field, Icon, IconBadge, Input, Sheet, Spinner, TextArea, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';
import { CLASSES_KEY } from './Schedule';

type Stage = 'idle' | 'loading' | 'preview' | 'saving';

export default function ScheduleImport() {
  const [params] = useSearchParams();
  const onboarding = params.get('onboarding') === '1';
  const navigate = useNavigate();
  const me = useMe();
  const qc = useQueryClient();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [pasted, setPasted] = useState('');
  const [drafts, setDrafts] = useState<ClassDraft[]>([]);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [editing, setEditing] = useState<ClassDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const next = onboarding ? '/friends?onboarding=1' : '/schedule';

  const ingest = (text: string) => {
    setErr(null);
    const cal = parseIcs(text);
    if (cal.events.length === 0) {
      setErr('No events found in that calendar.');
      setStage('idle');
      return;
    }
    const r = toClassDrafts(cal, me?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setDrafts(r.drafts);
    setSkipped(r.skipped);
    setStage('preview');
  };

  const fromFile = async (file: File) => {
    setStage('loading');
    try {
      ingest(await file.text());
    } catch (e) {
      setErr(errorMessage(e));
      setStage('idle');
    }
  };

  const fromPaste = async () => {
    const text = pasted.trim();
    if (!text) return;
    setStage('loading');
    try {
      if (looksLikeIcs(text)) ingest(text);
      else if (looksLikeUrl(text)) ingest(await fetchIcsText(text));
      else {
        setErr('Paste a calendar link (https or webcal) or the contents of a .ics file.');
        setStage('idle');
      }
    } catch (e) {
      setErr(errorMessage(e));
      setStage('idle');
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await fromFile(f);
  };

  const included = useMemo(() => drafts.filter((d) => d.included), [drafts]);

  const save = async () => {
    setStage('saving');
    setErr(null);
    try {
      const r = await importClasses(toImportRows(drafts));
      await Promise.all([qc.invalidateQueries({ queryKey: CLASSES_KEY }), invalidate()]);
      toast(r.inserted + r.updated > 0 ? `${r.inserted + r.updated} class${r.inserted + r.updated === 1 ? '' : 'es'} imported` : 'Nothing changed');
      navigate(next, { replace: true });
    } catch (e) {
      setErr(errorMessage(e));
      setStage('preview');
    }
  };

  const update = (key: string, patch: Partial<ClassDraft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <Screen>
      <Header title={onboarding ? 'Your schedule' : 'Import schedule'} left={onboarding ? undefined : <BackButton />} />
      <Main padded={false}>
        {stage === 'idle' || stage === 'loading' ? (
          <div className="px-4">
            <div className="flex flex-col items-center text-center mt-4">
              <IconBadge icon={IoCalendarOutline} tone="accent" size={64} />
              <Txt variant="title" className="mt-4">
                {onboarding ? 'Add your classes' : 'Import from your calendar'}
              </Txt>
              <Txt variant="subhead" tone="secondary" className="mt-1 max-w-[320px]">
                Export your schedule from your school's portal or calendar app as a .ics file, or paste its link.
              </Txt>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx('mt-6 rounded-lg border-2 border-dashed p-4 flex flex-col gap-2 transition-colors', dragging ? 'border-accent bg-accent-soft' : 'border-border')}
            >
              <input ref={fileRef} type="file" accept=".ics,text/calendar" className="sr-only" onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
              <Button title="Choose a .ics file" size="lg" icon={IoDocumentOutline} loading={stage === 'loading'} onClick={() => fileRef.current?.click()} />
              <Txt variant="footnote" tone="tertiary" align="center">
                or drop it here
              </Txt>
            </div>

            <Field label="Or paste a calendar link, or the file's contents" hint="Google Calendar: Settings, your calendar, Secret address in iCal format.">
              <TextArea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>
            <Button title="Fetch" variant="secondary" size="lg" icon={IoLinkOutline} className="mt-2" loading={stage === 'loading'} disabled={!pasted.trim()} onClick={fromPaste} />
            <ErrorText>{err}</ErrorText>

            <div className="hairline my-6" />
            <Button title="Add a class by hand" variant="secondary" size="lg" icon={IoAdd} onClick={() => navigate('/schedule/edit')} />
            {onboarding ? (
              <Button
                title="Skip for now"
                variant="tertiary"
                size="lg"
                className="mt-2"
                onClick={() => {
                  prefs.set('skip_schedule', true);
                  navigate(next, { replace: true });
                }}
              />
            ) : null}
            <div className="h-6" />
          </div>
        ) : (
          <>
            <div className="px-4 pt-1 pb-2 flex items-center justify-between">
              <Txt variant="subhead" tone="secondary">
                {included.length} of {drafts.length} selected · tap a row to edit
              </Txt>
              <Button title="Start over" variant="tertiary" size="sm" onClick={() => setStage('idle')} disabled={stage === 'saving'} />
            </div>
            {drafts.map((d, i) => (
              <div key={d.key}>
                {i > 0 ? <div className="hairline mx-4" /> : null}
                <div className="flex items-start gap-3 px-4 py-3">
                  <button type="button" aria-pressed={d.included} aria-label={d.included ? 'Included' : 'Not included'} onClick={() => update(d.key, { included: !d.included })} className="pressable pt-0.5">
                    <Icon icon={d.included ? IoCheckmarkCircle : IoEllipseOutline} size={24} className={d.included ? 'text-accent' : 'text-text-tertiary'} />
                  </button>
                  <button type="button" onClick={() => setEditing(d)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Txt variant="headline" lines={1}>
                          {d.course_code}
                        </Txt>
                        <Txt variant="footnote" tone="secondary" lines={1}>
                          {[d.name, d.location_text].filter(Boolean).join(' · ') || 'No room'}
                        </Txt>
                      </div>
                      <div className="text-right shrink-0">
                        <Txt variant="subhead" tabular>
                          {fmtDays(d.days_of_week)}
                        </Txt>
                        <Txt variant="footnote" tone="secondary" tabular>
                          {fmtClock(`${d.start_time}:00`)} · {d.weeks} wk{d.weeks === 1 ? '' : 's'}
                        </Txt>
                      </div>
                    </div>
                    {d.warnings.length > 0 ? (
                      <Txt variant="footnote" tone="warning" className="mt-1">
                        {d.warnings.join(' · ')}
                      </Txt>
                    ) : null}
                  </button>
                </div>
              </div>
            ))}
            {skipped.length > 0 ? (
              <div className="px-4 pt-3">
                <button type="button" onClick={() => setShowSkipped((s) => !s)} className="text-left">
                  <Txt variant="footnote" tone="tertiary">
                    {skipped.length} event{skipped.length === 1 ? '' : 's'} left out {showSkipped ? '' : '· show'}
                  </Txt>
                </button>
                {showSkipped
                  ? skipped.map((s, i) => (
                      <Txt key={i} variant="footnote" tone="tertiary" lines={1}>
                        {s.summary}: {s.reason}
                      </Txt>
                    ))
                  : null}
              </div>
            ) : null}
            <div className="px-4 mt-6">
              <ErrorText>{err}</ErrorText>
              <Button title={included.length === 0 ? 'Select at least one class' : `Import ${included.length} class${included.length === 1 ? '' : 'es'}`} size="lg" disabled={included.length === 0} loading={stage === 'saving'} onClick={save} />
              <Txt variant="footnote" tone="tertiary" align="center" className="mt-3">
                Import the same calendar again any time; nothing duplicates.
              </Txt>
            </div>
            <div className="h-8" />
          </>
        )}
        {stage === 'loading' ? (
          <div className="flex justify-center py-6">
            <Spinner size={22} className="text-text-tertiary" />
          </div>
        ) : null}
      </Main>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit class">
        {editing ? <DraftEditor draft={editing} onChange={(patch) => { update(editing.key, patch); setEditing({ ...editing, ...patch }); }} onDone={() => setEditing(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

function DraftEditor({ draft, onChange, onDone }: { draft: ClassDraft; onChange: (patch: Partial<ClassDraft>) => void; onDone: () => void }) {
  const toggleDay = (d: number) => {
    const days = draft.days_of_week.includes(d) ? draft.days_of_week.filter((x) => x !== d) : [...draft.days_of_week, d].sort((a, b) => a - b);
    if (days.length > 0) onChange({ days_of_week: days });
  };
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Field label="Course code">
        <Input value={draft.course_code} onChange={(e) => onChange({ course_code: e.target.value.slice(0, 32) })} />
      </Field>
      <Field label="Name">
        <Input value={draft.name ?? ''} onChange={(e) => onChange({ name: e.target.value.slice(0, 120) || null })} placeholder="Optional" />
      </Field>
      <Field label="Room">
        <Input value={draft.location_text ?? ''} onChange={(e) => onChange({ location_text: e.target.value.slice(0, 120) || null })} placeholder="Optional" />
      </Field>
      <Field label="Days">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Chip key={d} label={DOW_SHORT[d]} selected={draft.days_of_week.includes(d)} onClick={() => toggleDay(d)} />
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <Input type="time" value={draft.start_time} onChange={(e) => onChange({ start_time: e.target.value })} />
        </Field>
        <Field label="Ends">
          <Input type="time" value={draft.end_time} onChange={(e) => onChange({ end_time: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Badge label={draft.tz} tone="neutral" />
        <Txt variant="footnote" tone="tertiary">
          {draft.term_start} to {draft.term_end}
          {draft.exdates.length ? ` · ${draft.exdates.length} day${draft.exdates.length === 1 ? '' : 's'} off` : ''}
        </Txt>
      </div>
      <Button title="Done" size="lg" onClick={onDone} disabled={!draft.course_code.trim() || draft.end_time <= draft.start_time} />
    </div>
  );
}
