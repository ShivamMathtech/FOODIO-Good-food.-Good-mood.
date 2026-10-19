import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Flame, Leaf, Search, SlidersHorizontal, Tag } from 'lucide-react';
import { api, errorMessage, navigate } from '../api';
import { useApp } from '../context';
import { useResource } from '../hooks';
import { DishCard, Empty, ErrorState, Loading, RestaurantCard } from '../components/ui';
import type { MenuItem, Restaurant } from '../types';
const categories = [
  ['All', 'bowl', 'All cravings'],
  ['Healthy', 'bowl', 'Healthy'],
  ['Burgers', 'burger', 'Burgers'],
  ['Italian', 'pizza', 'Pizza & pasta'],
  ['Indian', 'curry', 'Indian'],
  ['Asian', 'noodles', 'Asian'],
  ['Desserts', 'dessert', 'Sweet treats'],
];
export function Home({
  favoritesOnly = false,
  initialQuery = '',
}: {
  favoritesOnly?: boolean;
  initialQuery?: string;
}) {
  const app = useApp();
  const [category, setCategory] = useState('All'),
    [q, setQ] = useState(initialQuery),
    [debounced, setDebounced] = useState(initialQuery),
    [veg, setVeg] = useState(false),
    [sort, setSort] = useState('recommended'),
    [favorites, setFavorites] = useState<number[]>([]);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (app.user)
      api<{ ids: number[] }>('/favorites')
        .then((r) => setFavorites(r.ids))
        .catch((e) => app.notify(errorMessage(e)));
    else setFavorites([]);
  }, [app.user?.id]);
  const { data, error, loading, reload } = useResource<{ restaurants: Restaurant[] }>(
    `/restaurants?q=${encodeURIComponent(debounced)}&cuisine=${category === 'All' ? '' : category}&veg=${veg}`,
  );
  const popular = useResource<{ items: MenuItem[] }>('/menu/popular');
  const rows = (data?.restaurants || [])
    .filter((r) => !favoritesOnly || favorites.includes(r.id))
    .sort((a, b) =>
      sort === 'fastest'
        ? a.eta_min - b.eta_min
        : sort === 'rating'
          ? (b.rating || 0) - (a.rating || 0)
          : sort === 'delivery'
            ? a.delivery_fee - b.delivery_fee
            : 0,
    );
  const favorite = (id: number, s: boolean) =>
    setFavorites((v) => (s ? [...v, id] : v.filter((x) => x !== id)));
  return (
    <div className="home-page">
      {!favoritesOnly && (
        <>
          <div className="eyebrow">
            <span className="little-dot" /> A little hungry? You’re in the right place.
          </div>
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-label">
                <Leaf size={13} />
                GOOD FOOD. GOOD MOOD.
              </span>
              <h1>
                Your next favorite
                <br />
                meal is <em>right here.</em>
              </h1>
              <p>
                Fresh flavors. Local kitchens.
                <br />
                Something delicious for every kind of day.
              </p>
              <a
                className="button"
                href="#restaurants"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('restaurants')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore the menu <ArrowRight size={17} />
              </a>
              <div className="hero-proof">
                <span>
                  <Clock3 size={14} />
                  Made fresh
                </span>
                <span>
                  <Leaf size={14} />
                  Full of flavor
                </span>
              </div>
            </div>
            <div className="hero-art">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <img
                src="/images/bowl.svg"
                alt="Illustration of a colorful grain bowl with avocado, greens and tomatoes"
              />
              <div className="floating-note">
                <span>Fresh picks</span>
                <strong>
                  for a happier you <span>✦</span>
                </strong>
              </div>
            </div>
          </section>
          <div className="offer-strip">
            <div>
              <div className="offer-icon">
                <Tag size={20} />
              </div>
              <div>
                <strong>A delicious first impression.</strong>
                <p>20% off your first order · up to ₹100 on ₹199+</p>
              </div>
            </div>
            <a href="#/offers">
              FIRSTBITE <ArrowRight size={16} />
            </a>
          </div>
        </>
      )}
      <section className="cravings">
        <div className="section-heading">
          <div>
            <span className="overline">
              {favoritesOnly ? 'YOUR LITTLE BLACK BOOK' : 'FOLLOW YOUR APPETITE'}
            </span>
            <h2>{favoritesOnly ? 'Your favorite kitchens' : 'What are you craving?'}</h2>
          </div>
          {!favoritesOnly && <span className="muted small desktop-only">Good choices ahead.</span>}
        </div>
        <div className="categories">
          {categories.map(([key, img, label]) => (
            <button
              key={key}
              className={'category ' + (category === key ? 'active' : '')}
              onClick={() => setCategory(key)}
            >
              <div>
                <img src={'/images/' + img + '.svg'} alt="" />
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
      <section id="restaurants">
        <div className="section-heading">
          <div>
            <span className="overline">MADE AROUND THE CORNER</span>
            <h2>
              {favoritesOnly ? 'Saved for later' : 'Kitchens you’ll love'}{' '}
              <span className="result-count">{rows.length}</span>
            </h2>
          </div>
          <span className="muted small">Bengaluru collection</span>
        </div>
        <div className="filters">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search restaurants or dishes"
              placeholder="Restaurant, dish, or craving…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            className={'filter-chip ' + (veg ? 'selected' : '')}
            aria-pressed={veg}
            onClick={() => setVeg((v) => !v)}
          >
            <Leaf size={15} />
            Veg options
          </button>
          <label className="sort-label">
            <SlidersHorizontal size={16} />
            <select
              value={sort}
              aria-label="Sort restaurants"
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="fastest">Fastest delivery</option>
              <option value="rating">Highest rated</option>
              <option value="delivery">Lowest delivery fee</option>
            </select>
          </label>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={reload} />
        ) : rows.length ? (
          <div className="restaurant-grid">
            {rows.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                saved={favorites.includes(r.id)}
                onFavorite={favorite}
              />
            ))}
          </div>
        ) : (
          <Empty
            title={favoritesOnly ? 'A home for your favorites' : 'No kitchens found'}
            detail={
              favoritesOnly
                ? 'Tap the heart on a restaurant to save it here.'
                : 'Try a different dish or clear your filters.'
            }
          >
            <button
              className="button secondary"
              onClick={() => {
                setQ('');
                setCategory('All');
                setVeg(false);
                if (favoritesOnly) navigate('/');
              }}
            >
              Explore all kitchens
            </button>
          </Empty>
        )}
      </section>
      {!favoritesOnly && !debounced && category === 'All' && popular.data && (
        <section className="popular-section">
          <div className="section-heading">
            <div>
              <span className="overline">
                <Flame size={13} /> LITTLE DISHES. BIG LOVE.
              </span>
              <h2>Meet the crowd favorites</h2>
            </div>
          </div>
          <div className="dish-grid">
            {popular.data.items.slice(0, 6).map((i) => (
              <DishCard key={i.id} item={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
