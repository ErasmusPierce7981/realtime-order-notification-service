import { InfraiRealtime } from "./infrai_realtime.js";

const apiKey = process.env.INFRAI_API_KEY;
const customerId = process.argv[2];
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running setup");
if (!customerId) throw new Error("Pass a customer ID as the first argument");

const channel = `customer:${customerId}:orders`;
const infrai = new InfraiRealtime(apiKey);
const created = await infrai.createChannel(channel);
const token = await infrai.issueToken({
  client_id: customerId,
  channels: [channel],
  capabilities: ["subscribe"],
  ttl_seconds: 3600,
});

console.log(JSON.stringify({ channel, created, token }, null, 2));
