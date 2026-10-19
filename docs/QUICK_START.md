# FOODIO — quick start

1. Install **Node.js 24.x LTS** from https://nodejs.org/.
2. Extract the ZIP fully.
3. Open `foodio-fullstack` and double-click **START-WINDOWS.bat**.
4. Wait for installation/build to finish.
5. Open **http://localhost:3000**.

On macOS/Linux, run `bash start.sh` from the same folder.

## Sample sign-in

| Account  | Email                 | Password       |
| -------- | --------------------- | -------------- |
| Customer | customer@foodio.local | Customer@12345 |
| Admin    | admin@foodio.local    | Admin@12345    |

Use different browser profiles/private windows to use both accounts at once.

## First order

- Add a Harvest grain bowl.
- Continue to checkout, choose the saved address, and apply `FIRSTBITE`.
- For one bowl, the first-order total is **₹228.20**, including delivery, with the unchanged sample prices.
- Place the cash-on-delivery order.
- Sign in as admin, open **Kitchen desk**, and advance the order through its statuses.
- The customer tracking page updates within 8 seconds.

## What you need

**Required:** Node 24, a browser, and internet for the initial npm install.

**Not required:** MySQL, PostgreSQL, MongoDB, Python, paid APIs, or a cloud account.

SQLite data is created automatically. Your changes stay saved between runs.

See `README.md` for the detailed setup, development commands, troubleshooting, feature boundaries, and deployment notes. Online payments and real courier GPS are not connected in this edition.
