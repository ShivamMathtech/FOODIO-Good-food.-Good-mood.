import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { api, errorMessage, navigate, setCsrf } from './api';
import type { CartItem, MenuItem, User } from './types';
interface AuthResult {
  user: User;
  csrf: string;
}
interface Context {
  user: User | null;
  ready: boolean;
  initError: string;
  demo: boolean;
  cart: CartItem[];
  cartBusy: boolean;
  toast: string;
  notify: (s: string) => void;
  completeAuth: (r: AuthResult) => Promise<void>;
  logout: () => Promise<void>;
  add: (i: MenuItem) => Promise<void>;
  quantity: (id: number, n: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartPlaced: () => void;
  setUser: (u: User) => void;
  retry: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  replaceItem: MenuItem | null;
  setReplaceItem: (i: MenuItem | null) => void;
  replaceCart: () => Promise<void>;
}
const C = createContext<Context | null>(null);
function guestCart(): CartItem[] {
  try {
    const v = JSON.parse(localStorage.getItem('foodio.guest-cart') || '[]');
    return Array.isArray(v)
      ? v
          .filter(
            (i) =>
              Number.isInteger(i.item_id) &&
              i.quantity > 0 &&
              i.quantity <= 20 &&
              typeof i.name === 'string' &&
              typeof i.price === 'number',
          )
          .slice(0, 30)
      : [];
  } catch {
    return [];
  }
}
export function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [initError, setInitError] = useState(''),
    [demo, setDemo] = useState(false),
    [cart, setCart] = useState<CartItem[]>(guestCart),
    [cartBusy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [attempt, setAttempt] = useState(0),
    [cartOpen, setCartOpen] = useState(false),
    [replaceItem, setReplaceItem] = useState<MenuItem | null>(null);
  const busyRef = useRef(false);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let live = true;
    setReady(false);
    setInitError('');
    (async () => {
      try {
        const [auth, config] = await Promise.all([
          api<{ user: User | null; csrf: string | null }>('/auth/me'),
          api<{ demo_mode: boolean }>('/config'),
        ]);
        if (!live) return;
        setCsrf(auth.csrf);
        setUser(auth.user);
        setDemo(config.demo_mode);
        if (auth.user) {
          const r = await api<{ items: CartItem[] }>('/cart');
          if (live) setCart(r.items);
        }
        if (live) setReady(true);
      } catch (e) {
        if (live) setInitError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);
  async function save(next: CartItem[]) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (user)
        await api('/cart', {
          method: 'PUT',
          body: { items: next.map((i) => ({ item_id: i.item_id, quantity: i.quantity })) },
        });
      else {
        try {
          localStorage.setItem('foodio.guest-cart', JSON.stringify(next));
        } catch {
          notify('Browser storage is unavailable; keep this tab open to retain your basket.');
        }
      }
      setCart(next);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function completeAuth(result: AuthResult) {
    setCsrf(result.csrf);
    setUser(result.user);
    try {
      if (cart.length) {
        await api('/cart', {
          method: 'PUT',
          body: { items: cart.map((i) => ({ item_id: i.item_id, quantity: i.quantity })) },
        });
      } else {
        setCart((await api<{ items: CartItem[] }>('/cart')).items);
      }
      localStorage.removeItem('foodio.guest-cart');
    } catch (e) {
      notify(errorMessage(e));
      setCart((await api<{ items: CartItem[] }>('/cart')).items);
    }
    navigate('/');
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setCsrf(null);
    setCart(guestCart());
    navigate('/');
    notify('You have been signed out.');
  }
  async function add(i: MenuItem) {
    if (cart.length && cart[0].restaurant_id !== i.restaurant_id) {
      setReplaceItem(i);
      return;
    }
    const old = cart.find((c) => c.item_id === i.id);
    if (old && old.quantity >= 20) {
      notify('You can add up to 20 of each dish.');
      return;
    }
    try {
      await save(
        old
          ? cart.map((c) => (c.item_id === i.id ? { ...c, quantity: c.quantity + 1 } : c))
          : [...cart, { ...i, item_id: i.id, quantity: 1 }],
      );
      notify(`${i.name} added to your basket.`);
    } catch (e) {
      notify(errorMessage(e));
    }
  }
  async function quantity(id: number, n: number) {
    try {
      await save(
        n === 0
          ? cart.filter((i) => i.item_id !== id)
          : cart.map((i) => (i.item_id === id ? { ...i, quantity: Math.min(20, n) } : i)),
      );
    } catch (e) {
      notify(errorMessage(e));
    }
  }
  async function clearCart() {
    await save([]);
  }
  async function replaceCart() {
    if (!replaceItem) return;
    try {
      await save([{ ...replaceItem, item_id: replaceItem.id, quantity: 1 }]);
      setReplaceItem(null);
      notify('Your basket has been updated.');
    } catch (e) {
      notify(errorMessage(e));
    }
  }
  return (
    <C.Provider
      value={{
        user,
        ready,
        initError,
        demo,
        cart,
        cartBusy,
        toast,
        notify,
        completeAuth,
        logout,
        add,
        quantity,
        clearCart,
        cartPlaced: () => setCart([]),
        setUser,
        retry: () => setAttempt((x) => x + 1),
        cartOpen,
        setCartOpen,
        replaceItem,
        setReplaceItem,
        replaceCart,
      }}
    >
      {children}
    </C.Provider>
  );
}
export function useApp() {
  const value = useContext(C);
  if (!value) throw new Error('App context missing');
  return value;
}
