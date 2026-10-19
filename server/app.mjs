import express from 'express';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase, transaction } from './db.mjs';
import {
  hashPassword,
  verifyPassword,
  token,
  digest,
  sessionCookie,
  cookieToken,
} from './security.mjs';
import { seed } from './seed.mjs';
import {
  fail,
  itemList,
  addressSchema,
  menuSchema,
  quote,
  orderDetail,
  transitions,
  userView,
} from './services.mjs';

export async function createApp({
  databasePath = ':memory:',
  demoMode = false,
  secureCookie = false,
  allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  distPath = resolve('dist'),
  publicPath = resolve('public'),
} = {}) {
  const db = openDatabase(databasePath);
  await seed(db, demoMode);
  const dummyHash = await hashPassword(token());
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !allowedOrigins.includes(req.headers.origin)
    )
      return res
        .status(403)
        .json({ error: 'This browser origin is not allowed.', code: 'ORIGIN_DENIED' });
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      return res
        .status(403)
        .json({ error: 'Cross-site requests are not allowed.', code: 'ORIGIN_DENIED' });
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  function limit(key, max, seconds) {
    const now = Date.now();
    db.prepare('DELETE FROM auth_limits WHERE resets_at<?').run(now);
    const row = db.prepare('SELECT * FROM auth_limits WHERE key=?').get(key);
    if (row && row.hits >= max)
      fail(429, 'Too many requests. Please try again later.', 'RATE_LIMITED');
    db.prepare(
      'INSERT INTO auth_limits(key,hits,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',
    ).run(key, now + seconds * 1000);
  }
  app.use('/api', (req, res, next) => {
    if (req.path !== '/health') limit(`api:${req.ip}`, 300, 60);
    next();
  });
  app.use('/api', (req, res, next) => {
    const raw = cookieToken(req);
    req.session = raw
      ? db
          .prepare(
            'SELECT s.*,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',
          )
          .get(digest(raw), Date.now())
      : null;
    if (req.session)
      req.user = {
        id: req.session.user_id,
        name: req.session.name,
        email: req.session.email,
        role: req.session.role,
      };
    next();
  });
  const auth = (req, res, next) => {
    if (!req.user) fail(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    next();
  };
  const csrf = (req, res, next) => {
    if (!req.session || req.headers['x-csrf-token'] !== req.session.csrf)
      fail(403, 'Your session changed. Refresh and try again.', 'CSRF_INVALID');
    next();
  };
  const admin = (req, res, next) => {
    if (req.user?.role !== 'admin') fail(403, 'Administrator access is required.');
    next();
  };
  const startSession = (u, req, res) => {
    const raw = token(),
      csrfToken = token();
    const previous = cookieToken(req);
    if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(previous));
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
      digest(raw),
      u.id,
      csrfToken,
      Date.now() + 604800000,
    );
    res.set('Set-Cookie', sessionCookie(raw, secureCookie));
    return { user: userView(u), csrf: csrfToken };
  };
  const id = (req) => z.coerce.number().int().positive().parse(req.params.id);
  const ownedOrder = (req) => {
    const o = orderDetail(db, req.params.id);
    if (o.user_id !== req.user.id && req.user.role !== 'admin') fail(404, 'Order not found.');
    return o;
  };
  const audit = (req, action, entity) =>
    db
      .prepare('INSERT INTO admin_audit(actor_id,action,entity) VALUES(?,?,?)')
      .run(req.user.id, action, String(entity));

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'sqlite', version: '1.0.0' });
  });
  app.get('/api/config', (req, res) =>
    res.json({
      demo_mode: demoMode,
      currency: 'INR',
      payment_methods: ['cod'],
      free_delivery_threshold: 49900,
    }),
  );
  app.get('/api/auth/me', (req, res) =>
    res.json({ user: req.user || null, csrf: req.session?.csrf || null }),
  );
  app.post('/api/auth/register', async (req, res) => {
    limit(`register:${req.ip}`, 8, 900);
    const data = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(10).max(128),
      })
      .parse(req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(data.email))
      fail(409, 'An account already exists with this email.');
    const hash = await hashPassword(data.password);
    let result;
    try {
      result = db
        .prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)')
        .run(data.name, data.email, hash);
    } catch (e) {
      if (String(e.message).includes('UNIQUE'))
        fail(409, 'An account already exists with this email.');
      throw e;
    }
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(Number(result.lastInsertRowid));
    res.status(201).json(startSession(u, req, res));
  });
  app.post('/api/auth/login', async (req, res) => {
    limit(`login:${req.ip}`, 25, 900);
    const d = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    limit(`account:${digest(d.email)}:${req.ip}`, 10, 900);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(d.email);
    const valid = await verifyPassword(d.password, u?.password_hash || dummyHash);
    if (!u || !valid) fail(401, 'Email or password is incorrect.');
    res.json(startSession(u, req, res));
  });
  app.post('/api/auth/logout', auth, csrf, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.token_hash);
    res.set('Set-Cookie', sessionCookie('', secureCookie, true));
    res.json({ ok: true });
  });
  app.patch('/api/profile', auth, csrf, (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(2).max(80) }).parse(req.body);
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.user.id);
    res.json({ user: { ...req.user, name } });
  });
  app.post('/api/auth/password', auth, csrf, async (req, res) => {
    limit(`password:${req.user.id}`, 5, 900);
    const d = z
      .object({
        current_password: z.string().min(1).max(128),
        new_password: z.string().min(10).max(128),
      })
      .parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (!(await verifyPassword(d.current_password, u.password_hash)))
      fail(400, 'Current password is incorrect.');
    const hash = await hashPassword(d.new_password);
    transaction(db, () => {
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, u.id);
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(
        u.id,
        req.session.token_hash,
      );
    });
    res.json({ ok: true });
  });

  const restaurantSelect =
    'SELECT r.*, (SELECT round(avg(rating),1) FROM reviews WHERE restaurant_id=r.id) rating, (SELECT count(*) FROM reviews WHERE restaurant_id=r.id) review_count FROM restaurants r';
  app.get('/api/restaurants', (req, res) => {
    const q = String(req.query.q || '').slice(0, 100);
    const cuisine = String(req.query.cuisine || '').slice(0, 40);
    const veg = req.query.veg === 'true';
    const rows = db
      .prepare(
        `${restaurantSelect} WHERE (?='' OR r.name LIKE ? OR r.cuisine LIKE ? OR EXISTS(SELECT 1 FROM menu_items m WHERE m.restaurant_id=r.id AND m.name LIKE ?)) AND (?='' OR r.cuisine=?) AND (?=0 OR EXISTS(SELECT 1 FROM menu_items m WHERE m.restaurant_id=r.id AND m.is_veg=1 AND m.available=1)) ORDER BY r.featured DESC,r.id`,
      )
      .all(q, `%${q}%`, `%${q}%`, `%${q}%`, cuisine, cuisine, veg ? 1 : 0);
    res.json({ restaurants: rows });
  });
  app.get('/api/restaurants/:id', (req, res) => {
    const r = db.prepare(`${restaurantSelect} WHERE r.id=?`).get(id(req));
    if (!r) fail(404, 'Restaurant not found.');
    res.json({
      restaurant: r,
      menu: db
        .prepare('SELECT * FROM menu_items WHERE restaurant_id=? ORDER BY popular DESC,id')
        .all(r.id),
      reviews: db
        .prepare(
          'SELECT v.rating,v.comment,v.created_at,u.name FROM reviews v JOIN users u ON u.id=v.user_id WHERE restaurant_id=? ORDER BY v.id DESC LIMIT 50',
        )
        .all(r.id),
    });
  });
  app.get('/api/menu/popular', (req, res) =>
    res.json({
      items: db
        .prepare(
          'SELECT m.*,r.name restaurant_name FROM menu_items m JOIN restaurants r ON m.restaurant_id=r.id WHERE popular=1 AND available=1 AND r.is_open=1 ORDER BY m.id LIMIT 12',
        )
        .all(),
    }),
  );
  app.get('/api/offers', (req, res) =>
    res.json({
      offers: db
        .prepare(
          'SELECT code,description,min_subtotal,percent,max_discount FROM coupons WHERE active=1',
        )
        .all(),
    }),
  );
  app.get('/api/favorites', auth, (req, res) =>
    res.json({
      ids: db
        .prepare('SELECT restaurant_id FROM favorites WHERE user_id=?')
        .all(req.user.id)
        .map((x) => x.restaurant_id),
    }),
  );
  app.put('/api/favorites/:id', auth, csrf, (req, res) => {
    const rid = id(req);
    if (!db.prepare('SELECT 1 FROM restaurants WHERE id=?').get(rid))
      fail(404, 'Restaurant not found.');
    const { saved } = z.object({ saved: z.boolean() }).parse(req.body);
    if (saved) db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)').run(req.user.id, rid);
    else
      db.prepare('DELETE FROM favorites WHERE user_id=? AND restaurant_id=?').run(req.user.id, rid);
    res.json({ saved });
  });

  app.get('/api/addresses', auth, (req, res) =>
    res.json({
      addresses: db
        .prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id DESC')
        .all(req.user.id),
    }),
  );
  app.post('/api/addresses', auth, csrf, (req, res) => {
    const a = addressSchema.parse(req.body);
    let result;
    transaction(db, () => {
      const count = db
        .prepare('SELECT count(*) n FROM addresses WHERE user_id=?')
        .get(req.user.id).n;
      if (count >= 20) fail(400, 'You can save up to 20 addresses.');
      if (a.is_default || !count)
        db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
      result = db
        .prepare(
          'INSERT INTO addresses(user_id,label,recipient,phone,line1,city,postal_code,is_default) VALUES(?,?,?,?,?,?,?,?)',
        )
        .run(
          req.user.id,
          a.label,
          a.recipient,
          a.phone,
          a.line1,
          a.city,
          a.postal_code,
          a.is_default || !count ? 1 : 0,
        );
    });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.put('/api/addresses/:id', auth, csrf, (req, res) => {
    const a = addressSchema.parse(req.body);
    const old = db
      .prepare('SELECT * FROM addresses WHERE id=? AND user_id=?')
      .get(id(req), req.user.id);
    if (!old) fail(404, 'Address not found.');
    transaction(db, () => {
      if (a.is_default)
        db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
      db.prepare(
        'UPDATE addresses SET label=?,recipient=?,phone=?,line1=?,city=?,postal_code=?,is_default=? WHERE id=? AND user_id=?',
      ).run(
        a.label,
        a.recipient,
        a.phone,
        a.line1,
        a.city,
        a.postal_code,
        a.is_default || old.is_default ? 1 : 0,
        id(req),
        req.user.id,
      );
    });
    res.json({ ok: true });
  });
  app.delete('/api/addresses/:id', auth, csrf, (req, res) => {
    transaction(db, () => {
      const result = db
        .prepare('DELETE FROM addresses WHERE id=? AND user_id=?')
        .run(id(req), req.user.id);
      if (!result.changes) fail(404, 'Address not found.');
      if (!db.prepare('SELECT 1 FROM addresses WHERE user_id=? AND is_default=1').get(req.user.id))
        db.prepare(
          'UPDATE addresses SET is_default=1 WHERE id=(SELECT id FROM addresses WHERE user_id=? ORDER BY id LIMIT 1)',
        ).run(req.user.id);
    });
    res.json({ ok: true });
  });

  app.get('/api/cart', auth, (req, res) =>
    res.json({
      items: db
        .prepare(
          'SELECT m.*,c.item_id,c.quantity FROM cart_items c JOIN menu_items m ON m.id=c.item_id WHERE c.user_id=? ORDER BY m.id',
        )
        .all(req.user.id),
    }),
  );
  app.put('/api/cart', auth, csrf, (req, res) => {
    const { items } = z.object({ items: itemList }).parse(req.body);
    transaction(db, () => {
      quote(db, items, '', req.user.id, true);
      db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
      const s = db.prepare('INSERT INTO cart_items VALUES(?,?,?)');
      for (const i of items) s.run(req.user.id, i.item_id, i.quantity);
    });
    res.json({ ok: true });
  });
  app.post('/api/checkout/quote', auth, csrf, (req, res) => {
    const d = z
      .object({ items: itemList, coupon: z.string().trim().max(30).default('') })
      .parse(req.body);
    res.json(quote(db, d.items, d.coupon, req.user.id));
  });
  app.post('/api/orders', auth, csrf, (req, res) => {
    const d = z
      .object({
        items: itemList.min(1),
        address_id: z.number().int().positive(),
        coupon: z.string().trim().max(30).default(''),
        note: z.string().trim().max(500).default(''),
        payment_method: z.literal('cod'),
        accepted_total: z.number().int().positive(),
      })
      .parse(req.body);
    const key = z.uuid().parse(req.headers['idempotency-key']);
    const fingerprint = digest(JSON.stringify(d));
    let orderId,
      reused = false;
    transaction(db, () => {
      const existing = db
        .prepare('SELECT id,request_hash FROM orders WHERE user_id=? AND idempotency_key=?')
        .get(req.user.id, key);
      if (existing) {
        if (existing.request_hash !== fingerprint)
          fail(409, 'This checkout key was already used for a different request.');
        orderId = existing.id;
        reused = true;
        return;
      }
      const a = db
        .prepare(
          'SELECT label,recipient,phone,line1,city,postal_code FROM addresses WHERE id=? AND user_id=?',
        )
        .get(d.address_id, req.user.id);
      if (!a) fail(400, 'Choose a valid delivery address.');
      const q = quote(db, d.items, d.coupon, req.user.id);
      if (!q.minimum_met) fail(400, `Minimum food total is ₹${q.restaurant.min_order / 100}.`);
      if (q.total !== d.accepted_total)
        fail(409, 'The price changed. Refresh your basket before ordering.', 'PRICE_CHANGED');
      orderId = randomUUID();
      db.prepare(
        "INSERT INTO orders(id,user_id,restaurant_id,status,subtotal,discount,delivery_fee,total,coupon_code,address_json,note,payment_method,idempotency_key,request_hash) VALUES(?,?,?,'placed',?,?,?,?,?,?,?,'cod',?,?)",
      ).run(
        orderId,
        req.user.id,
        q.restaurant.id,
        q.subtotal,
        q.discount,
        q.delivery_fee,
        q.total,
        q.coupon,
        JSON.stringify(a),
        d.note,
        key,
        fingerprint,
      );
      const s = db.prepare(
        'INSERT INTO order_items(order_id,item_id,name,price,quantity) VALUES(?,?,?,?,?)',
      );
      for (const i of q.items) s.run(orderId, i.id, i.name, i.price, i.quantity);
      db.prepare("INSERT INTO order_events(order_id,status,actor_id) VALUES(?,'placed',?)").run(
        orderId,
        req.user.id,
      );
      db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
    });
    res.status(reused ? 200 : 201).json({ order: orderDetail(db, orderId), reused });
  });
  app.get('/api/orders', auth, (req, res) => {
    const ids = db
      .prepare('SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .all(req.user.id);
    res.json({ orders: ids.map((x) => orderDetail(db, x.id)) });
  });
  app.get('/api/orders/:id', auth, (req, res) => res.json({ order: ownedOrder(req) }));
  app.post('/api/orders/:id/cancel', auth, csrf, (req, res) => {
    transaction(db, () => {
      const o = ownedOrder(req);
      if (!['placed', 'confirmed'].includes(o.status))
        fail(409, 'This order can no longer be cancelled.');
      db.prepare(
        "UPDATE orders SET status='cancelled',payment_status='cancelled',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      ).run(o.id);
      db.prepare("INSERT INTO order_events(order_id,status,actor_id) VALUES(?,'cancelled',?)").run(
        o.id,
        req.user.id,
      );
    });
    res.json({ order: orderDetail(db, req.params.id) });
  });
  app.post('/api/orders/:id/review', auth, csrf, (req, res) => {
    const d = z
      .object({
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().min(5).max(1000),
      })
      .parse(req.body);
    const o = ownedOrder(req);
    if (o.user_id !== req.user.id || o.status !== 'delivered')
      fail(400, 'Only your delivered orders can be reviewed.');
    if (o.review) fail(409, 'You have already reviewed this order.');
    db.prepare(
      'INSERT INTO reviews(order_id,user_id,restaurant_id,rating,comment) VALUES(?,?,?,?,?)',
    ).run(o.id, req.user.id, o.restaurant_id, d.rating, d.comment);
    res.status(201).json({ ok: true });
  });

  app.use('/api/admin', auth, admin);
  app.get('/api/admin/overview', (req, res) => {
    const stats = db
      .prepare(
        "SELECT count(*) total_orders,coalesce(sum(CASE WHEN status='delivered' THEN total ELSE 0 END),0) revenue,coalesce(sum(CASE WHEN status NOT IN('delivered','cancelled') THEN 1 ELSE 0 END),0) active_orders FROM orders",
      )
      .get();
    const customers = db.prepare("SELECT count(*) n FROM users WHERE role='customer'").get().n;
    res.json({
      stats: { ...stats, customers },
      orders: db
        .prepare('SELECT id FROM orders ORDER BY created_at DESC LIMIT 200')
        .all()
        .map((x) => orderDetail(db, x.id)),
      restaurants: db.prepare('SELECT * FROM restaurants ORDER BY id').all(),
      menu: db
        .prepare(
          'SELECT m.*,r.name restaurant_name FROM menu_items m JOIN restaurants r ON r.id=m.restaurant_id ORDER BY m.restaurant_id,m.id',
        )
        .all(),
      coupons: db.prepare('SELECT * FROM coupons').all(),
    });
  });
  app.patch('/api/admin/orders/:id/status', csrf, (req, res) => {
    const { status } = z
      .object({
        status: z.enum(['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']),
      })
      .parse(req.body);
    transaction(db, () => {
      const o = orderDetail(db, req.params.id);
      if (!transitions[o.status].includes(status))
        fail(409, `Cannot change ${o.status} to ${status}.`);
      db.prepare(
        "UPDATE orders SET status=?,payment_status=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      ).run(
        status,
        status === 'delivered' ? 'collected' : status === 'cancelled' ? 'cancelled' : 'pending',
        o.id,
      );
      db.prepare('INSERT INTO order_events(order_id,status,actor_id) VALUES(?,?,?)').run(
        o.id,
        status,
        req.user.id,
      );
      audit(req, 'order.status:' + status, o.id);
    });
    res.json({ order: orderDetail(db, req.params.id) });
  });
  app.patch('/api/admin/restaurants/:id', csrf, (req, res) => {
    const { is_open } = z.object({ is_open: z.boolean() }).parse(req.body);
    transaction(db, () => {
      if (
        !db.prepare('UPDATE restaurants SET is_open=? WHERE id=?').run(is_open ? 1 : 0, id(req))
          .changes
      )
        fail(404, 'Restaurant not found.');
      audit(req, 'restaurant.open:' + is_open, id(req));
    });
    res.json({ ok: true });
  });
  app.post('/api/admin/menu', csrf, (req, res) => {
    const m = menuSchema.parse(req.body);
    let result;
    transaction(db, () => {
      if (!db.prepare('SELECT 1 FROM restaurants WHERE id=?').get(m.restaurant_id))
        fail(400, 'Invalid restaurant.');
      result = db
        .prepare(
          'INSERT INTO menu_items(restaurant_id,name,description,category,price,image,is_veg,available,popular) VALUES(?,?,?,?,?,?,?,?,?)',
        )
        .run(
          m.restaurant_id,
          m.name,
          m.description,
          m.category,
          m.price,
          m.image,
          +m.is_veg,
          +m.available,
          +m.popular,
        );
      audit(req, 'menu.create', result.lastInsertRowid);
    });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.put('/api/admin/menu/:id', csrf, (req, res) => {
    const m = menuSchema.parse(req.body);
    transaction(db, () => {
      const old = db.prepare('SELECT restaurant_id FROM menu_items WHERE id=?').get(id(req));
      if (!old) fail(404, 'Menu item not found.');
      if (old.restaurant_id !== m.restaurant_id)
        fail(400, 'A menu item cannot move between restaurants.');
      db.prepare(
        'UPDATE menu_items SET name=?,description=?,category=?,price=?,image=?,is_veg=?,available=?,popular=? WHERE id=?',
      ).run(
        m.name,
        m.description,
        m.category,
        m.price,
        m.image,
        +m.is_veg,
        +m.available,
        +m.popular,
        id(req),
      );
      audit(req, 'menu.update', id(req));
    });
    res.json({ ok: true });
  });
  app.patch('/api/admin/coupons/:code', csrf, (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    transaction(db, () => {
      if (
        !db.prepare('UPDATE coupons SET active=? WHERE code=?').run(+active, req.params.code)
          .changes
      )
        fail(404, 'Offer not found.');
      audit(req, 'coupon.active:' + active, req.params.code);
    });
    res.json({ ok: true });
  });

  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' }),
  );
  app.use(express.static(publicPath, { maxAge: '1h' }));
  if (existsSync(resolve(distPath, 'index.html'))) {
    app.use(express.static(distPath, { index: false }));
    app.get('/{*path}', (req, res) => {
      if (req.path.includes('.')) return res.sendStatus(404);
      res.set('Cache-Control', 'no-cache');
      res.sendFile(resolve(distPath, 'index.html'));
    });
  }
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({
          error: err.issues.map((x) => `${x.path.join('.') || 'Request'}: ${x.message}`).join('; '),
          code: 'VALIDATION_ERROR',
        });
    if (err.type === 'entity.too.large')
      return res.status(413).json({ error: 'Request is too large.' });
    if (err.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Invalid JSON request.' });
    if (!err.status)
      console.error(
        JSON.stringify({ level: 'error', requestId: req.requestId, message: err.message }),
      );
    res
      .status(err.status || 500)
      .json({
        error: err.status ? err.message : 'An unexpected error occurred. Please try again.',
        code: err.code || 'INTERNAL_ERROR',
        request_id: req.requestId,
      });
  });
  return { app, db };
}
