# HTTP API reference

Base URL in local compiled mode: `http://localhost:3000/api`.

Requests and responses are JSON. Authenticated routes use the `foodio_session` cookie. All authenticated mutations require `X-CSRF-Token`, obtained from login, registration, or `/auth/me`. Browser origins must match `ALLOWED_ORIGINS`. Use the same hostname for login and later requests.

Money is represented in integer **paise**, not rupees. Boolean inputs are JSON booleans; catalog flags read from SQLite are `0` or `1`. Timestamps are UTC ISO strings. IDs are positive integers except order UUIDs and coupon codes.

## Public and authentication endpoints

| Method | Path               | Input / result                                                                  |
| ------ | ------------------ | ------------------------------------------------------------------------------- |
| GET    | `/health`          | Database-backed liveness result                                                 |
| GET    | `/config`          | Demo mode, currency, payment methods, free-delivery threshold                   |
| GET    | `/auth/me`         | `{ user, csrf }`, both nullable when signed out                                 |
| POST   | `/auth/register`   | `{ name, email, password }`; creates customer, returns user + CSRF, sets cookie |
| POST   | `/auth/login`      | `{ email, password }`; returns user + CSRF, sets cookie                         |
| POST   | `/auth/logout`     | Auth + CSRF; revokes the current session                                        |
| POST   | `/auth/password`   | Auth + CSRF; `{ current_password, new_password }`                               |
| PATCH  | `/profile`         | Auth + CSRF; `{ name }`                                                         |
| GET    | `/restaurants`     | Query: `q`, `cuisine`, `veg=true`; returns `{ restaurants }`                    |
| GET    | `/restaurants/:id` | `{ restaurant, menu, reviews }`                                                 |
| GET    | `/menu/popular`    | `{ items }` with kitchen names                                                  |
| GET    | `/offers`          | `{ offers }` containing active offers                                           |

`name`: 2–80 characters. Password at registration/change: 10–128 characters. Login supports the same maximum. Email is normalized to lowercase and unique case-insensitively. Reviews are limited to the most recent 50 per kitchen.

## Customer resources

All endpoints below require a session; mutations also require CSRF.

| Method | Path                 | Input / result                                                         |
| ------ | -------------------- | ---------------------------------------------------------------------- |
| GET    | `/favorites`         | `{ ids: [restaurantId, ...] }`                                         |
| PUT    | `/favorites/:id`     | `{ saved: true/false }`                                                |
| GET    | `/addresses`         | `{ addresses }` sorted with default first                              |
| POST   | `/addresses`         | Address input below; returns `{ id }` with HTTP 201                    |
| PUT    | `/addresses/:id`     | Full address input below                                               |
| DELETE | `/addresses/:id`     | Deletes only an address owned by the session user                      |
| GET    | `/cart`              | `{ items }` with current menu data and quantities                      |
| PUT    | `/cart`              | `{ items: [{ item_id, quantity }] }`; replaces saved basket atomically |
| POST   | `/checkout/quote`    | `{ items, coupon? }`; returns validated quote                          |
| POST   | `/orders`            | Checkout payload below, plus `Idempotency-Key` UUID header             |
| GET    | `/orders`            | `{ orders }`, most recent 100 belonging to the user                    |
| GET    | `/orders/:id`        | `{ order }`; own order or administrator access                         |
| POST   | `/orders/:id/cancel` | Cancels a placed/confirmed order                                       |
| POST   | `/orders/:id/review` | `{ rating: 1..5, comment }`; delivered order only, once                |

Address input:

```json
{
  "label": "Home",
  "recipient": "Alex Morgan",
  "phone": "9876543210",
  "line1": "12 Sample Lane, Indiranagar",
  "city": "Bengaluru",
  "postal_code": "560038",
  "is_default": true
}
```

The six-digit PIN is format validation only; geographic delivery coverage is not checked. At most 20 addresses are allowed. Selecting another default automatically clears the previous default. An existing default remains default until another is selected; deleting it selects a remaining address if possible.

Quote input:

```json
{
  "items": [{ "item_id": 1, "quantity": 1 }],
  "coupon": "FIRSTBITE"
}
```

With the seeded menu and a first-order customer, this quotes subtotal `24900`, discount `4980`, delivery `2900`, and total `22820`. The result also includes authoritative item records, restaurant details, applied coupon, and `minimum_met`.

Checkout input:

```json
{
  "items": [{ "item_id": 1, "quantity": 1 }],
  "address_id": 1,
  "coupon": "FIRSTBITE",
  "note": "Please call at the gate.",
  "payment_method": "cod",
  "accepted_total": 22820
}
```

Use a real address ID returned for the logged-in user. Send a fresh UUID in `Idempotency-Key` for a new checkout payload. Reuse the same UUID and exact payload to retry a request after a connection failure. Never generate a new key merely because the first response was lost.

The response is `{ order, reused }`: HTTP 201 for creation, 200 for an identical retry, and 409 if the key was reused with different data. The order response excludes the stored idempotency key and request fingerprint. Address, item name, and price snapshots do not change when a profile, address, or menu is later edited.

## Administrator endpoints

All require an administrator session; mutations also require CSRF. Customer registrations cannot choose an administrator role.

| Method | Path                       | Input / result                                                          |
| ------ | -------------------------- | ----------------------------------------------------------------------- |
| GET    | `/admin/overview`          | `{ stats, orders, restaurants, menu, coupons }`; most recent 200 orders |
| PATCH  | `/admin/orders/:id/status` | `{ status }`; valid next state or early cancellation                    |
| PATCH  | `/admin/restaurants/:id`   | `{ is_open: true/false }`                                               |
| POST   | `/admin/menu`              | Full menu input; creates dish with HTTP 201                             |
| PUT    | `/admin/menu/:id`          | Full menu input; updates existing dish                                  |
| PATCH  | `/admin/coupons/:code`     | `{ active: true/false }`                                                |

Menu input:

```json
{
  "restaurant_id": 1,
  "name": "Seasonal grain bowl",
  "description": "Roasted vegetables, grains and herb dressing.",
  "category": "Signature bowls",
  "price": 27900,
  "image": "/images/bowl.svg",
  "is_veg": true,
  "available": true,
  "popular": false
}
```

Allowed illustrations: `bowl`, `burger`, `pizza`, `curry`, `dessert`, `noodles`, `drink`, and `fries` as `/images/<name>.svg`. Price range: ₹1–₹10,000. A dish cannot move between restaurants after creation; create a new dish instead. Historical order line items remain intact. Availability replaces destructive menu deletion.

Allowed order transitions:

| Current            | Allowed next             |
| ------------------ | ------------------------ |
| `placed`           | `confirmed`, `cancelled` |
| `confirmed`        | `preparing`, `cancelled` |
| `preparing`        | `out_for_delivery`       |
| `out_for_delivery` | `delivered`              |
| `delivered`        | None                     |
| `cancelled`        | None                     |

Marking an order delivered records COD payment as `collected`. Cancellation records payment as `cancelled`. There is no online payment capture endpoint.

## Error contract

```json
{
  "error": "The price changed. Refresh your basket before ordering.",
  "code": "PRICE_CHANGED",
  "request_id": "request UUID"
}
```

Validation errors may omit `request_id`; every HTTP response carries `X-Request-Id`. Common responses:

| Status | Meaning                                                                                     |
| ------ | ------------------------------------------------------------------------------------------- |
| 400    | Invalid input, coupon, minimum-order rule, or mixed-kitchen basket                          |
| 401    | Missing/expired session or incorrect credentials                                            |
| 403    | CSRF/origin check failed or role is insufficient                                            |
| 404    | Resource absent or not owned by caller                                                      |
| 409    | Price/availability change, invalid state transition, duplicate review, idempotency conflict |
| 413    | JSON body exceeds 64 KiB                                                                    |
| 429    | Rate limit exceeded                                                                         |
| 500    | Unexpected failure; internal details are not returned                                       |

## JavaScript example (same-origin browser)

```javascript
const login = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@foodio.local',
    password: 'Customer@12345',
  }),
});
const { csrf } = await login.json();
const quote = await fetch('/api/checkout/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  body: JSON.stringify({ items: [{ item_id: 1, quantity: 1 }], coupon: 'FIRSTBITE' }),
}).then((r) => r.json());
console.log(quote.total);
```

Use these demo credentials only in local demo mode. Keep session cookies out of source code and logs.
