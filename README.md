# env-typecheck

Type-safe environment variable validation for TypeScript projects, powered by
[Zod](https://zod.dev/) and [dotenv](https://github.com/motdotla/dotenv).

Use it in Express, NestJS, CLIs, workers, queues, scripts, or any Node.js app
that needs validated configuration at startup.

## Why env-typecheck?

Environment variables are always strings at runtime, but applications usually
need numbers, booleans, URLs, enums, optional values, defaults, and clear startup
errors. `env-typecheck` lets you describe your environment once with Zod and then
use the parsed result with full TypeScript inference.

Benefits:

- Type-safe env access from your Zod schema.
- Runtime validation before the app starts serving traffic.
- Automatic coercion through Zod, such as `"3000"` to `3000`.
- Helpful formatted error messages for missing or invalid variables.
- Works with one `.env` file or multiple `.env` files.
- Lightweight core API for Express and plain TypeScript projects.
- Optional NestJS module with dependency injection support.
- ESM and CommonJS builds.
- Sensitive values are redacted in NestJS validation logs by default.

## Installation

```bash
npm install env-typecheck zod dotenv
```

`zod` and `dotenv` are regular dependencies of this package, so installing
`env-typecheck` is enough for most npm setups. They are shown above because most
projects also import `z` directly in their own schema files.

For NestJS usage, your application should already have Nest installed:

```bash
npm install @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Quick Start

```ts
import { createEnv, z } from "env-typecheck";

export const env = createEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    ENABLE_JOBS: z.coerce.boolean().default(false),
  }),
);

env.PORT; // number
env.DATABASE_URL; // string
env.ENABLE_JOBS; // boolean
```

If validation fails, the process exits by default with a readable error message.

```txt
[env-typecheck] Invalid environment variables:
  - DATABASE_URL: Invalid url
```

## Recommended Project Setup

Create a small env file and import it wherever configuration is needed.

```ts
// src/env.ts
import { createEnv, z } from "env-typecheck";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export const env = createEnv(envSchema);
export type Env = z.infer<typeof envSchema>;
```

Then use the parsed config:

```ts
// src/index.ts
import { env } from "./env";

console.log(`Starting server on port ${env.PORT}`);
```

## Express Usage

See the runnable example in [`examples/express`](examples/express).

```ts
import express from "express";
import { createEnv, z } from "env-typecheck";

const env = createEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    CORS_ORIGIN: z.string().url().optional(),
  }),
);

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    env: env.NODE_ENV,
  });
});

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
```

Because `env.PORT` is inferred as a `number`, you do not need to manually parse
it later in your application.

## NestJS Usage

NestJS support is exported from the `env-typecheck/nestjs` subpath.
See the runnable example in [`examples/nestjs`](examples/nestjs).

```ts
// src/env.schema.ts
import { z } from "env-typecheck";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
```

Register the module in your root module:

```ts
// src/app.module.ts
import { Module } from "@nestjs/common";
import { EnvModule } from "env-typecheck/nestjs";
import { envSchema } from "./env.schema";

@Module({
  imports: [
    EnvModule.forRoot({
      isGlobal: true,
      schema: envSchema,
      envFilePath: [".env.local", ".env"],
    }),
  ],
})
export class AppModule {}
```

Inject the typed service:

```ts
// src/app.service.ts
import { Injectable } from "@nestjs/common";
import { EnvService } from "env-typecheck/nestjs";
import { envSchema } from "./env.schema";

@Injectable()
export class AppService {
  constructor(private readonly env: EnvService<typeof envSchema>) {}

  getDatabaseUrl() {
    return this.env.get("DATABASE_URL");
  }

  getPort() {
    return this.env.get("PORT");
  }
}
```

Useful `EnvService` helpers:

```ts
this.env.get("PORT"); // typed value
this.env.getOrDefault("PORT", 3000); // fallback only when value is undefined
this.env.getAll(); // shallow copy of the parsed config
this.env.isDevelopment; // NODE_ENV === "development"
this.env.isProduction; // NODE_ENV === "production"
this.env.isTest; // NODE_ENV === "test"
```

### NestJS Async Registration

Use `forRootAsync` when the env file path depends on another provider or an async
operation.

```ts
import { Module } from "@nestjs/common";
import { EnvModule } from "env-typecheck/nestjs";
import { envSchema } from "./env.schema";

@Module({
  imports: [
    EnvModule.forRootAsync({
      isGlobal: true,
      schema: envSchema,
      useFactory: async () => {
        return {
          envFilePath:
            process.env.NODE_ENV === "production" ? ".env.production" : ".env",
        };
      },
    }),
  ],
})
export class AppModule {}
```

### Injecting the Raw Config in NestJS

You can also inject the parsed object directly.

```ts
import { Inject, Injectable } from "@nestjs/common";
import { ENV_CONFIG, EnvConfig } from "env-typecheck/nestjs";
import { envSchema } from "./env.schema";

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(ENV_CONFIG)
    private readonly env: EnvConfig<typeof envSchema>,
  ) {}
}
```

## API

### `createEnv(schema, options?)`

Validates `process.env` with a Zod object schema and returns the parsed result.

```ts
const env = createEnv(schema, {
  path: ".env",
  exitOnError: true,
});
```

Options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | `string | string[]` | `".env"` | One or more dotenv files to load before validation. |
| `exitOnError` | `boolean` | `true` | When `true`, validation errors are printed and the process exits with code `1`. When `false`, an error is thrown. |

### `EnvModule.forRoot(options)`

Registers the NestJS module synchronously.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `schema` | `ZodObject` | required | Zod schema used to validate `process.env`. |
| `envFilePath` | `string | string[]` | `".env"` | One or more dotenv files to load. |
| `isGlobal` | `boolean` | `false` | Makes the module global in NestJS. |
| `onError` | `"exit" | "throw"` | `"exit"` | Controls validation failure behavior. |
| `redactKeys` | `string[]` | `["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"]` | Key patterns hidden in success logs. |

### `EnvModule.forRootAsync(options)`

Registers the NestJS module with an async factory.

```ts
EnvModule.forRootAsync({
  schema,
  inject: [],
  useFactory: async () => ({
    envFilePath: ".env",
  }),
});
```

### `EnvService<TSchema>`

NestJS injectable wrapper around the parsed config.

| Method / getter | Description |
| --- | --- |
| `get(key)` | Returns a typed value from the parsed config. |
| `getOrDefault(key, defaultValue)` | Returns the value or a fallback when the value is `undefined`. |
| `getAll()` | Returns a shallow copy of all parsed config values. |
| `isDevelopment` | `true` when `NODE_ENV` is `"development"`. |
| `isProduction` | `true` when `NODE_ENV` is `"production"`. |
| `isTest` | `true` when `NODE_ENV` is `"test"`. |

## Multiple `.env` Files

Both the core API and NestJS module support multiple dotenv files.

```ts
const env = createEnv(schema, {
  path: [".env.local", ".env"],
});
```

```ts
EnvModule.forRoot({
  schema,
  envFilePath: [".env.local", ".env"],
});
```

Files are loaded in the order you provide. Existing environment variables are
not overwritten because dotenv is loaded with `override: false`.

## Type Inference

Types come directly from the schema.

```ts
const schema = z.object({
  PORT: z.coerce.number(),
  NODE_ENV: z.enum(["development", "production"]),
});

const env = createEnv(schema);

env.PORT.toFixed(0); // OK, PORT is number
env.NODE_ENV; // "development" | "production"
```

## Common Patterns

### Required Secret

```ts
JWT_SECRET: z.string().min(32)
```

### Optional Value

```ts
SENTRY_DSN: z.string().url().optional()
```

### Default Number

```ts
PORT: z.coerce.number().int().positive().default(3000)
```

### Boolean Flag

```ts
ENABLE_JOBS: z.coerce.boolean().default(false)
```

### Comma-separated List

```ts
ALLOWED_ORIGINS: z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()))
  .default("http://localhost:3000")
```

## Security Notes

- Do not commit real `.env` files.
- Keep `.env.example` in your repository with safe placeholder values.
- Validate secrets at startup so broken deployments fail early.
- In NestJS, validation success logs redact keys containing `PASSWORD`,
  `SECRET`, `KEY`, `TOKEN`, or `PRIVATE` by default.
- Customize `redactKeys` if your project uses different secret naming.

## Publishing Checklist

Before publishing a new version:

```bash
npm run typecheck
npm test
npm run build
npm audit
npm pack --dry-run
```

The package exports:

```ts
import { createEnv, z } from "env-typecheck";
import { EnvModule, EnvService } from "env-typecheck/nestjs";
```

## License

MIT
