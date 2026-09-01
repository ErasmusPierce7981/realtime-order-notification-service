import { createServer } from "node:http";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { orderUpdateSchema, prepareNotification } from "./order_notification.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = new InfraiRealtime(apiKey);

const sendJson = (response: import("node:http").ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-events") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const update = orderUpdateSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const notification = prepareNotification(update);
    const published = await infrai.publish(
      {
        channel: notification.channel,
        event: notification.event,
        data: notification.data,
        account_id: notification.account_id,
      },
      notification.idempotencyKey,
    );
    sendJson(response, 202, {
      accepted: true,
      orderId: update.orderId,
      event: notification.event,
      published,
    });
  } catch (error) {
    if (error instanceof InfraiError) {
      sendJson(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message,
      });
      return;
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "ZodError")) {
      sendJson(response, 400, { error: "Invalid order event" });
      return;
    }
    sendJson(response, 502, { error: "Notification could not be published" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Order notification service listening on port ${process.env.PORT ?? 3000}`);
});
