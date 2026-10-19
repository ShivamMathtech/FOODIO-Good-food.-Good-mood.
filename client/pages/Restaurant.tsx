import { useState } from 'react';
import { Clock3, Leaf, Search, Star, Truck } from 'lucide-react';
import { money, dateTime } from '../api';
import { useResource } from '../hooks';
import { Back, DishCard, Empty, ErrorState, Loading } from '../components/ui';
import type { MenuItem, Restaurant as RestaurantType, Review } from '../types';
export function Restaurant({ id }: { id: string }) {
  const r = useResource<{ restaurant: RestaurantType; menu: MenuItem[]; reviews: Review[] }>(
    '/restaurants/' + id,
  );
  const [category, setCategory] = useState('All'),
    [q, setQ] = useState(''),
    [veg, setVeg] = useState(false),
    [tab, setTab] = useState('menu');
  if (r.loading) return <Loading />;
  if (r.error || !r.data) return <ErrorState message={r.error} retry={r.reload} />;
  const { restaurant, menu, reviews } = r.data;
  const rows = menu.filter(
    (i) =>
      (category === 'All' || i.category === category) &&
      (!veg || i.is_veg) &&
      i.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Back />
      <section className="restaurant-hero">
        <img src={restaurant.image} alt={restaurant.name + ' food illustration'} />
        <div>
          <span className="hero-label">
            {restaurant.cuisine} · {restaurant.tag}
          </span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.description}</p>
          <div className="metadata">
            <span>
              <Star size={16} />
              {restaurant.rating
                ? `${restaurant.rating} (${restaurant.review_count} reviews)`
                : 'New kitchen'}
            </span>
            <span>
              <Clock3 size={16} />
              {restaurant.eta_min}–{restaurant.eta_min + 10} min estimate
            </span>
            <span>
              <Truck size={16} />
              {money(restaurant.delivery_fee)} delivery
            </span>
          </div>
          <small>Minimum food total {money(restaurant.min_order)} · Free delivery on ₹499+</small>
          {!restaurant.is_open && (
            <p className="inline-error">
              This kitchen is currently closed. Ordering is unavailable.
            </p>
          )}
        </div>
      </section>
      <div className="tab-bar">
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
          Our menu
        </button>
        <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>
          Customer reviews ({reviews.length})
        </button>
      </div>
      {tab === 'menu' ? (
        <>
          <div className="filters">
            <label className="search-box">
              <Search size={17} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a dish…"
                aria-label="Search this menu"
              />
            </label>
            <button
              aria-pressed={veg}
              className={'filter-chip ' + (veg ? 'selected' : '')}
              onClick={() => setVeg((v) => !v)}
            >
              <Leaf size={16} />
              Veg only
            </button>
          </div>
          <div className="pills">
            {['All', ...new Set(menu.map((i) => i.category))].map((c) => (
              <button
                className={category === c ? 'active' : ''}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="dish-grid">
            {rows.map((i) => (
              <DishCard key={i.id} item={{ ...i, available: i.available && restaurant.is_open }} />
            ))}
          </div>
          {!rows.length && (
            <Empty title="No dishes found" detail="Try another search or category." />
          )}
        </>
      ) : reviews.length ? (
        <div className="reviews">
          {reviews.map((v, n) => (
            <article className="review-card" key={n}>
              <div className="row">
                <strong>{v.name}</strong>
                <span className="rating">
                  <Star size={13} fill="currentColor" />
                  {v.rating}
                </span>
              </div>
              <p>{v.comment}</p>
              <small>{dateTime(v.created_at)} · Verified order</small>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Be the first to share a little love"
          detail="You can leave a review after your order is delivered."
        />
      )}
    </>
  );
}
