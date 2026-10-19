import { FormEvent, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../context';
import { Addresses } from '../components/Addresses';
export function Account() {
  const app = useApp();
  const [name, setName] = useState(app.user?.name || ''),
    [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function profile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: NonNullable<typeof app.user> }>('/profile', {
        method: 'PATCH',
        body: { name },
      });
      app.setUser(r.user);
      app.notify('Profile updated.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { current_password: current, new_password: password },
      });
      setCurrent('');
      setPassword('');
      app.notify('Password updated. Other sessions have been signed out.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <span className="overline">YOUR CORNER OF FOODIO</span>
        <h1>Hello, {app.user?.name.split(' ')[0]}.</h1>
        <p>A few little details for a better ordering experience.</p>
      </div>
      <section className="panel">
        <Addresses />
      </section>
      <div className="account-grid">
        <section className="panel">
          <h2>Your profile</h2>
          <form onSubmit={profile}>
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email address
              <input value={app.user?.email} disabled />
            </label>
            <button className="button" disabled={busy}>
              Save changes
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Change password</h2>
          <form onSubmit={changePassword}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>At least 10 characters.</small>
            </label>
            <button className="button secondary" disabled={busy}>
              Update password
            </button>
          </form>
        </section>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
