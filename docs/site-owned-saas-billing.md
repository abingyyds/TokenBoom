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

1. Site SaaS backend finds the target package for the order.
2. Site SaaS backend reserves one available balance redemption code from the owner-managed pool for that package.
3. Site SaaS backend calls SubRouter's existing `POST /api/dist/topup/redeem` for the paid user.
4. After balance is credited, site SaaS backend calls SubRouter's existing `POST /api/dist/package/subscribe`.
5. Site SaaS backend records the subscription state for the frontend.

If the balance redemption succeeds but package subscribe fails, the order is marked `package_subscribe_failed` so the owner can retry or handle it manually.

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
- optional SubRouter internal token
- SubRouter package to Creem product mapping
- balance redemption code pools grouped by target package

## Frontend Endpoints

The public frontend calls this site's SaaS endpoints:

- `GET /api/site/saas/subscriptions`
- `POST /api/site/saas/checkout`

The site admin calls:

- `GET /api/site/admin/saas/state`
- `PUT /api/site/admin/saas/config`
- `POST /api/site/admin/saas/codes/import`

Creem webhook should point to:

- `POST /api/site/saas/webhooks/creem`

## SubRouter Endpoints Used Internally

The site SaaS backend calls SubRouter:

- `GET /api/dist/site/packages`
- `POST /api/dist/topup/redeem`
- `POST /api/dist/package/subscribe`

Do not expose the internal balance-code flow to customers. It exists only so the site can use the current SubRouter balance and package purchase model while presenting a clean SaaS subscription product.
