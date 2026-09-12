// /settings — name, username, time zone, sign out.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IoCameraOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { setAvatar } from '@/lib/api/profile';
import { updateProfile, usernameAvailable } from '@/lib/api/social';
import { useInvalidateState, useMe, useSession } from '@/lib/appState';
import { env } from '@/lib/config';
import { prefs } from '@/lib/prefs';
import { disablePush, enablePush, pushLabel, pushStatus, type PushStatus } from '@/lib/push';
import { errorMessage, supabase } from '@/lib/supabase';
import { Avatar, Button, ErrorText, Field, Group, Input, ListRow, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function Settings() {
  const me = useMe();
  const { session } = useSession();
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const email = env.mockState ? 'alex@present.demo' : (session?.user.email ?? null);
  // The time zone came from the phone at sign-up; it can be re-read from the phone any time.
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzDiffers = !!me && !!deviceTz && me.tz !== deviceTz;
  const [tzBusy, setTzBusy] = useState(false);
  const useDeviceTz = async () => {
    if (!tzDiffers || tzBusy) return;
    setTzBusy(true);
    try {
      await updateProfile({ tz: deviceTz });
      await invalidate();
      toast(`Time zone set to ${deviceTz.replace(/_/g, ' ')}`);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setTzBusy(false);
    }
  };
  const [push, setPush] = useState<PushStatus>('unsupported');
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    void pushStatus().then(setPush);
  }, []);
  const togglePush = async () => {
    if (pushBusy || push === 'unsupported' || push === 'install' || push === 'denied') return;
    setPushBusy(true);
    try {
      const s = push === 'on' ? await disablePush() : await enablePush();
      setPush(s);
      toast(s === 'on' ? 'Notifications on' : s === 'denied' ? 'Blocked in iPhone Settings' : 'Notifications off');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setPushBusy(false);
    }
  };
  const [name, setName] = useState(me?.display_name ?? '');
  const [username, setUsername] = useState(me?.username ?? '');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const changePhoto = async (file: File) => {
    if (!me) return;
    setPhotoBusy(true);
    setErr(null);
    try {
      const url = await setAvatar(file, me.id);
      setPreview(url);
      await invalidate();
      toast('Photo updated');
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setPhotoBusy(false);
    }
  };

  useEffect(() => {
    if (me) {
      setName(me.display_name);
      setUsername(me.username);
    }
  }, [me]);

  useEffect(() => {
    if (!me || username === me.username) {
      setAvailable(null);
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setAvailable(false);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        setAvailable(env.mockState ? username !== 'sam' : await usernameAvailable(username));
      } catch {
        setAvailable(null);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [username, me]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    setErr(null);
    try {
      await updateProfile({
        display_name: name.trim() !== me.display_name ? name.trim() : undefined,
        username: username !== me.username ? username : undefined,
      });
      await invalidate();
      toast('Saved');
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    prefs.set('skip_schedule', undefined);
    await supabase.auth.signOut();
    navigate('/sign-in', { replace: true });
  };

  const dirty = !!me && (name.trim() !== me.display_name || username !== me.username);
  const usernameError = username !== me?.username && available === false ? (/^[a-z0-9_]{3,20}$/.test(username) ? 'That username is taken' : '3 to 20 letters, numbers or underscores') : null;

  return (
    <Screen>
      <Header title="Settings" left={<BackButton />} />
      <Main>
        <div className="flex items-center gap-4 mt-2 mb-6">
          <Avatar name={me?.display_name ?? '?'} src={preview ?? me?.avatar_url} size={72} />
          <div className="flex flex-col gap-1">
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])} />
            <Button title="Change photo" variant="secondary" size="sm" icon={IoCameraOutline} loading={photoBusy} onClick={() => fileRef.current?.click()} />
            <Txt variant="footnote" tone="tertiary">
              Square, shown to your friends.
            </Txt>
          </div>
        </div>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} autoComplete="name" />
          </Field>
          <Field label="Username" hint={available === true ? `@${username} is available` : undefined} error={usernameError}>
            <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Button type="submit" title="Save" size="lg" loading={busy} disabled={!dirty || !!usernameError} />
          <ErrorText>{err}</ErrorText>
        </form>

        <Txt variant="label" tone="tertiary" className="mt-8 mb-2">
          Notifications
        </Txt>
        <Group>
          <ListRow title={push === 'on' ? 'Notifications are on' : 'Turn on notifications'} subtitle={pushLabel[push]} onClick={push === 'on' || push === 'off' || push === 'prompt' ? togglePush : undefined} chevron={false} trailing={push === 'on' ? <Txt variant="subhead" tone="secondary">Turn off</Txt> : undefined} />
        </Group>
        <Txt variant="footnote" tone="tertiary" className="mt-2">
          A buzz when a class opens, when you miss one, for friend requests, and for comments on your posts.
        </Txt>

        <Txt variant="label" tone="tertiary" className="mt-8 mb-2">
          Account
        </Txt>
        <Group>
          <ListRow title="Signed in as" subtitle={email ?? undefined} chevron={false} />
          <ListRow
            title="Time zone"
            subtitle={me ? (tzDiffers ? `${me.tz.replace(/_/g, ' ')} · this phone is on ${deviceTz.replace(/_/g, ' ')}` : `${me.tz.replace(/_/g, ' ')} · from this phone`) : undefined}
            trailing={tzDiffers ? <Txt variant="subhead" tone="secondary">{tzBusy ? 'Updating' : 'Use phone'}</Txt> : undefined}
            onClick={tzDiffers ? useDeviceTz : undefined}
            chevron={false}
          />
          <ListRow title="Sign out" destructive onClick={signOut} chevron={false} />
        </Group>
        <Txt variant="footnote" tone="tertiary" className="mt-6">
          Photos are visible to friends for 24 hours and kept for you for 30 days. The only location Present stores is a pin per class, set the first time you post on time. Posts never carry coordinates.
        </Txt>
      </Main>
    </Screen>
  );
}
