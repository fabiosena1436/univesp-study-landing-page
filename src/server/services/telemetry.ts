import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { withRequestId } from "@/lib/requestContext";
import { handleError } from "@/lib/errors";

export function instrument<A extends unknown[]>(route: string, method: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const request = args[0] instanceof Request ? args[0] : null;
    const forwarded = request?.headers.get("x-request-id");
    const requestId = forwarded && /^[a-f0-9-]{36}$/i.test(forwarded) ? forwarded : randomUUID();
    const start = performance.now();
    return withRequestId(requestId, async () => {
      let response: Response;
      try { response = await handler(...args); }
      catch (error) { response = handleError(error); }
      const durationMs = Math.round(performance.now() - start);
      const configured = Number(process.env.API_SLOW_MS ?? 2000);
      const threshold = Number.isFinite(configured) && configured > 0 ? configured : 2000;
      const log = { event: response.status >= 500 ? "api.failure" : durationMs > threshold ? "api.slow" : "api.request", requestId, route, method, status: response.status, durationMs };
      if (response.status >= 500) console.error(JSON.stringify(log));
      else if (durationMs > threshold) console.warn(JSON.stringify(log));
      else console.info(JSON.stringify(log));
      response.headers.set("X-Request-Id", requestId);
      response.headers.set("Server-Timing", `app;dur=${durationMs}`);
      return response;
    });
  };
}
