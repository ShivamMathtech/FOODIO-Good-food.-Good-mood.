import { ReactNode, useEffect, useRef } from 'react';
import {
  Check,
  ChevronLeft,
  Heart,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';
import { api, errorMessage, money, navigate } from '../api';
import { useApp } from '../context';
import type { MenuItem, Restaurant } from '../types';
export function Loading({ label = 'Preparing something good…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h3>Something needs attention</h3>
      <p>{message}</p>
      {retry && (
        <button className="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <ShoppingBag size={32} />
      </div>
      <h2>{title}</h2>
      <p>{detail}</p>
      {children}
    </div>
  );
}
export function Back({
  to = '/',
  children = 'Back to explore',
}: {
  to?: string;
  children?: ReactNode;
}) {
  return (
    <a className="back-link" href={'#' + to}>
      <ChevronLeft size={17} />
      {children}
    </a>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ) || [],
        );
        const first = els[0],
          last = els[els.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Stepper({
  id,
  quantity,
  disabled = false,
}: {
  id: number;
  quantity: number;
  disabled?: boolean;
}) {
  const app = useApp();
  return (
    <div className="stepper">
      <button
        aria-label="Remove one"
        disabled={app.cartBusy || disabled}
        onClick={() => app.quantity(id, quantity - 1)}
      >
        <Minus size={14} />
      </button>
      <span>{quantity}</span>
      <button
        aria-label="Add one"
        disabled={app.cartBusy || disabled || quantity >= 20}
        onClick={() => app.quantity(id, quantity + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function DishCard({ item }: { item: MenuItem }) {
  const app = useApp();
  const inCart = app.cart.find((i) => i.item_id === item.id);
  return (
    <article className={'dish-card' + (!item.available ? ' unavailable' : '')}>
      <a href={'#/restaurant/' + item.restaurant_id} className="dish-image">
        <img src={item.image} alt={item.name} loading="lazy" />
        {!!item.popular && <span className="image-tag">A crowd favorite</span>}
      </a>
      <div className="dish-body">
        <div className="row">
          <span
            className={'diet ' + (item.is_veg ? 'veg' : 'nonveg')}
            title={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'}
          >
            {item.is_veg ? <Leaf size={13} /> : <span>●</span>}
            {item.is_veg ? 'Veg' : 'Non-veg'}
          </span>
          {item.restaurant_name && <small>{item.restaurant_name}</small>}
        </div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="row dish-bottom">
          <strong>{money(item.price)}</strong>
          {!item.available ? (
            <small>Unavailable</small>
          ) : inCart ? (
            <Stepper id={item.id} quantity={inCart.quantity} />
          ) : (
            <button className="add-button" onClick={() => app.add(item)} disabled={app.cartBusy}>
              Add <Plus size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function RestaurantCard({
  restaurant: r,
  saved,
  onFavorite,
}: {
  restaurant: Restaurant;
  saved: boolean;
  onFavorite: (id: number, s: boolean) => void;
}) {
  const { user, notify } = useApp();
  async function favorite() {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await api('/favorites/' + r.id, { method: 'PUT', body: { saved: !saved } });
      onFavorite(r.id, !saved);
    } catch (e) {
      notify(errorMessage(e));
    }
  }
  return (
    <article className="restaurant-card">
      <div className={'restaurant-image tone-' + r.id}>
        <a href={'#/restaurant/' + r.id} aria-label={'View ' + r.name}>
          <img src={r.image} alt={r.name + ' signature food illustration'} loading="lazy" />
        </a>
        <button
          className={'favorite ' + (saved ? 'saved' : '')}
          onClick={favorite}
          aria-label={saved ? 'Remove from favorites' : 'Save restaurant'}
          aria-pressed={saved}
        >
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
        <span className="image-tag">{r.tag}</span>
        {!r.is_open && <span className="closed-label">Closed right now</span>}
      </div>
      <a className="restaurant-body" href={'#/restaurant/' + r.id}>
        <div className="row">
          <h3>{r.name}</h3>
          <span className="rating">
            <Star size={12} fill="currentColor" />
            {r.rating || 'New'}
          </span>
        </div>
        <p>
          {r.cuisine} <span>·</span> {r.eta_min}–{r.eta_min + 10} min
        </p>
        <div className="restaurant-bottom">
          <span>{money(r.delivery_fee)} delivery</span>
          <span>Free over ₹499</span>
        </div>
      </a>
    </article>
  );
}
export function SuccessTick() {
  return (
    <div className="success-tick">
      <Check size={35} />
    </div>
  );
}
