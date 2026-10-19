import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardList,
  IndianRupee,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react';
import { api, dateTime, errorMessage, money, statusLabel } from '../api';
import { useApp } from '../context';
import { useResource } from '../hooks';
import { Empty, ErrorState, Loading, Modal } from '../components/ui';
import type { MenuItem, Offer, Order, Restaurant, Status } from '../types';
interface Overview {
  stats: { total_orders: number; revenue: number; active_orders: number; customers: number };
  orders: Order[];
  restaurants: Restaurant[];
  menu: MenuItem[];
  coupons: Offer[];
}
const nextStatus: Partial<Record<Status, Status>> = {
  placed: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};
export function Admin() {
  const app = useApp();
  const r = useResource<Overview>('/admin/overview', 15000);
  const [tab, setTab] = useState('orders'),
    [filter, setFilter] = useState('active'),
    [restaurantFilter, setRestaurantFilter] = useState(0),
    [editing, setEditing] = useState<MenuItem | 'new' | null>(null),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<{ order: Order; status: Status } | null>(null);
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    try {
      await api(path, { method, body });
      r.reload();
      app.notify('Changes saved.');
      return true;
    } catch (e) {
      app.notify(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function updateStatus() {
    if (!confirmation) return;
    if (
      await mutate('/admin/orders/' + confirmation.order.id + '/status', 'PATCH', {
        status: confirmation.status,
      })
    )
      setConfirmation(null);
  }
  if (r.loading && !r.data) return <Loading />;
  if (!r.data) return <ErrorState message={r.error} retry={r.reload} />;
  const d = r.data;
  const orders = d.orders.filter(
    (o) =>
      filter === 'all' ||
      (filter === 'active' ? !['delivered', 'cancelled'].includes(o.status) : o.status === filter),
  );
  return (
    <>
      <div className="page-title row">
        <div>
          <span className="overline">FOODIO OPERATIONS</span>
          <h1>A good day in the kitchen.</h1>
          <p>Orders, menus, and the little details that keep things moving.</p>
        </div>
        <button className="button secondary small-button" onClick={r.reload}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      {r.error && <p className="inline-error">{r.error}</p>}
      <div className="stats-grid">
        {[
          [ClipboardList, 'Total orders', d.stats.total_orders],
          [Store, 'In progress', d.stats.active_orders],
          [IndianRupee, 'Collected on delivery', money(d.stats.revenue)],
          [Users, 'Customers', d.stats.customers],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Store;
          return (
            <div className="stat" key={String(label)}>
              <I size={20} />
              <span>{String(label)}</span>
              <strong>{String(value)}</strong>
            </div>
          );
        })}
      </div>
      <div className="tab-bar">
        {['orders', 'menu', 'kitchens', 'offers'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'menu'
              ? 'Menu management'
              : t === 'kitchens'
                ? 'Kitchens'
                : t === 'offers'
                  ? 'Offers'
                  : 'Order desk'}
          </button>
        ))}
      </div>
      {tab === 'orders' && (
        <>
          <div className="pills">
            {['active', 'all', 'delivered', 'cancelled'].map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f === 'active' ? 'In progress' : f === 'all' ? 'All orders' : statusLabel(f)}
              </button>
            ))}
          </div>
          {orders.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order / customer</th>
                    <th>Kitchen</th>
                    <th>Items / total</th>
                    <th>Status</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <a href={'#/orders/' + o.id}>#{o.id.slice(0, 8)}</a>
                        <strong>{o.address.recipient}</strong>
                        <small>{dateTime(o.created_at)}</small>
                        <small>{o.address.phone}</small>
                      </td>
                      <td>{o.restaurant_name}</td>
                      <td>
                        <span>{o.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                        <strong>{money(o.total)}</strong>
                      </td>
                      <td>
                        <span className={'status ' + o.status}>{statusLabel(o.status)}</span>
                      </td>
                      <td>
                        {nextStatus[o.status] && (
                          <button
                            className="button small-button"
                            disabled={busy}
                            onClick={() =>
                              setConfirmation({ order: o, status: nextStatus[o.status]! })
                            }
                          >
                            {statusLabel(nextStatus[o.status]!)}
                            <ArrowRight size={14} />
                          </button>
                        )}
                        {['placed', 'confirmed'].includes(o.status) && (
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => setConfirmation({ order: o, status: 'cancelled' })}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="All caught up" detail="Orders will appear here as customers check out." />
          )}
          <p className="hint">
            Showing the 200 most recent orders. Order updates refresh every 15 seconds.
          </p>
        </>
      )}
      {tab === 'menu' && (
        <>
          <div className="section-heading">
            <label className="sort-label">
              <select
                aria-label="Filter menu by kitchen"
                value={restaurantFilter}
                onChange={(e) => setRestaurantFilter(Number(e.target.value))}
              >
                <option value={0}>All kitchens</option>
                {d.restaurants.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button small-button" onClick={() => setEditing('new')}>
              <Plus size={15} />
              Add dish
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Kitchen</th>
                  <th>Price</th>
                  <th>Availability</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {d.menu
                  .filter((i) => !restaurantFilter || i.restaurant_id === restaurantFilter)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="menu-table-item">
                          <img src={i.image} alt="" />
                          <div>
                            <strong>{i.name}</strong>
                            <small>
                              {i.category} · {i.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{i.restaurant_name}</td>
                      <td>{money(i.price)}</td>
                      <td>
                        <button
                          className={'availability ' + (i.available ? 'on' : '')}
                          disabled={busy}
                          onClick={() =>
                            mutate('/admin/menu/' + i.id, 'PUT', {
                              ...i,
                              is_veg: !!i.is_veg,
                              available: !i.available,
                              popular: !!i.popular,
                            })
                          }
                        >
                          {i.available ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={'Edit ' + i.name}
                          onClick={() => setEditing(i)}
                        >
                          <Pencil size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === 'kitchens' && (
        <div className="admin-kitchens">
          {d.restaurants.map((k) => (
            <article className="panel" key={k.id}>
              <img src={k.image} alt="" />
              <h2>{k.name}</h2>
              <p>
                {k.cuisine} · {k.eta_min}–{k.eta_min + 10} min
              </p>
              <button
                disabled={busy}
                className={'button ' + (k.is_open ? 'secondary' : '')}
                onClick={() =>
                  mutate('/admin/restaurants/' + k.id, 'PATCH', { is_open: !k.is_open })
                }
              >
                {k.is_open ? 'Pause ordering' : 'Open kitchen'}
              </button>
              <small>{k.is_open ? 'Accepting orders' : 'Currently closed'}</small>
            </article>
          ))}
        </div>
      )}
      {tab === 'offers' && (
        <div className="offers-grid">
          {d.coupons.map((c) => (
            <article className="offer-card" key={c.code}>
              <h2>{c.code}</h2>
              <p>{c.description}</p>
              <button
                disabled={busy}
                className="button secondary"
                onClick={() => mutate('/admin/coupons/' + c.code, 'PATCH', { active: !c.active })}
              >
                {c.active ? 'Deactivate offer' : 'Activate offer'}
              </button>
              <small>{c.active ? 'Currently available at checkout' : 'Hidden from checkout'}</small>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <MenuForm
          item={editing === 'new' ? null : editing}
          restaurants={d.restaurants}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            r.reload();
          }}
        />
      )}
      {confirmation && (
        <Modal
          title={
            confirmation.status === 'delivered'
              ? 'Confirm delivery & payment'
              : confirmation.status === 'cancelled'
                ? 'Cancel this order?'
                : 'Update order status'
          }
          onClose={() => !busy && setConfirmation(null)}
        >
          <p>
            Order #{confirmation.order.id.slice(0, 8)} · {confirmation.order.restaurant_name}
          </p>
          <p>
            {confirmation.status === 'delivered'
              ? `Confirm that the food was delivered and ${money(confirmation.order.total)} was collected in cash.`
              : `Move this order to “${statusLabel(confirmation.status)}”?`}
          </p>
          <div className="modal-actions">
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              Go back
            </button>
            <button
              disabled={busy}
              className={'button ' + (confirmation.status === 'cancelled' ? 'danger' : '')}
              onClick={updateStatus}
            >
              <Check size={16} />
              {busy ? 'Saving…' : 'Confirm update'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function MenuForm({
  item,
  restaurants,
  onClose,
  onSaved,
}: {
  item: MenuItem | null;
  restaurants: Restaurant[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const app = useApp();
  const [form, setForm] = useState({
    restaurant_id: item?.restaurant_id || restaurants[0].id,
    name: item?.name || '',
    description: item?.description || '',
    category: item?.category || 'Main dishes',
    price: item ? String(item.price / 100) : '',
    image: item?.image || '/images/bowl.svg',
    is_veg: !!item?.is_veg,
    available: item ? !!item.available : true,
    popular: !!item?.popular,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/menu' + (item ? '/' + item.id : ''), {
        method: item ? 'PUT' : 'POST',
        body: { ...form, price: Math.round(Number(form.price) * 100) },
      });
      onSaved();
      app.notify('Menu saved.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={item ? 'Edit menu item' : 'Add a new dish'} onClose={() => !busy && onClose()}>
      <form onSubmit={submit}>
        <label>
          Kitchen
          <select
            value={form.restaurant_id}
            disabled={!!item}
            onChange={(e) => setForm((f) => ({ ...f, restaurant_id: Number(e.target.value) }))}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dish name
          <input
            required
            minLength={2}
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label>
          Description
          <textarea
            required
            minLength={5}
            maxLength={400}
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <div className="form-grid">
          <label>
            Price (₹, tax inclusive)
            <input
              type="number"
              required
              min={1}
              max={10000}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <label>
            Category
            <input
              required
              minLength={2}
              maxLength={40}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Illustration
          <select
            value={form.image}
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
          >
            {['bowl', 'burger', 'pizza', 'curry', 'dessert', 'noodles', 'drink', 'fries'].map(
              (x) => (
                <option value={'/images/' + x + '.svg'} key={x}>
                  {x}
                </option>
              ),
            )}
          </select>
        </label>
        <div className="row check-row">
          {(['is_veg', 'available', 'popular'] as const).map((k) => (
            <label className="check-label" key={k}>
              <input
                type="checkbox"
                checked={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.checked }))}
              />
              {k === 'is_veg' ? 'Vegetarian' : k === 'available' ? 'Available' : 'Featured'}
            </label>
          ))}
        </div>
        {error && <p className="inline-error">{error}</p>}
        <button className="button full" disabled={busy}>
          {busy ? 'Saving…' : 'Save dish'}
        </button>
      </form>
    </Modal>
  );
}
