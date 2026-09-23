import { log } from "@/lib/observability/logger";

export function register() {}

/** Erros não tratados em renderização, Server Actions e Route Handlers, sem dados sensíveis. */
export function onRequestError(error: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }, context: { routerKind: string; routeType: string }) {
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest) : undefined;
  log("error", "app.unhandled", {
    error: error instanceof Error ? error.name : typeof error, digest,
    path: request.path.split("?")[0], method: request.method, routeType: context.routeType,
    requestId: typeof request.headers["x-request-id"] === "string" ? request.headers["x-request-id"] : undefined,
  });
}
