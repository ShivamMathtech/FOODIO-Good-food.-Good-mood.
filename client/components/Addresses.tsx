import { FormEvent, useEffect, useState } from 'react';
import { Check, Home, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../api';
import { useApp } from '../context';
import { useResource } from '../hooks';
import { Empty, ErrorState, Loading, Modal } from './ui';
import type { Address } from '../types';
export function Addresses({
  selected,
  onSelect,
}: {
  selected?: number;
  onSelect?: (id: number) => void;
}) {
  const app = useApp();
  const r = useResource<{ addresses: Address[] }>('/addresses');
  const [editing, setEditing] = useState<Address | 'new' | null>(null),
    [deleting, setDeleting] = useState<Address | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (onSelect && r.data && !r.data.addresses.find((a) => a.id === selected)) {
      onSelect(r.data.addresses[0]?.id || 0);
    }
  }, [r.data, selected]);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api('/addresses/' + deleting.id, { method: 'DELETE' });
      setDeleting(null);
      r.reload();
      app.notify('Address removed.');
    } catch (e) {
      app.notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>
          <MapPin size={20} /> {onSelect ? 'Deliver to' : 'Saved addresses'}
        </h2>
        <button className="text-button" onClick={() => setEditing('new')}>
          <Plus size={16} />
          Add address
        </button>
      </div>
      {r.loading ? (
        <Loading label="Loading your addresses…" />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : r.data?.addresses.length ? (
        <div className="address-grid">
          {r.data.addresses.map((a) => (
            <article key={a.id} className={'address-card ' + (selected === a.id ? 'selected' : '')}>
              <div className="row">
                <h3>
                  <Home size={16} />
                  {a.label}
                  {!!a.is_default && <span className="mini-badge">Default</span>}
                </h3>
                <div className="row">
                  <button
                    className="icon-button"
                    aria-label={'Edit ' + a.label}
                    onClick={() => setEditing(a)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={'Delete ' + a.label}
                    onClick={() => setDeleting(a)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <strong>{a.recipient}</strong>
              <p>
                {a.line1}
                <br />
                {a.city} – {a.postal_code}
              </p>
              <small>{a.phone}</small>
              {onSelect && (
                <button
                  className={'button small-button ' + (selected === a.id ? '' : 'secondary')}
                  onClick={() => onSelect(a.id)}
                >
                  {selected === a.id ? (
                    <>
                      <Check size={14} />
                      Deliver here
                    </>
                  ) : (
                    'Use this address'
                  )}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Where should we bring your food?" detail="Add an address to get started.">
          <button className="button secondary" onClick={() => setEditing('new')}>
            Add your first address
          </button>
        </Empty>
      )}
      {editing && (
        <AddressForm
          address={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            r.reload();
            onSelect?.(id);
          }}
        />
      )}
      {deleting && (
        <Modal title="Remove this address?" onClose={() => !busy && setDeleting(null)}>
          <p>
            {deleting.line1}, {deleting.city}
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDeleting(null)} disabled={busy}>
              Keep address
            </button>
            <button className="button danger" onClick={remove} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function AddressForm({
  address,
  onClose,
  onSaved,
}: {
  address: Address | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const app = useApp();
  const [form, setForm] = useState({
    label: address?.label || 'Home',
    recipient: address?.recipient || app.user?.name || '',
    phone: address?.phone || '',
    line1: address?.line1 || '',
    city: address?.city || 'Bengaluru',
    postal_code: address?.postal_code || '',
    is_default: !!address?.is_default,
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: number }>('/addresses' + (address ? '/' + address.id : ''), {
        method: address ? 'PUT' : 'POST',
        body: form,
      });
      onSaved(address?.id || r.id);
      app.notify('Address saved.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const field = (key: Exclude<keyof typeof form, 'is_default'>, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <Modal
      title={address ? 'Edit delivery address' : 'Add delivery address'}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Label
            <input
              required
              maxLength={30}
              value={form.label}
              onChange={(e) => field('label', e.target.value)}
              placeholder="Home, Work…"
            />
          </label>
          <label>
            Recipient
            <input
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={form.recipient}
              onChange={(e) => field('recipient', e.target.value)}
            />
          </label>
        </div>
        <label>
          Phone number
          <input
            type="tel"
            required
            autoComplete="tel"
            maxLength={16}
            value={form.phone}
            onChange={(e) => field('phone', e.target.value)}
            placeholder="9876543210"
          />
        </label>
        <label>
          House / apartment, street, area
          <input
            required
            minLength={5}
            maxLength={200}
            autoComplete="street-address"
            value={form.line1}
            onChange={(e) => field('line1', e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            City
            <input
              required
              minLength={2}
              maxLength={80}
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => field('city', e.target.value)}
            />
          </label>
          <label>
            PIN code
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="postal-code"
              value={form.postal_code}
              onChange={(e) => field('postal_code', e.target.value)}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            disabled={!!address?.is_default}
            checked={form.is_default}
            onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
          />
          Make this my default address
        </label>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="button full" disabled={busy}>
          {busy ? 'Saving…' : 'Save address'}
        </button>
      </form>
    </Modal>
  );
}
