import express from "express";
import { env } from "./env";

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    environment: env.NODE_ENV,
  });
});

app.get("/config", (_req, res) => {
  res.json({
    port: env.PORT,
    corsOrigin: env.CORS_ORIGIN ?? null,
  });
});

app.listen(env.PORT, () => {
  console.log(`Express example is running on port ${env.PORT}`);
});
