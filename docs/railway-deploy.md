# Railway Deployment

This project is designed to run as one Railway service.

The single service does three things:

- serves the built React frontend;
- handles this site's SaaS endpoints under `/api/site/*`;
- proxies SubRouter endpoints under `/api/*`.

## Deploy

Create one Railway service from this GitHub repository:

```text
New Project -> Deploy from GitHub repo -> abingyyds/TokenBoom
```

Railway will use the root `Dockerfile`. No Caddy service and no second Node service are needed.

## Variables

Minimum variables:

```env
SITE_ADMIN_TOKEN=change_me
SUBROUTER_API_BASE=https://your-subrouter-backend.com
PUBLIC_SITE_URL=https://your-saas-domain.com
SUBROUTER_SITE_HOST=your-site.subrouter.ai
```

Optional variables:

```env
CREEM_API_KEY=creem_key
CREEM_WEBHOOK_SECRET=creem_webhook_secret
SUBROUTER_INTERNAL_TOKEN=optional_internal_token
SITE_SAAS_STORE=/data/site-saas-store.json
```

`SUBROUTER_API_BASE` must point to the real downstream backend, not to this TokenBoomAi domain.

`PUBLIC_SITE_URL` should be the domain users open in their browser. It is also used when the SaaS backend calls SubRouter during automatic activation.

`SUBROUTER_SITE_HOST` is the domain TokenBoomAi sends downstream for distributor-site lookup. Use the system domain from the downstream service when your public DNS points to Railway.

`SITE_SAAS_STORE` already defaults to `/data/site-saas-store.json` in Docker, so you normally do not need to set it manually.

## Volume

Attach a Railway volume mounted at:

```text
/data
```

This keeps the code pool, order records, and subscription records across redeploys.

## Domain

Bind your custom domain directly to this one Railway service.

Then configure the same domain in the SubRouter distributor-site settings, for example:

```text
ai.yourdomain.com
```

If the downstream admin page tells you to point DNS elsewhere, ignore that DNS step for this TokenBoomAi deployment. That instruction belongs to the original hosted distributor frontend.

For TokenBoomAi, DNS must point to the Railway service running this repository. The downstream service only needs the custom domain saved in its distributor-site settings so the backend can identify the site.

The downstream theme dropdown can stay on any value. TokenBoomAi always renders the dedicated `saas` theme.

## Site Admin

After deployment, open:

```text
https://your-saas-domain.com/site-admin/saas
```

Use `SITE_ADMIN_TOKEN`, then configure Creem, package mappings, and balance-code pools.

Creem webhook URL:

```text
https://your-saas-domain.com/api/site/saas/webhooks/creem
```

## Routing

The production entrypoint is `npm start`, which runs `server/railway-app.js`.

Request routing:

- `/api/site/*` is handled by this site's SaaS backend.
- `/api/*` is proxied to `SUBROUTER_API_BASE`.
- everything else serves the React SPA from `dist`.
