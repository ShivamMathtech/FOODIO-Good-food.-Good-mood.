import { z } from 'zod';
export const fail = (status, message, code = 'REQUEST_FAILED') => {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
};
export const itemList = z
  .array(
    z.object({ item_id: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }),
  )
  .max(30);
export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30),
  recipient: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 -]{8,15}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  postal_code: z.string().regex(/^\d{6}$/, 'Enter a six-digit PIN code'),
  is_default: z.boolean().default(false),
});
export const menuSchema = z.object({
  restaurant_id: z.number().int().positive(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(400),
  category: z.string().trim().min(2).max(40),
  price: z.number().int().min(100).max(1000000),
  image: z.enum([
    '/images/bowl.svg',
    '/images/burger.svg',
    '/images/pizza.svg',
    '/images/curry.svg',
    '/images/dessert.svg',
    '/images/noodles.svg',
    '/images/drink.svg',
    '/images/fries.svg',
  ]),
  is_veg: z.boolean(),
  available: z.boolean(),
  popular: z.boolean(),
});
export function normalizeItems(items) {
  const seen = new Set();
  for (const i of items) {
    if (seen.has(i.item_id)) fail(400, 'Duplicate menu items are not allowed.');
    seen.add(i.item_id);
  }
  return items;
}
export function quote(db, items, coupon, userId, allowEmpty = false) {
  normalizeItems(items);
  if (items.length === 0) {
    if (!allowEmpty) fail(400, 'Your basket is empty.');
    return {
      items: [],
      restaurant: null,
      subtotal: 0,
      discount: 0,
      delivery_fee: 0,
      total: 0,
      coupon: null,
      minimum_met: false,
    };
  }
  let restaurantId;
  const lines = items.map((i) => {
    const m = db.prepare('SELECT * FROM menu_items WHERE id=?').get(i.item_id);
    if (!m || !m.available)
      fail(409, `${m?.name || 'A menu item'} is no longer available.`, 'ITEM_UNAVAILABLE');
    if (restaurantId && restaurantId !== m.restaurant_id)
      fail(400, 'Please order from one restaurant at a time.');
    restaurantId = m.restaurant_id;
    return { ...m, item_id: m.id, quantity: i.quantity, line_total: m.price * i.quantity };
  });
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id=?').get(restaurantId);
  if (!restaurant.is_open) fail(409, 'This restaurant is currently closed.');
  const subtotal = lines.reduce((sum, i) => sum + i.line_total, 0);
  let discount = 0;
  let applied = null;
  if (coupon) {
    const c = db
      .prepare('SELECT * FROM coupons WHERE code=? AND active=1')
      .get(coupon.toUpperCase());
    if (!c) fail(400, 'This promo code is not available.');
    if (subtotal < c.min_subtotal)
      fail(400, `This offer needs a food total of ₹${c.min_subtotal / 100}.`);
    if (
      c.first_order_only &&
      (!userId ||
        db
          .prepare("SELECT 1 FROM orders WHERE user_id=? AND status<>'cancelled' LIMIT 1")
          .get(userId))
    )
      fail(400, 'This promo code is for your first order only.');
    discount = Math.min(Math.floor((subtotal * c.percent) / 100), c.max_discount);
    applied = c.code;
  }
  const delivery_fee = subtotal >= 49900 ? 0 : restaurant.delivery_fee;
  return {
    items: lines,
    restaurant,
    subtotal,
    discount,
    delivery_fee,
    total: subtotal - discount + delivery_fee,
    coupon: applied,
    minimum_met: subtotal >= restaurant.min_order,
  };
}
export function orderDetail(db, id) {
  const order = db
    .prepare(
      'SELECT o.*,r.name restaurant_name,r.image restaurant_image FROM orders o JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=?',
    )
    .get(id);
  if (!order) fail(404, 'Order not found.');
  const { address_json, idempotency_key, request_hash, ...safe } = order;
  return {
    ...safe,
    address: JSON.parse(address_json),
    items: db
      .prepare('SELECT item_id,name,price,quantity FROM order_items WHERE order_id=?')
      .all(id),
    events: db
      .prepare('SELECT status,created_at FROM order_events WHERE order_id=? ORDER BY id')
      .all(id),
    review: db.prepare('SELECT rating,comment FROM reviews WHERE order_id=?').get(id) || null,
  };
}
export const transitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const userView = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
