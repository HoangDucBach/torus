import { Hono } from "hono";
import { cors } from "hono/cors";
import { addresses } from "./contracts.ts";
import { env } from "./env.ts";
import { apiRoute } from "./routes/api.ts";
import { paymasterRoute } from "./routes/paymaster.ts";

const app = new Hono();

// This API is read-only/public data (stats, quotes) plus a stateless ERC-7677 endpoint — safe
// to allow any browser origin, matching the intent of a public dashboard like web/.
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "torus-server",
    network: env.network,
    vault: addresses.vault,
    paymaster: addresses.paymaster,
    endpoints: ["/paymaster (ERC-7677 pm_* RPC)", "/quote", "/stats"],
  })
);

app.route("/paymaster", paymasterRoute);
app.route("/", apiRoute);

console.log(`torus-server listening on :${env.port} (network=${env.network})`);

export default {
  port: env.port,
  fetch: app.fetch,
};
