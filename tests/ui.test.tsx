import { transferableAbortController } from 'node:util';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createApp } from '../server/app.mjs';
import { App } from '../client/App';
import { Provider } from '../client/context';
import { setCsrf } from '../client/api';
const nativeFetch = globalThis.fetch;
let server: any,
  db: any,
  base: string,
  cookie = '',
  csrf = '';
beforeAll(async () => {
  const r = await createApp({ demoMode: true });
  db = r.db;
  server = r.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = async (input: any, init: any = {}) => {
    const url = typeof input === 'string' && input.startsWith('/api') ? base + input : input;
    const bridge = init.signal ? transferableAbortController() : null;
    if (bridge) {
      if (init.signal.aborted) bridge.abort();
      else init.signal.addEventListener('abort', () => bridge.abort(), { once: true });
    }
    const response = await nativeFetch(url, {
      ...init,
      signal: bridge?.signal,
      headers: { ...init.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return response;
  };
  window.scrollTo = vi.fn();
});
afterAll(async () => {
  globalThis.fetch = nativeFetch;
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(resolve));
  }
  db?.close();
});
afterEach(() => cleanup());
beforeEach(() => {
  cookie = '';
  csrf = '';
  setCsrf(null);
  localStorage.clear();
  window.location.hash = '/';
});
function mount() {
  return render(
    <Provider>
      <App />
    </Provider>,
  );
}
async function login(admin = false) {
  window.location.hash = '/auth';
  mount();
  const u = userEvent.setup();
  await screen.findByRole('heading', { name: 'Welcome back.' });
  await u.click(screen.getByRole('button', { name: admin ? 'Admin details' : 'Customer details' }));
  await u.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'What are you craving?' });
  return u;
}

describe('customer interface with the real HTTP API', () => {
  it('lets an administrator create a dish and change its availability', async () => {
    const u = await login(true);
    await u.click(screen.getByRole('link', { name: 'Kitchen desk' }));
    await screen.findByRole('heading', { name: 'A good day in the kitchen.' });
    await u.click(screen.getByRole('button', { name: 'Menu management' }));
    await u.click(screen.getByRole('button', { name: 'Add dish' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a new dish' });
    await u.type(within(dialog).getByRole('textbox', { name: 'Dish name' }), 'Seasonal test bowl');
    await u.type(
      within(dialog).getByRole('textbox', { name: 'Description' }),
      'A colorful seasonal selection of grains and greens.',
    );
    await u.type(
      within(dialog).getByRole('spinbutton', { name: 'Price (₹, tax inclusive)' }),
      '259',
    );
    await u.click(within(dialog).getByRole('button', { name: 'Save dish' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const title = await screen.findByText('Seasonal test bowl');
    const row = title.closest('tr')!;
    await u.click(within(row).getByRole('button', { name: 'Available' }));
    await waitFor(() =>
      expect(
        within(screen.getByText('Seasonal test bowl').closest('tr')!).getByRole('button', {
          name: 'Unavailable',
        }),
      ).toBeTruthy(),
    );
    expect(
      db.prepare('SELECT price,available FROM menu_items WHERE name=?').get('Seasonal test bowl'),
    ).toMatchObject({ price: 25900, available: 0 });
  });

  it('searches menus, filters cuisines, saves favorites and opens a restaurant', async () => {
    const u = await login();
    const search = screen.getByRole('textbox', { name: 'Search restaurants or dishes' });
    await u.type(search, 'pizza');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Kitchens you’ll love/ }).textContent).toContain(
        '1',
      ),
    );
    await u.clear(search);
    await u.click(screen.getByRole('button', { name: 'Indian' }));
    await screen.findByRole('heading', { name: 'Spice Route' });
    await u.click(screen.getByRole('button', { name: 'Save restaurant' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeTruthy(),
    );
    await u.click(screen.getByRole('link', { name: 'View Spice Route' }));
    await screen.findByRole('heading', { name: 'Hyderabadi chicken biryani' });
    await u.click(screen.getByRole('button', { name: 'Veg only' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Hyderabadi chicken biryani' })).toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'Paneer butter masala' })).toBeTruthy();
  });
  it('places an order, confirms totals and renders actual recorded delivery progress', async () => {
    const u = await login();
    const dish = await screen.findByRole('heading', { name: 'Harvest grain bowl' });
    const card = dish.closest('article')!;
    await u.click(within(card).getByRole('button', { name: /Add/ }));
    await screen.findByRole('button', { name: 'Continue to checkout' });
    await u.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    await screen.findByRole('heading', { name: 'Let’s make it delicious.' });
    await screen.findByRole('button', { name: 'Deliver here' });
    await u.type(screen.getByRole('textbox', { name: 'Promo code' }), 'FIRSTBITE');
    await u.click(screen.getByRole('button', { name: 'Apply' }));
    const place = await screen.findByRole('button', { name: /Place order · ₹228.20/ });
    await u.click(place);
    await screen.findByRole('heading', { name: 'Something good is on its way.' });
    expect(screen.getByRole('heading', { name: 'Track your order' })).toBeTruthy();
    const id = window.location.hash.split('/').at(-1)!;
    let response = await nativeFetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@foodio.local', password: 'Admin@12345' }),
    });
    const adminCookie = response.headers.get('set-cookie')!.split(';')[0];
    const admin = (await response.json()).csrf;
    for (const status of ['confirmed', 'preparing', 'out_for_delivery', 'delivered']) {
      response = await nativeFetch(base + '/api/admin/orders/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie, 'X-CSRF-Token': admin },
        body: JSON.stringify({ status }),
      });
      expect(response.status).toBe(200);
    }
    await screen.findByRole('heading', { name: 'Hope that hit the spot.' }, { timeout: 11000 });
    await u.type(
      screen.getByRole('textbox', { name: 'Your review' }),
      'Loved the fresh ingredients and the flavors.',
    );
    await u.click(screen.getByRole('button', { name: 'Share your review' }));
    await screen.findByText('Thank you. Your review is now on the restaurant page.');
    expect(db.prepare('SELECT payment_status FROM orders WHERE id=?').get(id).payment_status).toBe(
      'collected',
    );
  });
  it('keeps a guest basket through sign-in and asks before replacing a kitchen', async () => {
    mount();
    const u = userEvent.setup();
    await screen.findByRole('heading', { name: 'Harvest grain bowl' });
    await u.click(
      within(
        screen.getByRole('heading', { name: 'Harvest grain bowl' }).closest('article')!,
      ).getByRole('button', { name: /Add/ }),
    );
    await u.click(
      within(
        screen.getByRole('heading', { name: 'The classic cheeseburger' }).closest('article')!,
      ).getByRole('button', { name: /Add/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Start a fresh basket?' });
    await u.click(within(dialog).getByRole('button', { name: 'Keep my basket' }));
    expect(JSON.parse(localStorage.getItem('foodio.guest-cart')!)[0].name).toBe(
      'Harvest grain bowl',
    );
    await u.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    await screen.findByRole('heading', { name: 'Welcome back.' });
    await u.click(screen.getByRole('button', { name: 'Customer details' }));
    await u.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'What are you craving?' });
    await waitFor(() =>
      expect(db.prepare('SELECT quantity FROM cart_items WHERE item_id=1').get().quantity).toBe(1),
    );
    expect(localStorage.getItem('foodio.guest-cart')).toBeNull();
  });
});
