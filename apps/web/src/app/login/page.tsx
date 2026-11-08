'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CameraMark } from '@/components/shell';
export default function Login() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  return (
    <main className="login-wrap">
      <div className="login-art">
        <CameraMark />
        <p className="eyebrow">THE PATIENT PURSUIT</p>
        <h1>
          Good things
          <br />
          come to
          <br />
          <em>those who watch.</em>
        </h1>
        <p>Your X100VI. Your price. No rush.</p>
        <span className="login-caption">35 MM EQUIVALENT · ENDLESS POSSIBILITIES</span>
      </div>
      <section className="login-card">
        <p className="eyebrow">X100VI DEAL TRACKER</p>
        <h2>Welcome back.</h2>
        <p className="muted">Sign in to your private deal workspace.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError('');
            const data = new FormData(e.currentTarget);
            try {
              const result = await signIn('credentials', {
                email: data.get('email'),
                password: data.get('password'),
                redirect: false,
                callbackUrl: '/',
              });
              if (result?.ok) {
                router.push('/');
                router.refresh();
              } else
                setError(
                  'Sign-in failed. Check your credentials. Too many attempts? Wait 15 minutes.',
                );
            } catch {
              setError('Sign-in is unavailable. Check the server and database.');
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Owner email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={256}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={pending}>
            {pending ? 'Signing in…' : 'Enter workspace →'}
          </button>
        </form>
        <p className="login-help">
          First run? Provision your owner account with <code>pnpm owner:setup</code> in the app
          directory.
        </p>
      </section>
    </main>
  );
}
