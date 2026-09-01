import assert from "node:assert/strict";
import test from "node:test";
import { orderUpdateSchema, prepareNotification } from "../src/order_notification.js";

test("a shipped order becomes one private customer event", () => {
  const update = orderUpdateSchema.parse({
    kind: "fulfillment_shipped",
    orderId: "ord_2048",
    customerId: "cus_91",
    carrier: "Parcel Post",
    trackingNumber: "PKG-4402",
  });

  assert.deepEqual(prepareNotification(update), {
    channel: "customer:cus_91:orders",
    event: "fulfillment.shipped",
    data: update,
    account_id: "cus_91",
    idempotencyKey: "order:ord_2048:fulfillment_shipped",
  });
});
