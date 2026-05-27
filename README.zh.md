# AI SaaS 订阅系统前端

本项目基于 `abingyyds/Sub-Router` 改造，目标是面向海外市场的高端 AI SaaS 订阅站点。

用户前台只看到标准 SaaS 流程：选择套餐、Creem 支付、订阅自动激活、续费自动延续。内部由这个站点自己的 SaaS 后台处理自动化：先把站长放入码池的余额兑换码兑换到用户 SubRouter 账户，再自动调用原有套餐购买接口。

## 已改造内容

- 新增默认 `saas` 主题，高端 AI SaaS 首页和导航。
- 套餐页改成无感订阅页，用户不需要看到充值或兑换码。
- 新增站点自己的 SaaS 后台服务，负责 Creem checkout、webhook、续费和自动激活。
- 新增 `/site-admin/saas` 站长后台，用于配置 Creem、套餐映射和余额兑换码池。
- 模型定价页统一成 SaaS 风格。
- 主导航不再突出手动充值。
- 本地开发时如果 SubRouter 后端未启动，会回退到 mock SaaS 套餐数据，方便直接预览。

## 快速开始

```bash
npm install
npm run dev
```

另开一个终端启动站点自己的 SaaS 后台：

```bash
npm run saas:server
```

开发服务默认端口为 `3001`。`/api/site/*` 会代理到站点 SaaS 后台 `localhost:8787`；原有 SubRouter `/api/*` 仍代理到 `localhost:3000`。

## 站长后台

打开 `/site-admin/saas` 配置：

- Creem API Key 和 Webhook Secret
- SubRouter API Base URL
- SubRouter 套餐和 Creem Product 的映射
- 按目标套餐分组的余额兑换码池

## 内部流程

1. 用户在 `/packages` 选择 SaaS 套餐。
2. 前端调用 `POST /api/site/saas/checkout`。
3. 站点 SaaS 后台创建 Creem 订阅 checkout。
4. Creem 通过 `POST /api/site/saas/webhooks/creem` 通知支付或续费成功。
5. 站点 SaaS 后台取出该套餐分组下的一个余额兑换码，兑换到用户 SubRouter 账户。
6. 站点 SaaS 后台调用 SubRouter 原有套餐购买接口。
7. 前台展示为正常 SaaS 订阅。

详细说明见 `docs/site-owned-saas-billing.md`。

## Railway 部署

Railway 现在只需要一个服务：`npm start` 会同时提供前端、本站 SaaS 后台和 SubRouter API 代理。

详细步骤见 `docs/railway-deploy.md`。
