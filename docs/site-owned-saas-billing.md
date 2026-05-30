# Site-Owned SaaS Billing

This project keeps the customer-facing experience as a SaaS subscription:

1. User chooses a plan.
2. User completes Creem checkout.
3. The subscription activates automatically.
4. Future paid renewals extend the plan automatically.

The user should not see balance recharge, redemption codes, or a second package purchase step.

## Internal Activation Flow

The site owns the SaaS billing layer. SubRouter remains the downstream account, balance, and package API.

On each paid checkout or renewal webhook:

1. The distributor generates a SaaS activation token in the SubRouter distributor console.
2. Site SaaS backend finds the target package for the paid order.
3. Site SaaS backend reserves one available owner redemption code from the pool for that package.
4. Site SaaS backend calls SubRouter `POST /api/dist/internal/saas/activate` with the SaaS activation token, target user, package, code, and order ID.
5. SubRouter validates the distributor site, token, user ownership, package ownership, code ownership, and quota in one transaction.
6. Site SaaS backend records the subscription state for the frontend.

The SubRouter activation endpoint is atomic: code consumption, package subscription creation, and distributor package-pool funding succeed or fail together. If the HTTP result is unknown, the order is marked `activation_pending` and retried with the same reserved code and order ID.

## Site Admin

Run the site SaaS backend:

```bash
npm run saas:server
```

Open:

```text
/site-admin/saas
```

The owner configures:

- Creem API key
- Creem webhook secret
- SubRouter API base URL
- SubRouter SaaS activation token
- SubRouter package to Creem product mapping
- balance redemption code pools grouped by target package

Set `SITE_ADMIN_TOKEN` for public deployments. If it is empty, only localhost development requests can access the admin console.

## Frontend Endpoints

The public frontend calls this site's SaaS endpoints:

- `GET /api/site/saas/subscriptions`
- `POST /api/site/saas/checkout`

The site admin calls:

- `GET /api/site/admin/saas/state`
- `PUT /api/site/admin/saas/config`
- `POST /api/site/admin/saas/codes/import`
- `POST /api/site/admin/saas/codes/release-failed`
- `POST /api/site/admin/saas/orders/activate`

Creem webhook should point to:

- `POST /api/site/saas/webhooks/creem`

## SubRouter Endpoints Used Internally

The site SaaS backend calls SubRouter:

- `GET /api/dist/site/packages`
- `POST /api/dist/internal/saas/activate`

Do not expose activation codes or the SaaS activation token to customers. They exist only so the site can use the current SubRouter package model while presenting a clean SaaS subscription product.
