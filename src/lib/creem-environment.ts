export class CreemConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreemConfigurationError";
  }
}

/** Never silently send a production key to the sandbox. */
export function resolveCreemServer(value: string | undefined, apiKey: string): "prod" | "test" {
  const mode = value?.trim().toLowerCase();
  const server = mode === "prod" || mode === "live" || mode === "production"
    ? "prod"
    : mode === "test" ? "test" : null;
  if (!server) {
    throw new CreemConfigurationError("Set CREEM_SERVER explicitly to test or prod, matching the API key and product environment.");
  }
  if (server === "prod" && apiKey.startsWith("creem_test_")) {
    throw new CreemConfigurationError("CREEM_SERVER is prod but CREEM_API_KEY is a test key.");
  }
  if (server === "test" && apiKey.startsWith("creem_") && !apiKey.startsWith("creem_test_")) {
    throw new CreemConfigurationError("CREEM_SERVER is test but CREEM_API_KEY is a live key.");
  }
  return server;
}
