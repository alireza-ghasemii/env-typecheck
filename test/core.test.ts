import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "../src";

describe("createEnv", () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("parses and coerces environment variables with the provided schema", () => {
    process.env = {
      ...originalEnv,
      PORT: "3000",
      NODE_ENV: "test",
    };

    const env = createEnv(
      z.object({
        PORT: z.coerce.number(),
        NODE_ENV: z.enum(["development", "test", "production"]),
      }),
      { path: "missing.env", exitOnError: false },
    );

    expect(env).toEqual({
      PORT: 3000,
      NODE_ENV: "test",
    });
  });

  it("throws formatted validation errors when exitOnError is false", () => {
    process.env = { ...originalEnv };
    delete process.env.REQUIRED_VALUE;

    expect(() =>
      createEnv(
        z.object({
          REQUIRED_VALUE: z.string(),
        }),
        { path: "missing.env", exitOnError: false },
      ),
    ).toThrow("REQUIRED_VALUE");
  });

  it("loads multiple env files without overriding values loaded first", () => {
    const dir = mkdtempSync(join(tmpdir(), "env-typecheck-"));
    tempDirs.push(dir);

    const firstFile = join(dir, ".env.local");
    const secondFile = join(dir, ".env");

    writeFileSync(firstFile, "PORT=3000\nDATABASE_URL=https://local.example\n");
    writeFileSync(secondFile, "PORT=4000\nNODE_ENV=production\n");

    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
    delete process.env.NODE_ENV;

    const env = createEnv(
      z.object({
        PORT: z.coerce.number(),
        DATABASE_URL: z.string().url(),
        NODE_ENV: z.enum(["development", "test", "production"]),
      }),
      { path: [firstFile, secondFile], exitOnError: false },
    );

    expect(env).toEqual({
      PORT: 3000,
      DATABASE_URL: "https://local.example",
      NODE_ENV: "production",
    });
  });

  it("prints errors and exits by default when validation fails", () => {
    process.env = { ...originalEnv };
    delete process.env.REQUIRED_VALUE;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`process.exit:${code}`);
    }) as typeof process.exit);

    expect(() =>
      createEnv(
        z.object({
          REQUIRED_VALUE: z.string(),
        }),
        { path: "missing.env" },
      ),
    ).toThrow("process.exit:1");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid environment variables"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
