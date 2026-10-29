/**
 * birds-screensaver, host half.
 * Presentation-only package, plus one read-only route that exposes the row
 * config (default password / idle timeout) to the browser half, because client
 * module entries never receive Loader config.
 */
export const name = "birds-screensaver";

/** Required service: the Web route registry. */
export const inject = ["webServer"];

export function apply(ctx, config = {}) {
	const defaultPassword =
		typeof config.defaultPassword === "string" && config.defaultPassword.length > 0
			? config.defaultPassword
			: "1234";
	const idleMs = Number.isFinite(config.idleMs) && config.idleMs >= 10000 ? config.idleMs : 180000;

	const payload = JSON.stringify({ defaultPassword, idleMs });

	ctx.effect(() => {
		const dispose = ctx.webServer.register({
			kind: "exact",
			path: "/plugins/birds-screensaver/config",
			handler: (req, res) => {
				if (req.method !== "GET" && req.method !== "HEAD") {
					res.writeHead(405);
					res.end();
					return;
				}
				res.writeHead(200, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				});
				res.end(payload);
			},
		});
		return () => dispose();
	}, "birds-screensaver: config route");
}
