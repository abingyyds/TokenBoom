# TokenBoomAi

TokenBoomAi is a high-energy token marketplace and OpenAI-compatible API storefront for selling AI model credits.

Customers see a direct token flow: choose a plan, pay with Creem, receive active credits, create API keys, and call models through one stable API base URL.

## What Changed

- New default `saas` theme with the TokenBoomAi brand, neon token-market visuals, and a boom-style splash screen.
- Subscription-first package page with Creem checkout through the site SaaS backend.
- Site admin page for Creem settings, package mapping, and balance code pools.
- Site-owned webhook flow for activation and renewals.
- Model pricing page restyled to match the TokenBoomAi product shell.
- Main navigation no longer promotes manual top-up.
- Local development falls back to mock token plans when the backend is not running.

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
- downstream API base URL
- package to Creem product mapping
- balance redemption code pools grouped by target package

## Internal Flow

1. User selects a SaaS plan on `/packages`.
2. Frontend calls `POST /api/site/saas/checkout`.
3. Site SaaS backend creates a Creem subscription checkout.
4. Creem confirms payment or renewal through `POST /api/site/saas/webhooks/creem`.
5. Site SaaS backend redeems one balance code to the downstream account.
6. Site SaaS backend calls the existing package subscribe endpoint.
7. Frontend shows the active credits as a TokenBoomAi plan.

Details: `docs/site-owned-saas-billing.md`.

## Railway Deployment

Railway now needs only one service. `npm start` serves the frontend, the site-owned SaaS backend, and the API proxy.

See `docs/railway-deploy.md`.
