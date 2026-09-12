// Sign-in and sign-up. Sign-up checks the username as you type and records the device time zone.
import { useEffect, useState, type FormEvent } from 'react';
import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';
import { Link, useNavigate } from 'react-router';
import { Main, Screen } from '@/app/AppShell';
import { usernameAvailable } from '@/lib/api/social';
import { env } from '@/lib/config';
import { errorMessage, supabase } from '@/lib/supabase';
import { Button, ErrorText, Icon, Input, Txt, Wordmark } from '@/ui';

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <Main className="safe-top">
        <div className="flex flex-col justify-center min-h-full py-10">
          <Wordmark size={32} />
          <Txt variant="subhead" tone="secondary" className="mt-2 mb-8">
            Show up. Prove it.
          </Txt>
          {children}
        </div>
      </Main>
    </Screen>
  );
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (env.mockState) {
        navigate('/', { replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" title="Sign in" size="lg" loading={busy} className="mt-1" />
        <ErrorText>{err}</ErrorText>
      </form>
      <Txt variant="subhead" tone="secondary" align="center" className="mt-6">
        New here?{' '}
        <Link to="/sign-up" className="font-semibold text-text">
          Create an account
        </Link>
      </Txt>
    </AuthFrame>
  );
}

const USERNAME = /^[a-z0-9_]{3,20}$/;

export function SignUp() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!USERNAME.test(username)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = window.setTimeout(async () => {
      try {
        setAvailable(env.mockState ? !['alex', 'sam', 'priya', 'jordan'].includes(username) : await usernameAvailable(username));
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [username]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (available === false) return;
    setBusy(true);
    setErr(null);
    try {
      if (env.mockState) {
        navigate('/', { replace: true });
        return;
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim(), username, tz } },
      });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  const status = username.length === 0 ? null : !USERNAME.test(username) ? { text: '3 to 20 letters, numbers or underscores', ok: false } : checking ? { text: 'Checking…', ok: null } : available === true ? { text: `@${username} is yours`, ok: true } : available === false ? { text: `@${username} is taken`, ok: false } : null;

  return (
    <AuthFrame>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} required />
        <div className="relative">
          <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} required minLength={3} maxLength={20} className="!pr-11" />
          {status?.ok === true ? <Icon icon={IoCheckmarkCircle} size={22} className="absolute right-4 top-1/2 -translate-y-1/2 text-success" /> : null}
          {status?.ok === false ? <Icon icon={IoCloseCircle} size={22} className="absolute right-4 top-1/2 -translate-y-1/2 text-danger" /> : null}
        </div>
        {status ? (
          <Txt variant="footnote" tone={status.ok === false ? 'danger' : status.ok ? 'success' : 'tertiary'} className="-mt-1">
            {status.text}
          </Txt>
        ) : null}
        <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" autoComplete="new-password" placeholder="Password (6+)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <Button type="submit" title="Create account" size="lg" loading={busy} disabled={available === false || checking} className="mt-1" />
        <ErrorText>{err}</ErrorText>
      </form>
      <Txt variant="subhead" tone="secondary" align="center" className="mt-6">
        Have an account?{' '}
        <Link to="/sign-in" className="font-semibold text-text">
          Sign in
        </Link>
      </Txt>
    </AuthFrame>
  );
}
