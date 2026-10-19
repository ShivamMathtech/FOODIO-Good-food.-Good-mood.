import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Check,
  ChefHat,
  Clock3,
  Download,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { api, dateTime, errorMessage, money, statusLabel } from '../api';
import { useApp } from '../context';
import { useResource } from '../hooks';
import { Back, Empty, ErrorState, Loading, Modal } from '../components/ui';
import type { Order, Status } from '../types';
export function Orders() {
  const r = useResource<{ orders: Order[] }>('/orders', 10000);
  const [filter, setFilter] = useState('all');
  const rows = (r.data?.orders || []).filter(
    (o) =>
      filter === 'all' ||
      (filter === 'active'
        ? !['delivered', 'cancelled'].includes(o.status)
        : ['delivered', 'cancelled'].includes(o.status)),
  );
  return (
    <>
      <div className="page-title">
        <span className="overline">FROM KITCHEN TO DOORSTEP</span>
        <h1>Your orders.</h1>
        <p>Keep an eye on what’s cooking, or revisit a favorite.</p>
      </div>
      <div className="pills">
        {['all', 'active', 'past'].map((f) => (
          <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All orders' : f === 'active' ? 'In progress' : 'Past orders'}
          </button>
        ))}
      </div>
      {r.loading && !r.data ? (
        <Loading />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.reload} />
      ) : rows.length ? (
        <div className="orders-grid">
          {rows.map((o) => (
            <article className="order-card" key={o.id}>
              <img src={o.restaurant_image} alt="" />
              <div className="order-card-body">
                <div className="row">
                  <span className={'status ' + o.status}>{statusLabel(o.status)}</span>
                  <small>#{o.id.slice(0, 8)}</small>
                </div>
                <h2>{o.restaurant_name}</h2>
                <p>{o.items.map((i) => `${i.quantity} × ${i.name}`).join(' · ')}</p>
                <small>{dateTime(o.created_at)}</small>
                <div className="row order-card-bottom">
                  <strong>{money(o.total)}</strong>
                  <a href={'#/orders/' + o.id}>
                    View order <ArrowRight size={15} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="A delicious story starts here"
          detail="Your orders will appear here once you’ve placed one."
        >
          <a href="#/" className="button">
            Explore the menu
          </a>
        </Empty>
      )}
    </>
  );
}
const steps: { status: Status; title: string; detail: string; icon: typeof ShoppingBag }[] = [
  {
    status: 'placed',
    title: 'Order placed',
    detail: 'Your order has reached the kitchen.',
    icon: ShoppingBag,
  },
  {
    status: 'confirmed',
    title: 'Kitchen confirmed',
    detail: 'The team has accepted your order.',
    icon: Check,
  },
  {
    status: 'preparing',
    title: 'Made with a little love',
    detail: 'Your meal is being freshly prepared.',
    icon: ChefHat,
  },
  {
    status: 'out_for_delivery',
    title: 'On the way',
    detail: 'Your order is out for delivery.',
    icon: Truck,
  },
  {
    status: 'delivered',
    title: 'Enjoy every bite',
    detail: 'Delivered, with payment collected.',
    icon: PackageCheck,
  },
];
export function OrderDetail({ id }: { id: string }) {
  const app = useApp();
  const r = useResource<{ order: Order }>('/orders/' + id, 8000);
  const [cancel, setCancel] = useState(false),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(''),
    [error, setError] = useState('');
  async function cancelOrder() {
    setBusy(true);
    try {
      await api('/orders/' + id + '/cancel', { method: 'POST' });
      setCancel(false);
      r.reload();
      app.notify('Order cancelled. No payment has been collected.');
    } catch (e) {
      app.notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function review(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/orders/' + id + '/review', { method: 'POST', body: { rating, comment } });
      r.reload();
      app.notify('Thanks for sharing your experience.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function receipt(o: Order) {
    const text = `FOODIO ORDER RECEIPT\nOrder: ${o.id}\nPlaced: ${dateTime(o.created_at)}\nKitchen: ${o.restaurant_name}\nStatus: ${statusLabel(o.status)}\n\n${o.items.map((i) => `${i.quantity} x ${i.name} — ${money(i.price * i.quantity)}`).join('\n')}\n\nFood total: ${money(o.subtotal)}\nDiscount: ${money(o.discount)}\nDelivery: ${money(o.delivery_fee)}\nTotal: ${money(o.total)}\nPayment: Cash on delivery — ${o.payment_status}\n\nDelivery to: ${o.address.recipient}\n${o.address.line1}, ${o.address.city} ${o.address.postal_code}\n${o.address.phone}\n\nThis is an order summary, not a tax invoice.`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foodio-' + o.id.slice(0, 8) + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (r.loading && !r.data) return <Loading />;
  if (!r.data) return <ErrorState message={r.error} retry={r.reload} />;
  const o = r.data.order;
  const current = steps.findIndex((s) => s.status === o.status);
  return (
    <>
      <Back to="/orders">All your orders</Back>
      <div className="page-title row">
        <div>
          <span className="overline">ORDER #{o.id.slice(0, 8)}</span>
          <h1>
            {o.status === 'delivered'
              ? 'Hope that hit the spot.'
              : o.status === 'cancelled'
                ? 'Maybe another time.'
                : 'Something good is on its way.'}
          </h1>
          <p>
            {o.restaurant_name} · {dateTime(o.created_at)}
          </p>
        </div>
        <span className={'status ' + o.status}>{statusLabel(o.status)}</span>
      </div>
      {r.error && <p className="inline-error">Tracking update failed: {r.error}</p>}
      <div className="checkout-layout">
        <div>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <Truck size={21} />
                Track your order
              </h2>
              <span className="live-label">
                <span className="little-dot" />
                Updates every 8s
              </span>
            </div>
            {o.status === 'cancelled' ? (
              <div className="cancelled-box">
                <h3>Your order was cancelled</h3>
                <p>No cash payment is due for this order.</p>
              </div>
            ) : (
              <div className="timeline">
                {steps.map((s, i) => {
                  const event = o.events.find((e) => e.status === s.status);
                  const Icon = s.icon;
                  return (
                    <div
                      className={
                        'timeline-step ' +
                        (i <= current ? 'done' : '') +
                        ' ' +
                        (i === current ? 'current' : '')
                      }
                      key={s.status}
                    >
                      <div className="timeline-icon">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.detail}</p>
                        {event && <small>{dateTime(event.created_at)}</small>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="hint">
              <Clock3 size={14} />
              Status changes are recorded by the restaurant team. Delivery estimates are not a live
              GPS location.
            </p>
            {['placed', 'confirmed'].includes(o.status) && (
              <button className="text-button danger-text" onClick={() => setCancel(true)}>
                Cancel this order
              </button>
            )}
          </section>
          <section className="panel">
            <h2>
              <MapPin size={20} />
              Delivery details
            </h2>
            <strong>
              {o.address.recipient} · {o.address.label}
            </strong>
            <p>
              {o.address.line1}
              <br />
              {o.address.city} – {o.address.postal_code}
            </p>
            <p>{o.address.phone}</p>
            {o.note && (
              <p className="hint">
                <strong>Your note:</strong> {o.note}
              </p>
            )}
          </section>
          {o.status === 'delivered' && (
            <section className="panel">
              <h2>A little feedback goes a long way.</h2>
              {o.review ? (
                <>
                  <div className="stars">
                    {'★'.repeat(o.review.rating)}
                    {'☆'.repeat(5 - o.review.rating)}
                  </div>
                  <p>{o.review.comment}</p>
                  <small>Thank you. Your review is now on the restaurant page.</small>
                </>
              ) : (
                <form onSubmit={review}>
                  <p>How was your meal from {o.restaurant_name}?</p>
                  <div className="star-selector" aria-label="Choose rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} stars`}
                        aria-pressed={rating === n}
                        onClick={() => setRating(n)}
                      >
                        <Star fill={n <= rating ? 'currentColor' : 'none'} size={30} />
                      </button>
                    ))}
                  </div>
                  <label>
                    Your review
                    <textarea
                      required
                      minLength={5}
                      maxLength={1000}
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us what you loved…"
                    />
                  </label>
                  {error && <p className="inline-error">{error}</p>}
                  <button className="button" disabled={busy}>
                    Share your review
                  </button>
                </form>
              )}
            </section>
          )}
        </div>
        <div>
          <section className="panel">
            <h2>Order summary</h2>
            {o.items.map((i, n) => (
              <div className="receipt-line" key={n}>
                <span>
                  <b>{i.quantity}×</b> {i.name}
                </span>
                <span>{money(i.price * i.quantity)}</span>
              </div>
            ))}
            <div className="totals">
              <div>
                <span>Food total</span>
                <span>{money(o.subtotal)}</span>
              </div>
              {!!o.discount && (
                <div className="green">
                  <span>Offer {o.coupon_code}</span>
                  <span>−{money(o.discount)}</span>
                </div>
              )}
              <div>
                <span>Delivery</span>
                <span>{o.delivery_fee ? money(o.delivery_fee) : 'FREE'}</span>
              </div>
              <div className="total-final">
                <strong>Total</strong>
                <strong>{money(o.total)}</strong>
              </div>
            </div>
            <div className="payment-option">
              <Banknote size={18} />
              <span>Cash on delivery · {o.payment_status}</span>
            </div>
            <button className="button secondary full" onClick={() => receipt(o)}>
              <Download size={16} />
              Download receipt
            </button>
            <a href={'#/restaurant/' + o.restaurant_id} className="text-button center">
              Back to this kitchen
            </a>
          </section>
        </div>
      </div>
      {cancel && (
        <Modal title="Cancel this order?" onClose={() => !busy && setCancel(false)}>
          <p>Orders can only be cancelled before the kitchen starts preparing them.</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setCancel(false)} disabled={busy}>
              Keep my order
            </button>
            <button className="button danger" onClick={cancelOrder} disabled={busy}>
              {busy ? 'Cancelling…' : 'Yes, cancel order'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
