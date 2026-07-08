# Mammoth Surge — Backend (Stripe + ShipStation)

A small Node/Express service that powers checkout and fulfillment for the
Mammoth Surge storefront:

- **Stripe Checkout** — creates a hosted, PCI-compliant payment page and
  collects the shipping address + phone.
- **Stripe webhook** — on successful payment, automatically creates an order in
  **ShipStation** for fulfillment.

The storefront (the static site in the repo root) stays on GitHub Pages and
just calls this API. Your secret keys live **only** on the server, never in the
browser.

```
Browser ──POST /api/checkout──▶ Server ──▶ Stripe Checkout ──▶ Payment
                                                   │
                              Stripe ──webhook──▶  Server ──▶ ShipStation order
```

---

## 1. Prerequisites

- Node.js 18+ (`node -v`)
- A Stripe account
- A ShipStation account

## 2. Install

```bash
cd server
npm install
cp .env.example .env   # then edit .env with your keys
```

## 3. Configure `.env`

| Variable | Where to get it |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (`sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | Created when you add a webhook endpoint (below), or printed by `stripe listen` |
| `SHIPSTATION_API_KEY` / `SHIPSTATION_API_SECRET` | ShipStation → Settings → Account → API Settings → **Generate API Keys** |
| `SHIPSTATION_STORE_ID` | *(optional)* ShipStation → Settings → Stores, to route imported orders |
| `CLIENT_URL` | Your storefront URL, e.g. `https://dryestrain777.github.io/mammoth-surge` |

## 4. Run locally

```bash
npm run dev      # auto-restarts on change
# or
npm start
```

Check it’s alive:

```bash
curl http://localhost:4242/api/health
# { "ok": true, "stripe": true, "shipstation": true, ... }
```

### Verify ShipStation is connected

Two helper scripts confirm your ShipStation keys work **before** you take a real
order:

```bash
npm run ss:test    # read-only: validates your API key/secret and lists carriers
npm run ss:order   # creates ONE sample order in ShipStation so you can see the
                   # full name / address / SKU mapping (delete it afterwards)
```

Successful `ss:test` output:

```
✅ Connected. 3 carrier(s): stamps_com, ups, fedex
```

Or hit the live status endpoint:

```bash
curl http://localhost:4242/api/shipstation/health
# 200 → { "ok": true, "carriers": [...] }    502 → keys rejected    503 → not set
```

## 5. Test the Stripe webhook locally

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to http://localhost:4242/api/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET, then restart the server
```

Use Stripe’s test card on the checkout page: **4242 4242 4242 4242**, any future
expiry, any CVC/ZIP. After paying, the CLI shows `checkout.session.completed`
and the server logs `ShipStation order created…`.

---

## 6. Deploy (Render example — free tier)

ShipStation/Stripe need a public HTTPS server. Any host works (Render, Railway,
Fly.io, a VPS). Using **Render**:

1. Push this repo to GitHub (already done).
2. Render → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add the environment variables from your `.env` (Render → Environment).
5. Deploy. You’ll get a URL like `https://mammoth-surge-api.onrender.com`.

### Point Stripe’s webhook at it (production)

Stripe Dashboard → Developers → **Webhooks** → **Add endpoint**:

- **Endpoint URL:** `https://YOUR-API-URL/api/webhook`
- **Events:** `checkout.session.completed`
- Save, then copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET` on Render
  and redeploy.

---

## 7. Connect the storefront

Edit [`../js/config.js`](../js/config.js) and set your deployed API URL:

```js
window.MAMMOTH_CONFIG = { apiBase: "https://YOUR-API-URL" };
```

Commit & push — GitHub Pages redeploys, and the **Buy / Add to Cart** buttons
will redirect customers to Stripe Checkout. After payment they return to
`success.html`, and the order lands in ShipStation.

> If `apiBase` is left empty the site stays in safe “demo” mode (buttons show a
> toast instead of charging anyone).

---

## API reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness + which integrations are configured |
| `GET` | `/api/shipstation/health` | Read-only ShipStation credential check |
| `POST` | `/api/checkout` | Body `{ plan, quantity? }` → `{ id, url }` |
| `GET` | `/api/order/:id` | Order summary for the success page |
| `POST` | `/api/webhook` | Stripe events (raw body, signature-verified) |

Plans: `single` ($8.00 · 1 capsule), `mammoth` ($20.00 · 3 capsules),
`beast` ($50.00 · 10 capsules) — defined in [`src/products.js`](src/products.js).

## Going live checklist

- [ ] Swap Stripe **test** keys for **live** keys (`sk_live_…`) + live webhook secret
- [ ] Confirm ShipStation orders import to the correct store
- [ ] Set `CLIENT_URL` to your production storefront
- [ ] (Recommended) add a real product tax setting / Stripe Tax if required
