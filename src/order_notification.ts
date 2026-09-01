import { z } from "zod";

export const orderUpdateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("checkout_confirmed"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    total: z.number().nonnegative(),
    currency: z.string().length(3),
  }),
  z.object({
    kind: z.literal("fulfillment_shipped"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    carrier: z.string().min(1),
    trackingNumber: z.string().min(1),
  }),
  z.object({
    kind: z.literal("receipt_ready"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    receiptId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("order_updated"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    status: z.enum(["processing", "packed", "delivered"]),
  }),
]);

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export function prepareNotification(update: OrderUpdate) {
  const eventByKind = {
    checkout_confirmed: "checkout.confirmed",
    fulfillment_shipped: "fulfillment.shipped",
    receipt_ready: "receipt.ready",
    order_updated: "order.updated",
  } as const;

  return {
    channel: `customer:${update.customerId}:orders`,
    event: eventByKind[update.kind],
    data: update,
    account_id: update.customerId,
    idempotencyKey: `order:${update.orderId}:${update.kind}`,
  };
}
