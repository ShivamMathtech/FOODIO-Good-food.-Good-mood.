import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Banknote, Check, LockKeyhole, Tag, Truck } from 'lucide-react';
import { api, ApiError, errorMessage, money, navigate } from '../api';
import { useApp } from '../context';
import { Addresses } from '../components/Addresses';
import { Back, Empty, Loading, Stepper } from '../components/ui';
import type { Order, Quote } from '../types';
export function Checkout() {
  const app = useApp();
  const [selected, setSelected] = useState(0),
    [coupon, setCoupon] = useState(''),
    [code, setCode] = useState(''),
    [note, setNote] = useState(''),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const keyRef = useRef<{ body: string; key: string } | null>(null);
  const items = app.cart.map((i) => ({ item_id: i.item_id, quantity: i.quantity }));
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setError('');
    if (!items.length) return;
    api<Quote>('/checkout/quote', { method: 'POST', body: { items, coupon } })
      .then((q) => {
        if (active) setQuote(q);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [itemsKey, coupon, version]);
  async function place() {
    if (!quote || !selected || busy) return;
    setBusy(true);
    setError('');
    const body = {
      items,
      address_id: selected,
      coupon,
      note,
      payment_method: 'cod',
      accepted_total: quote.total,
    };
    const text = JSON.stringify(body);
    if (!keyRef.current || keyRef.current.body !== text)
      keyRef.current = { body: text, key: crypto.randomUUID() };
    try {
      const r = await api<{ order: Order }>('/orders', {
        method: 'POST',
        body,
        headers: { 'Idempotency-Key': keyRef.current.key },
      });
      app.cartPlaced();
      app.notify('Order placed. Your kitchen will take it from here.');
      navigate('/orders/' + r.order.id);
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === 'PRICE_CHANGED') {
        setQuote(null);
        setVersion((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  }
  if (!app.cart.length)
    return (
      <Empty
        title="Your basket is waiting for a little love"
        detail="Add a favorite dish before checking out."
      >
        <a className="button" href="#/">
          Explore the kitchens
        </a>
      </Empty>
    );
  return (
    <>
      <Back />
      <div className="page-title">
        <span className="overline">ALMOST AT YOUR DOOR</span>
        <h1>Let’s make it delicious.</h1>
        <p>Check your basket, choose an address, and you’re all set.</p>
      </div>
      <div className="checkout-layout">
        <div>
          <section className="panel">
            <Addresses selected={selected} onSelect={setSelected} />
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>
                <Banknote size={20} />
                Payment method
              </h2>
              <Check size={19} className="green" />
            </div>
            <div className="payment-option">
              <strong>Cash on delivery</strong>
              <p>Pay when your order arrives. No online payment is collected.</p>
            </div>
          </section>
          <section className="panel">
            <label>
              Anything we should know?
              <textarea
                maxLength={500}
                rows={3}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Delivery instructions, building access, etc."
              />
            </label>
            <p className="hint">
              For allergies, contact the kitchen directly before ordering. Notes do not guarantee
              allergen-free preparation.
            </p>
          </section>
        </div>
        <div>
          <section className="panel checkout-summary">
            <h2>Your order</h2>
            <p className="muted">{quote?.restaurant.name || 'Fresh from your selected kitchen'}</p>
            <div className="basket-items">
              {(quote?.items || app.cart).map((i) => (
                <div className="basket-item" key={i.item_id}>
                  <img src={i.image} alt="" />
                  <div>
                    <h4>{i.name}</h4>
                    <div className="row">
                      <span>{money(i.price * i.quantity)}</span>
                      <Stepper id={i.item_id} quantity={i.quantity} disabled={busy} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="coupon-form"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(code.trim().toUpperCase());
              }}
            >
              <label>
                <Tag size={17} />
                <input
                  aria-label="Promo code"
                  value={code}
                  maxLength={30}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Have a promo code?"
                  disabled={busy}
                />
              </label>
              <button className="text-button" disabled={busy}>
                Apply
              </button>
            </form>
            {coupon && (
              <div className="coupon-applied">
                <span>{coupon}</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setCoupon('');
                    setCode('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {error && (
              <div className="inline-error" role="alert">
                {error}
                <button className="text-button" onClick={() => setVersion((v) => v + 1)}>
                  Refresh quote
                </button>
              </div>
            )}
            {quote ? (
              <>
                <div className="totals">
                  <div>
                    <span>Food total</span>
                    <span>{money(quote.subtotal)}</span>
                  </div>
                  {!!quote.discount && (
                    <div className="green">
                      <span>Offer savings</span>
                      <span>−{money(quote.discount)}</span>
                    </div>
                  )}
                  <div>
                    <span>Delivery</span>
                    <span>{quote.delivery_fee ? money(quote.delivery_fee) : 'FREE'}</span>
                  </div>
                  <div className="total-final">
                    <strong>To pay</strong>
                    <strong>{money(quote.total)}</strong>
                  </div>
                  <small>Menu prices include applicable taxes. No extra fees at the door.</small>
                </div>
                {!quote.minimum_met && (
                  <p className="inline-error">
                    Add {money(quote.restaurant.min_order - quote.subtotal)} more to meet this
                    kitchen’s minimum.
                  </p>
                )}
                <button
                  className="button full"
                  disabled={busy || app.cartBusy || !selected || !quote.minimum_met}
                  onClick={place}
                >
                  {busy ? 'Placing your order…' : `Place order · ${money(quote.total)}`}
                  <ArrowRight size={16} />
                </button>
                {!selected && <p className="hint">Choose or add a delivery address above.</p>}
                <p className="checkout-safe">
                  <LockKeyhole size={13} />
                  Your order is securely saved.
                </p>
                <div className="delivery-note">
                  <Truck size={21} />
                  <span>
                    Estimated {quote.restaurant.eta_min}–{quote.restaurant.eta_min + 10} minutes
                    after confirmation.
                  </span>
                </div>
              </>
            ) : (
              !error && <Loading label="Checking your total…" />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
