# AI SaaS Subscription Frontend

This project started from `abingyyds/Sub-Router` and has been reshaped into a premium AI SaaS subscription site.

Customers see a normal SaaS flow: choose a plan, pay with Creem, and receive active credits automatically. Internally, this site owns the billing automation: it redeems an owner-provided balance code to the user's SubRouter account, then buys the target SubRouter package automatically.

## What Changed

- New default `saas` theme with a high-end AI SaaS landing page.
- Subscription-first package page with Creem checkout through the site SaaS backend.
- Site admin page for Creem settings, package mapping, and balance code pools.
- Site-owned webhook flow for activation and renewals.
- Model pricing page restyled to match the SaaS product shell.
- Main navigation no longer promotes manual top-up.
- Local development falls back to mock SaaS plans when the backend is not running.

## Quick Start

```bash
npm install
npm run dev
```

Run the site-owned SaaS backend in another terminal:

```bash
npm run saas:server
```

The Vite dev server runs on port `3001`. `/api/site/*` proxies to the site SaaS backend on `localhost:8787`; the existing SubRouter `/api/*` proxy still points to `localhost:3000`.

## Site Admin

Open `/site-admin/saas` to configure:

- Creem API key and webhook secret
- SubRouter API base URL
- package to Creem product mapping
- balance redemption code pools grouped by target package

## Internal Flow

1. User selects a SaaS plan on `/packages`.
2. Frontend calls `POST /api/site/saas/checkout`.
3. Site SaaS backend creates a Creem subscription checkout.
4. Creem confirms payment or renewal through `POST /api/site/saas/webhooks/creem`.
5. Site SaaS backend redeems one balance code to the user's SubRouter account.
6. Site SaaS backend calls SubRouter's existing package subscribe endpoint.
7. Frontend shows the active subscription as a normal SaaS plan.

Details: `docs/site-owned-saas-billing.md`.

## Railway Deployment

Railway now needs only one service. `npm start` serves the frontend, the site-owned SaaS backend, and the SubRouter API proxy.

See `docs/railway-deploy.md`.
