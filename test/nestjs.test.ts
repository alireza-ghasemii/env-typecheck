import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ENV_CONFIG, EnvModule, EnvService } from "../src/nestjs";

describe("EnvModule", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("registers parsed config and EnvService providers", () => {
    process.env = {
      ...originalEnv,
      PORT: "3000",
      DATABASE_URL: "https://example.com",
      API_KEY: "secret-value",
    };

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const schema = z.object({
      PORT: z.coerce.number(),
      DATABASE_URL: z.string().url(),
      API_KEY: z.string(),
    });

    const moduleRef = EnvModule.forRoot({
      isGlobal: true,
      schema,
      envFilePath: "missing.env",
      onError: "throw",
    });

    expect(moduleRef.global).toBe(true);
    expect(moduleRef.providers).toContain(EnvService);
    expect(moduleRef.exports).toContain(EnvService);
    expect(moduleRef.providers).toContainEqual({
      provide: ENV_CONFIG,
      useValue: {
        PORT: 3000,
        DATABASE_URL: "https://example.com",
        API_KEY: "secret-value",
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      "[env-typecheck] ✅ Environment validated:",
      {
        PORT: 3000,
        DATABASE_URL: "https://example.com",
        API_KEY: "***",
      },
    );
  });

  it("throws formatted validation errors when onError is throw", () => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;

    expect(() =>
      EnvModule.forRoot({
        schema: z.object({
          DATABASE_URL: z.string().url(),
        }),
        envFilePath: "missing.env",
        onError: "throw",
      }),
    ).toThrow("DATABASE_URL");
  });
});

describe("EnvService", () => {
  it("returns typed config values and common NODE_ENV helpers", () => {
    const schema = z.object({
      NODE_ENV: z.enum(["development", "test", "production"]),
      PORT: z.number(),
      OPTIONAL_VALUE: z.string().optional(),
    });

    const service = new EnvService<typeof schema>({
      NODE_ENV: "production",
      PORT: 8080,
    });

    expect(service.get("PORT")).toBe(8080);
    expect(service.getOrDefault("OPTIONAL_VALUE", "fallback")).toBe("fallback");
    expect(service.getAll()).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
    });
    expect(service.isDevelopment).toBe(false);
    expect(service.isProduction).toBe(true);
    expect(service.isTest).toBe(false);
  });

  it("returns a shallow copy from getAll", () => {
    const schema = z.object({
      PORT: z.number(),
    });
    const config = { PORT: 3000 };
    const service = new EnvService<typeof schema>(config);
    const all = service.getAll();

    all.PORT = 4000;

    expect(service.get("PORT")).toBe(3000);
  });
});
