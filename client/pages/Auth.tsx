import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Leaf } from 'lucide-react';
import { api, errorMessage } from '../api';
import { useApp } from '../context';
import type { User } from '../types';
export function Auth() {
  const app = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ user: User; csrf: string }>('/auth/' + mode, {
        method: 'POST',
        body: { email, password, ...(mode === 'register' ? { name } : {}) },
      });
      await app.completeAuth(result);
      app.notify(
        mode === 'login'
          ? 'Welcome back. Something delicious awaits.'
          : 'Welcome to FOODIO. Let’s find your favorite.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-art">
        <span className="hero-label">
          <Leaf size={14} /> A FRESH START
        </span>
        <h1>
          Good food.
          <br />
          Great company.
          <br />
          <em>Your kind of day.</em>
        </h1>
        <img src="/images/bowl.svg" alt="Fresh illustrated grain bowl" />
        <p>Your favorite kitchens, all in one happy place.</p>
      </div>
      <div className="auth-form">
        <a className="wordmark" href="#/">
          foodio<span>.</span>
        </a>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Pull up a chair.'}</h1>
        <p>
          {mode === 'login'
            ? 'Your next favorite meal is a sign-in away.'
            : 'A few details, and you’re part of the table.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Full name
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <div className="password-input">
              <input
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 10 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {mode === 'register' && <small>Use at least 10 characters.</small>}
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {app.cart.length > 0 && (
            <p className="hint">Your current basket will be saved to this account.</p>
          )}
          <button className="button full" disabled={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-toggle">
          {mode === 'login' ? 'New around here?' : 'Already at the table?'}{' '}
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        {app.demo && (
          <div className="demo-box">
            <strong>Try the local demo</strong>
            <p>Sample accounts for exploring this application.</p>
            <div className="row">
              <button
                className="button secondary small-button"
                onClick={() => {
                  setMode('login');
                  setEmail('customer@foodio.local');
                  setPassword('Customer@12345');
                }}
              >
                Customer details
              </button>
              <button
                className="button secondary small-button"
                onClick={() => {
                  setMode('login');
                  setEmail('admin@foodio.local');
                  setPassword('Admin@12345');
                }}
              >
                Admin details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
