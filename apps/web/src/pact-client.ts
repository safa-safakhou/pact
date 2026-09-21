import { type ClientRequest, type ClientResponse, type ClientTransport, PactClient } from "@pact/client-sdk";

export interface WebClientOptions {
  readonly apiOrigin: string;
  readonly csrfToken: () => string | undefined;
  readonly fetch: typeof fetch;
  readonly randomUuid?: () => string;
  readonly now?: () => Date;
}

class BrowserTransport implements ClientTransport {
  constructor(private readonly options: WebClientOptions) {}

  async send(request: ClientRequest): Promise<ClientResponse> {
    const csrf = request.method === "POST" ? this.options.csrfToken() : undefined;
    const response = await this.options.fetch(new URL(request.path, this.options.apiOrigin), {
      method: request.method,
      credentials: "include",
      headers: {
        ...request.headers,
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  }
}

export function createWebPactClient(options: WebClientOptions): PactClient<"human"> {
  return new PactClient({
    audience: "human",
    transport: new BrowserTransport(options),
    commandIds: { create: options.randomUuid ?? (() => crypto.randomUUID()) },
    clock: { now: options.now ?? (() => new Date()) },
  });
}
