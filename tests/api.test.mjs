import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../server/app.mjs';
import { hashPassword, verifyPassword, digest } from '../server/security.mjs';
import { openDatabase } from '../server/db.mjs';

async function fixture(t, options = {}) {
  const { app, db } = await createApp({ demoMode: true, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    db.close();
  });
  return { db, base, client: () => new Client(base) };
}
class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
    this.csrf = '';
  }
  async req(path, method = 'GET', body, headers = {}) {
    const r = await fetch(this.base + '/api' + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    const c = r.headers.get('set-cookie');
    if (c) this.cookie = c.split(';')[0];
    if (d.csrf) this.csrf = d.csrf;
    return { status: r.status, data: d, headers: r.headers };
  }
  async login(admin = false) {
    const r = await this.req('/auth/login', 'POST', {
      email: admin ? 'admin@foodio.local' : 'customer@foodio.local',
      password: admin ? 'Admin@12345' : 'Customer@12345',
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r;
  }
}
const basket = [{ item_id: 1, quantity: 1 }];
async function place(client, items = basket, extras = {}, key = randomUUID()) {
  const addresses = await client.req('/addresses');
  const q = await client.req('/checkout/quote', 'POST', { items, coupon: extras.coupon || '' });
  assert.equal(q.status, 200, JSON.stringify(q.data));
  const body = {
    items,
    address_id: addresses.data.addresses[0].id,
    coupon: '',
    note: 'Leave at the door',
    payment_method: 'cod',
    accepted_total: q.data.total,
    ...extras,
  };
  const r = await client.req('/orders', 'POST', body, { 'Idempotency-Key': key });
  return { ...r, body, key };
}

test('catalog, bundled assets, static build and security headers are served', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  assert.equal((await c.req('/health')).data.status, 'ok');
  const restaurants = await c.req('/restaurants');
  assert.equal(restaurants.data.restaurants.length, 6);
  assert.equal((await c.req('/restaurants?q=hakKa')).data.restaurants[0].name, 'Noodle House');
  assert.equal((await c.req('/restaurants?cuisine=Italian')).data.restaurants.length, 1);
  assert.equal((await c.req('/restaurants/999')).status, 404);
  assert.equal((await c.req('/restaurants/1')).data.menu.length, 5);
  const html = await fetch(f.base + '/');
  assert.equal(html.status, 200);
  assert.match(await html.text(), /FOODIO/);
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(f.base + '/images/bowl.svg')).status, 200);
  assert.equal((await fetch(f.base + '/.env')).status, 404);
  assert.equal((await c.req('/nonexistent')).status, 404);
});

test('registration hashes passwords, sessions use protected cookies and logout invalidates them', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  assert.equal(
    (
      await c.req('/auth/register', 'POST', {
        name: 'New User',
        email: 'new@example.com',
        password: 'short',
      })
    ).status,
    400,
  );
  const r = await c.req('/auth/register', 'POST', {
    name: 'New User',
    email: 'NEW@example.com',
    password: 'LongPass@123',
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, 'new@example.com');
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.match(r.headers.get('set-cookie'), /SameSite=Lax/);
  const u = f.db.prepare('SELECT * FROM users WHERE email=?').get('new@example.com');
  assert.ok(u.password_hash.startsWith('scrypt:'));
  assert.ok(!u.password_hash.includes('LongPass@123'));
  const session = f.db.prepare('SELECT * FROM sessions WHERE user_id=?').get(u.id);
  assert.equal(session.token_hash, digest(c.cookie.split('=')[1]));
  assert.equal(
    (
      await c.req('/auth/register', 'POST', {
        name: 'User',
        email: 'new@example.com',
        password: 'LongPass@123',
      })
    ).status,
    409,
  );
  assert.equal((await c.req('/auth/me')).data.user.id, u.id);
  const oldCookie = c.cookie;
  assert.equal((await c.req('/auth/logout', 'POST')).status, 200);
  c.cookie = oldCookie;
  assert.equal((await c.req('/orders')).status, 401);
});

test('CSRF, cross-origin and administrator authorization checks enforce boundaries', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  assert.equal((await c.req('/orders')).status, 401);
  assert.equal(
    (
      await c.req(
        '/auth/login',
        'POST',
        { email: 'customer@foodio.local', password: 'Customer@12345' },
        { Origin: 'https://evil.example' },
      )
    ).status,
    403,
  );
  await c.login();
  assert.equal((await c.req('/admin/overview')).status, 403);
  assert.equal(
    (await c.req('/cart', 'PUT', { items: basket }, { 'X-CSRF-Token': '' })).status,
    403,
  );
  assert.equal(
    (await c.req('/cart', 'PUT', { items: basket }, { 'Sec-Fetch-Site': 'cross-site' })).status,
    403,
  );
  assert.equal((await c.req('/admin/restaurants/1', 'PATCH', { is_open: false })).status, 403);
});

test('cart persistence and validation reject duplicates, mixed kitchens and invalid quantities', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  await c.login();
  assert.equal((await c.req('/cart', 'PUT', { items: basket })).status, 200);
  assert.equal((await c.req('/cart')).data.items[0].quantity, 1);
  for (const items of [
    [{ item_id: 1, quantity: 0 }],
    [{ item_id: 1, quantity: 21 }],
    [{ item_id: 1, quantity: 1.2 }],
    [
      { item_id: 1, quantity: 1 },
      { item_id: 6, quantity: 1 },
    ],
    [
      { item_id: 1, quantity: 1 },
      { item_id: 1, quantity: 1 },
    ],
  ])
    assert.equal((await c.req('/cart', 'PUT', { items })).status, 400);
  assert.equal(
    (await c.req('/cart')).data.items.length,
    1,
    'invalid updates must preserve the old cart',
  );
  assert.equal((await c.req('/cart', 'PUT', { items: [] })).status, 200);
  assert.equal((await c.req('/cart')).data.items.length, 0);
});

test('addresses enforce ownership and maintain a single default through edits and deletion', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  await c.login();
  const body = {
    label: 'Office',
    recipient: 'Alex Morgan',
    phone: '9876543210',
    line1: '123 Sample Office Road',
    city: 'Bengaluru',
    postal_code: '560001',
    is_default: true,
  };
  const add = await c.req('/addresses', 'POST', body);
  assert.equal(add.status, 201);
  let rows = (await c.req('/addresses')).data.addresses;
  assert.equal(rows.filter((a) => a.is_default).length, 1);
  assert.equal(rows[0].id, add.data.id);
  const stranger = f.client();
  await stranger.req('/auth/register', 'POST', {
    name: 'Other User',
    email: 'other@example.com',
    password: 'LongPass@123',
  });
  assert.equal((await stranger.req('/addresses/' + add.data.id, 'DELETE')).status, 404);
  assert.equal((await stranger.req('/addresses/' + add.data.id, 'PUT', body)).status, 404);
  assert.equal((await c.req('/addresses/' + add.data.id, 'DELETE')).status, 200);
  rows = (await c.req('/addresses')).data.addresses;
  assert.equal(rows.filter((a) => a.is_default).length, 1);
  assert.equal((await c.req('/addresses', 'POST', { ...body, postal_code: 'bad' })).status, 400);
});

test('checkout uses authoritative integer prices, coupon limits and a delivery threshold', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  await c.login();
  const q = (
    await c.req('/checkout/quote', 'POST', {
      items: [
        { item_id: 1, quantity: 1 },
        { item_id: 5, quantity: 1 },
      ],
      coupon: 'firstbite',
    })
  ).data;
  assert.equal(q.subtotal, 33800);
  assert.equal(q.discount, 6760);
  assert.equal(q.delivery_fee, 2900);
  assert.equal(q.total, 29940);
  const q2 = (
    await c.req('/checkout/quote', 'POST', {
      items: [{ item_id: 1, quantity: 3 }],
      coupon: 'FIRSTBITE',
    })
  ).data;
  assert.equal(q2.discount, 10000);
  assert.equal(q2.delivery_fee, 0);
  assert.equal(q2.total, 64700);
  assert.equal(
    (await c.req('/checkout/quote', 'POST', { items: basket, coupon: 'unknown' })).status,
    400,
  );
  assert.equal(
    (
      await c.req('/checkout/quote', 'POST', {
        items: [{ item_id: 5, quantity: 1 }],
        coupon: 'FIRSTBITE',
      })
    ).status,
    400,
  );
  const invalid = await place(c, basket, { accepted_total: 1 });
  assert.equal(invalid.status, 409);
  assert.equal(invalid.data.code, 'PRICE_CHANGED');
  assert.equal(f.db.prepare('SELECT count(*) n FROM orders').get().n, 0);
  const belowMin = await place(c, [{ item_id: 5, quantity: 1 }]);
  assert.equal(belowMin.status, 400);
});

test('orders are atomic and idempotent, snapshot addresses and prices, and enforce first-order coupons', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  await c.login();
  await c.req('/cart', 'PUT', { items: basket });
  const r = await place(c, basket, { coupon: 'FIRSTBITE' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const id = r.data.order.id;
  const retry = await c.req('/orders', 'POST', r.body, { 'Idempotency-Key': r.key });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.reused, true);
  assert.equal(retry.data.order.id, id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM orders').get().n, 1);
  assert.equal((await c.req('/cart')).data.items.length, 0);
  assert.equal(
    (
      await c.req(
        '/orders',
        'POST',
        { ...r.body, note: 'Changed request' },
        { 'Idempotency-Key': r.key },
      )
    ).status,
    409,
  );
  assert.equal(
    (await c.req('/checkout/quote', 'POST', { items: basket, coupon: 'FIRSTBITE' })).status,
    400,
  );
  f.db.prepare('UPDATE menu_items SET price=99999 WHERE id=1').run();
  f.db
    .prepare("UPDATE addresses SET line1='Changed address' WHERE user_id=?")
    .run(r.data.order.user_id);
  const snapshot = (await c.req('/orders/' + id)).data.order;
  assert.equal(snapshot.items[0].price, 24900);
  assert.notEqual(snapshot.address.line1, 'Changed address');
  assert.equal(snapshot.request_hash, undefined);
  assert.equal(snapshot.idempotency_key, undefined);
});

test('full order lifecycle: authorization, state transitions, COD collection and verified reviews', async (t) => {
  const f = await fixture(t);
  const c = f.client(),
    admin = f.client(),
    other = f.client();
  await c.login();
  await admin.login(true);
  await other.req('/auth/register', 'POST', {
    name: 'Other User',
    email: 'other@example.com',
    password: 'LongPass@123',
  });
  const r = await place(c);
  assert.equal(r.status, 201);
  const id = r.data.order.id;
  assert.equal((await other.req('/orders/' + id)).status, 404);
  assert.equal((await other.req('/orders/' + id + '/cancel', 'POST')).status, 404);
  assert.equal(
    (await c.req('/orders/' + id + '/review', 'POST', { rating: 5, comment: 'Loved the food.' }))
      .status,
    400,
  );
  assert.equal(
    (await admin.req('/admin/orders/' + id + '/status', 'PATCH', { status: 'delivered' })).status,
    409,
  );
  for (const status of ['confirmed', 'preparing', 'out_for_delivery', 'delivered']) {
    const u = await admin.req('/admin/orders/' + id + '/status', 'PATCH', { status });
    assert.equal(u.status, 200, JSON.stringify(u.data));
    assert.equal(u.data.order.status, status);
    if (status === 'preparing')
      assert.equal((await c.req('/orders/' + id + '/cancel', 'POST')).status, 409);
  }
  const finished = (await c.req('/orders/' + id)).data.order;
  assert.equal(finished.events.length, 5);
  assert.equal(finished.payment_status, 'collected');
  assert.equal(
    (await admin.req('/admin/orders/' + id + '/status', 'PATCH', { status: 'preparing' })).status,
    409,
  );
  assert.equal(
    (
      await c.req('/orders/' + id + '/review', 'POST', {
        rating: 5,
        comment: 'Fresh and delicious.',
      })
    ).status,
    201,
  );
  assert.equal(
    (await c.req('/orders/' + id + '/review', 'POST', { rating: 4, comment: 'Duplicate review.' }))
      .status,
    409,
  );
  const restaurant = (await c.req('/restaurants/1')).data;
  assert.equal(restaurant.restaurant.rating, 5);
  assert.equal(restaurant.reviews.length, 1);
  const overview = (await admin.req('/admin/overview')).data;
  assert.equal(overview.stats.revenue, finished.total);
  assert.equal(overview.stats.active_orders, 0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM admin_audit').get().n, 4);
});

test('early cancellations stop fulfillment and permit an unused first-order offer', async (t) => {
  const f = await fixture(t);
  const c = f.client(),
    a = f.client();
  await c.login();
  await a.login(true);
  const r = await place(c, basket, { coupon: 'FIRSTBITE' });
  const id = r.data.order.id;
  assert.equal(
    (await c.req('/orders/' + id + '/cancel', 'POST')).data.order.payment_status,
    'cancelled',
  );
  assert.equal((await c.req('/orders/' + id + '/cancel', 'POST')).status, 409);
  assert.equal(
    (await a.req('/admin/orders/' + id + '/status', 'PATCH', { status: 'confirmed' })).status,
    409,
  );
  assert.equal(
    (await c.req('/checkout/quote', 'POST', { items: basket, coupon: 'FIRSTBITE' })).status,
    200,
  );
});

test('inventory and kitchen changes immediately affect ordering and retain audit records', async (t) => {
  const f = await fixture(t);
  const c = f.client(),
    admin = f.client();
  await c.login();
  await admin.login(true);
  const menu = (await c.req('/restaurants/1')).data.menu[0];
  const updated = { ...menu, is_veg: !!menu.is_veg, available: false, popular: !!menu.popular };
  assert.equal((await admin.req('/admin/menu/' + menu.id, 'PUT', updated)).status, 200);
  assert.equal(
    (await c.req('/checkout/quote', 'POST', { items: [{ item_id: menu.id, quantity: 1 }] })).status,
    409,
  );
  updated.available = true;
  updated.price = 29900;
  await admin.req('/admin/menu/' + menu.id, 'PUT', updated);
  const newItem = await admin.req('/admin/menu', 'POST', { ...updated, name: 'New seasonal bowl' });
  assert.equal(newItem.status, 201);
  assert.equal((await admin.req('/admin/restaurants/1', 'PATCH', { is_open: false })).status, 200);
  assert.equal((await c.req('/cart', 'PUT', { items: basket })).status, 409);
  await admin.req('/admin/restaurants/1', 'PATCH', { is_open: true });
  await admin.req('/admin/coupons/FRESH10', 'PATCH', { active: false });
  assert.equal((await c.req('/offers')).data.offers.length, 1);
  assert.equal(
    (
      await c.req('/checkout/quote', 'POST', {
        items: [{ item_id: 1, quantity: 2 }],
        coupon: 'FRESH10',
      })
    ).status,
    400,
  );
});

test('favorites and profile changes persist; password changes revoke other sessions', async (t) => {
  const f = await fixture(t);
  const c = f.client(),
    second = f.client();
  await c.login();
  await second.login();
  assert.equal((await c.req('/favorites/2', 'PUT', { saved: true })).status, 200);
  assert.deepEqual((await c.req('/favorites')).data.ids, [2]);
  await c.req('/favorites/2', 'PUT', { saved: false });
  assert.deepEqual((await c.req('/favorites')).data.ids, []);
  assert.equal(
    (await c.req('/profile', 'PATCH', { name: 'Alex Updated' })).data.user.name,
    'Alex Updated',
  );
  assert.equal(
    (
      await c.req('/auth/password', 'POST', {
        current_password: 'bad',
        new_password: 'UpdatedPass@123',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.req('/auth/password', 'POST', {
        current_password: 'Customer@12345',
        new_password: 'UpdatedPass@123',
      })
    ).status,
    200,
  );
  assert.equal((await second.req('/orders')).status, 401);
  assert.equal((await c.req('/orders')).status, 200);
  assert.equal(
    (
      await second.req('/auth/login', 'POST', {
        email: 'customer@foodio.local',
        password: 'UpdatedPass@123',
      })
    ).status,
    200,
  );
});

test('authentication throttles repeated attempts and expired sessions are rejected', async (t) => {
  const f = await fixture(t);
  const c = f.client();
  await c.login();
  f.db.prepare('UPDATE sessions SET expires_at=0').run();
  assert.equal((await c.req('/orders')).status, 401);
  const bad = f.client();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await bad.req('/auth/login', 'POST', {
          email: 'missing@example.com',
          password: 'incorrect',
        })
      ).status,
      401,
    );
  assert.equal(
    (await bad.req('/auth/login', 'POST', { email: 'missing@example.com', password: 'incorrect' }))
      .status,
    429,
  );
});

test('SQLite migrations and records survive a fresh database connection', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'foodio-persist-'));
  try {
    const path = join(dir, 'test.sqlite');
    let db = openDatabase(path);
    db.prepare(
      "INSERT INTO users(name,email,password_hash) VALUES('Persisted','persist@example.com',?)",
    ).run(await hashPassword('TestPass@123'));
    const migrationCount = db.prepare('SELECT count(*) n FROM schema_migrations').get().n;
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT name FROM users').get().name, 'Persisted');
    assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n, migrationCount);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('non-demo setup creates no sample users; secure-cookie mode marks sessions secure', async (t) => {
  const f = await fixture(t, { demoMode: false, secureCookie: true });
  assert.equal(f.db.prepare('SELECT count(*) n FROM users').get().n, 0);
  const c = f.client();
  const r = await c.req('/auth/register', 'POST', {
    name: 'Real User',
    email: 'real@example.com',
    password: 'StrongPassword@123',
  });
  assert.match(r.headers.get('set-cookie'), /Secure/);
  assert.equal((await c.req('/config')).data.demo_mode, false);
});
