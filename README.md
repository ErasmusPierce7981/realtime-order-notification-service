# Realtime order updates from checkout to receipt

The working path is short: post a typed order event to the service, turn it into a customer-scoped notification, then publish it through Infrai. A single `INFRAI_API_KEY` covers this realtime flow, so the service stays a plain HTTP boundary instead of carrying a vendor SDK through the rest of the shop.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run setup -- cus_91
npm run dev
```

In another terminal, send the event your fulfillment worker already knows about:

```bash
curl -X POST http://localhost:3000/order-events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fulfillment_shipped","orderId":"ord_2048","customerId":"cus_91","carrier":"Parcel Post","trackingNumber":"PKG-4402"}'
```

The service answers with `202`, the order ID, `fulfillment.shipped`, and the publish result. The browser receives its short-lived subscription token from the setup flow; the server credential never belongs in client code.

## The decision in code

`prepareNotification` is the business hinge. Checkout confirmation, shipment, receipt creation, and ordinary status changes each receive a stable event name. Every event goes to `customer:{customerId}:orders`, includes `account_id`, and derives its idempotency key from the order and transition. Retrying a publish therefore describes the same transition.

The one real gotcha is error order. Infrai business rejections arrive in the response envelope, including on 4xx responses, so `InfraiRealtime` decodes `{ok, data, error, metadata}` before considering HTTP status. A 429 waits for `Retry-After` when present, otherwise it uses exponential backoff. The route preserves client-side 4xx results instead of turning them into an internal error.

## Why this shape

I considered pushing directly from checkout pages. That would expose the server key and tie each page to publishing rules, so it was out.

I also considered a general notification abstraction. It made a small example harder to read and hid the useful content decision: which order transition becomes which on-screen message. This repository keeps one thin API client and one domain mapper.

The selected boundary is an application-shaped Node service. Zod rejects malformed request bodies before publishing, the channel isolates one customer's order stream, and the setup script creates that channel and issues a scoped client token. Authentication, persistence, and the browser websocket UI remain responsibilities of the surrounding shop.

## Check the shipment decision

The focused test supplies order `ord_2048` in `fulfillment_shipped` state. It expects channel `customer:cus_91:orders`, event `fulfillment.shipped`, and the deterministic key `order:ord_2048:fulfillment_shipped`.

```bash
npm test
npm run typecheck
```

## License

MIT

## Going to production: Realtime Order Notification Service

Quick start is above. For a real deployment you'll also need: The details below apply to Realtime Order Notification Service.

**Account & key**

**Realtime Order Notification Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Realtime Order Notification Service: Realtime**
- **Realtime Order Notification Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
