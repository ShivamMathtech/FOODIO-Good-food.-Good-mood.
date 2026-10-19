import { Component, ErrorInfo, FormEvent, ReactNode, useEffect, useState } from 'react';
import {
  Heart,
  Home as HomeIcon,
  Leaf,
  LogOut,
  MapPin,
  Search,
  ShoppingBag,
  Tag,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react';
import { errorMessage, money, navigate } from './api';
import { useApp } from './context';
import { Cart } from './components/Cart';
import { Empty, ErrorState, Loading, Modal } from './components/ui';
import { Home } from './pages/Home';
import { Restaurant } from './pages/Restaurant';
import { Auth } from './pages/Auth';
import { Checkout } from './pages/Checkout';
import { Orders, OrderDetail } from './pages/Orders';
import { Account } from './pages/Account';
import { Offers } from './pages/Offers';
import { Admin } from './pages/Admin';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Foodio view error', error.message, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <ErrorState
        message="This page could not be displayed. Refresh the application to try again."
        retry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const app = useApp();
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/'),
    [search, setSearch] = useState('');
  useEffect(() => {
    function update() {
      setRoute(window.location.hash.slice(1) || '/');
      app.setCartOpen(false);
    }
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const [path, query] = route.split('?');
  const segments = path.split('/').filter(Boolean);
  const current = segments[0] || 'home';
  const needsAuth = ['checkout', 'orders', 'account', 'favorites', 'admin'].includes(current);
  const isAuth = current === 'auth' || (needsAuth && !app.user);
  const side = !isAuth && ['home', 'restaurant', 'favorites', 'offers'].includes(current);
  const count = app.cart.reduce((s, i) => s + i.quantity, 0);
  function submitSearch(e: FormEvent) {
    e.preventDefault();
    navigate('/?q=' + encodeURIComponent(search));
  }
  function content() {
    if (!app.ready)
      return app.initError ? (
        <ErrorState message={app.initError} retry={app.retry} />
      ) : (
        <Loading label="Opening your favorite kitchens…" />
      );
    if (isAuth) return <Auth />;
    switch (current) {
      case 'home':
        return <Home key="home" initialQuery={new URLSearchParams(query).get('q') || ''} />;
      case 'favorites':
        return <Home key="favorites" favoritesOnly />;
      case 'restaurant':
        return <Restaurant key={segments[1]} id={segments[1] || '0'} />;
      case 'checkout':
        return <Checkout />;
      case 'orders':
        return segments[1] ? <OrderDetail key={segments[1]} id={segments[1]} /> : <Orders />;
      case 'account':
        return <Account />;
      case 'offers':
        return <Offers />;
      case 'admin':
        return app.user?.role === 'admin' ? (
          <Admin />
        ) : (
          <Empty
            title="This is the kitchen’s workspace"
            detail="Sign in with an administrator account to manage orders."
          />
        );
      default:
        return (
          <Empty
            title="This page is off the menu"
            detail="Let’s get you back to something delicious."
          >
            <a className="button" href="#/">
              Back to explore
            </a>
          </Empty>
        );
    }
  }
  const links = [
    ['/', 'Explore', HomeIcon, 'home'],
    ['/offers', 'Offers', Tag, 'offers'],
    ['/favorites', 'Favorites', Heart, 'favorites'],
    ['/orders', 'Orders', ShoppingBag, 'orders'],
  ] as const;
  return (
    <ErrorBoundary>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Foodio home">
          <span className="brand-icon">
            <Leaf size={22} />
          </span>
          <span className="wordmark">
            foodio<span>.</span>
          </span>
        </a>
        <a className="delivery-location" href="#/account">
          <MapPin size={19} />
          <div>
            <small>YOUR FOOD NEIGHBORHOOD</small>
            <strong>
              Bengaluru <span>⌄</span>
            </strong>
          </div>
        </a>
        <form className="header-search" onSubmit={submitSearch}>
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="What sounds good?"
            aria-label="Search food"
          />
        </form>
        <div className="header-actions">
          {app.ready && app.user ? (
            <>
              <a className="profile-button" href="#/account">
                <span className="avatar">{app.user.name.charAt(0).toUpperCase()}</span>
                <span>{app.user.name.split(' ')[0]}</span>
              </a>
              <button
                className="icon-button logout"
                aria-label="Sign out"
                onClick={() => app.logout().catch((e) => app.notify(errorMessage(e)))}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <a className="button small-button" href="#/auth">
              Sign in
            </a>
          )}
          <button
            className="header-cart"
            aria-label={`Open basket, ${count} items`}
            onClick={() => app.setCartOpen(true)}
          >
            <ShoppingBag size={20} />
            <span>{count}</span>
          </button>
        </div>
      </header>
      <nav className="nav-bar" aria-label="Main navigation">
        <div>
          {links.map(([href, label, Icon, key]) => (
            <a
              key={href}
              href={'#' + href}
              className={current === key ? 'active' : ''}
              aria-current={current === key ? 'page' : undefined}
            >
              <Icon size={17} />
              {label}
            </a>
          ))}
          {app.user?.role === 'admin' && (
            <a href="#/admin" className={current === 'admin' ? 'active' : ''}>
              <UtensilsCrossed size={17} />
              Kitchen desk
            </a>
          )}
        </div>
        <span className="nav-message">
          Made for your everyday cravings <span>✦</span>
        </span>
      </nav>
      <div className={'page-shell ' + (side ? 'has-basket' : '')}>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {content()}
        </main>
        {side && app.ready && (
          <div className="sidebar">
            <Cart />
            <div className="sidebar-promise">
              <Leaf size={24} />
              <h3>A fresh kind of food mood.</h3>
              <p>
                Thoughtfully chosen kitchens.
                <br />
                Comfort in every bite.
              </p>
            </div>
          </div>
        )}
      </div>
      <footer>
        <a className="wordmark" href="#/">
          foodio<span>.</span>
        </a>
        <p>Good food. Good mood.</p>
        <span>
          {app.demo
            ? 'Local demo · Sample kitchens and menus'
            : 'Fresh food, thoughtfully delivered'}
        </span>
        <small>Application prepared for Shivam Singh · MathTech</small>
      </footer>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[...links, ['/account', 'Account', UserRound, 'account'] as const].map(
          ([href, label, Icon, key]) => (
            <a key={href} href={'#' + href} className={current === key ? 'active' : ''}>
              <Icon size={20} />
              <span>{label}</span>
            </a>
          ),
        )}
      </nav>
      {side && count > 0 && (
        <button className="mobile-cart-bar" onClick={() => app.setCartOpen(true)}>
          <span>
            <ShoppingBag size={18} />
            {count} items
          </span>
          <strong>
            View basket · {money(app.cart.reduce((s, i) => s + i.price * i.quantity, 0))}
          </strong>
        </button>
      )}
      {app.toast && (
        <div className="toast" role="status">
          <CheckIcon />
          {app.toast}
        </div>
      )}
      {app.cartOpen && (
        <Modal title="A little something delicious" onClose={() => app.setCartOpen(false)}>
          <Cart />
        </Modal>
      )}
      {app.replaceItem && (
        <Modal
          title="Start a fresh basket?"
          onClose={() => !app.cartBusy && app.setReplaceItem(null)}
        >
          <p>
            Your basket is from another kitchen. Adding <strong>{app.replaceItem.name}</strong> will
            replace it with a new basket.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={app.cartBusy}
              onClick={() => app.setReplaceItem(null)}
            >
              Keep my basket
            </button>
            <button className="button" disabled={app.cartBusy} onClick={app.replaceCart}>
              Start new basket
            </button>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}
function CheckIcon() {
  return <span className="toast-dot">✦</span>;
}
