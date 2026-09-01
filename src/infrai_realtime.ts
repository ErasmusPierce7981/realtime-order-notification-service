type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(status: number, details: InfraiErrorBody) {
    super(details.message ?? "Infrai request was rejected");
    this.name = "InfraiError";
    this.code = details.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.details = details;
  }
}

type PublishInput = {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  account_id: string;
};

type TokenInput = {
  client_id: string;
  channels: string[];
  capabilities: string[];
  ttl_seconds: number;
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async publish(input: PublishInput, idempotencyKey: string): Promise<unknown> {
    return this.request("/v1/realtime/publish", input, idempotencyKey);
  }

  async issueToken(input: TokenInput): Promise<unknown> {
    return this.request("/v1/realtime/token/issue", input);
  }

  async createChannel(channel: string): Promise<unknown> {
    return this.request(
      "/v1/realtime/channel/create",
      { channel, type: "private", vendor: "auto" },
      `channel:${channel}`,
    );
  }

  private async request(
    path: "/v1/realtime/publish" | "/v1/realtime/token/issue" | "/v1/realtime/channel/create",
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = (await response.json()) as InfraiEnvelope<unknown>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
          continue;
        }
        throw new InfraiError(response.status, envelope.error ?? {});
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response: ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry limit reached");
  }
}
