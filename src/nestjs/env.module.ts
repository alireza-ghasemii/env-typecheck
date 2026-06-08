import {
  DynamicModule,
  Module,
  Provider,
  InjectionToken,
} from "@nestjs/common";
import { z, ZodObject, ZodRawShape } from "zod";
import { config as loadDotenv } from "dotenv";
import { formatErrors } from "../core/reporter";
import { EnvService } from "./env.service";

export const ENV_CONFIG = Symbol("ENV_CONFIG");

export interface EnvModuleOptions<T extends ZodRawShape> {
  /** Zod schema که متغیرهای محیطی رو validate می‌کنه */
  schema: ZodObject<T>;
  /** مسیر فایل .env — پیش‌فرض: '.env' */
  envFilePath?: string | string[];
  /** اگه true باشه، module رو Global می‌کنه (نیازی به import در هر ماژول نیست) */
  isGlobal?: boolean;
  /**
   * اگه validation fail بشه چیکار کنه:
   * - 'exit'  → process.exit(1) — پیش‌فرض
   * - 'throw' → throw Error
   */
  onError?: "exit" | "throw";
  /**
   * متغیرهایی که نباید در log نشون داده بشن
   * پیش‌فرض: ['PASSWORD', 'SECRET', 'KEY', 'TOKEN']
   */
  redactKeys?: string[];
}

/**
 * یه injection token type-safe می‌سازه
 *
 * @example
 * export const AppConfig = envToken<typeof envSchema>();
 * // بعد در constructor:
 * constructor(@Inject(AppConfig) private env: EnvConfig<typeof envSchema>) {}
 */
export function envToken<T extends ZodObject<ZodRawShape>>(): InjectionToken {
  return ENV_CONFIG;
}

export type EnvConfig<T extends ZodObject<ZodRawShape>> = z.infer<T>;

@Module({})
export class EnvModule {
  /**
   * EnvModule رو با یه schema register می‌کنه
   *
   * @example
   * EnvModule.forRoot({
   *   isGlobal: true,
   *   schema: z.object({
   *     PORT: z.coerce.number().default(3000),
   *     DATABASE_URL: z.string().url(),
   *   }),
   * })
   */
  static forRoot<T extends ZodRawShape>(
    options: EnvModuleOptions<T>,
  ): DynamicModule {
    const parsed = EnvModule.parseAndValidate(options);
    const configProvider = EnvModule.buildProvider(parsed);

    return {
      module: EnvModule,
      global: options.isGlobal ?? false,
      providers: [configProvider, EnvService],
      exports: [configProvider, EnvService],
    };
  }

  /**
   * برای وقتی که config رو باید async بخونی (مثلاً از Vault یا SSM)
   *
   * @example
   * EnvModule.forRootAsync({
   *   isGlobal: true,
   *   schema: appEnvSchema,
   *   useFactory: async () => {
   *     await fetchSecretsFromVault();
   *     return { envFilePath: '.env.production' };
   *   },
   * })
   */
  static forRootAsync<T extends ZodRawShape>(options: {
    schema: ZodObject<T>;
    isGlobal?: boolean;
    onError?: "exit" | "throw";
    redactKeys?: string[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<{ envFilePath?: string }> | { envFilePath?: string };
    inject?: InjectionToken[];
  }): DynamicModule {
    const asyncProvider: Provider = {
      provide: ENV_CONFIG,
      useFactory: async (...args: unknown[]) => {
        const factoryResult = await options.useFactory(...args);
        return EnvModule.parseAndValidate({
          ...options,
          envFilePath: factoryResult.envFilePath,
        });
      },
      inject: options.inject ?? [],
    };

    return {
      module: EnvModule,
      global: options.isGlobal ?? false,
      providers: [asyncProvider, EnvService],
      exports: [asyncProvider, EnvService],
    };
  }

  private static parseAndValidate<T extends ZodRawShape>(
    options: EnvModuleOptions<T>,
  ): z.infer<ZodObject<T>> {
    // یه یا چند .env فایل رو load می‌کنه
    const paths = Array.isArray(options.envFilePath)
      ? options.envFilePath
      : [options.envFilePath ?? ".env"];

    for (const path of paths) {
      loadDotenv({ path, override: false });
    }

    const result = options.schema.safeParse(process.env);

    if (!result.success) {
      const msg =
        "\n[env-typecheck] ❌ Invalid environment variables:\n" +
        formatErrors(result.error) +
        "\n";

      if (options.onError === "throw") {
        throw new Error(msg);
      }

      console.error(msg);
      process.exit(1);
    }

    // لاگ موفقیت — کلیدهای حساس رو پنهان می‌کنه
    const redactPatterns = options.redactKeys ?? [
      "PASSWORD",
      "SECRET",
      "KEY",
      "TOKEN",
      "PRIVATE",
    ];
    const safeView = EnvModule.redactSensitiveKeys(
      result.data as Record<string, unknown>,
      redactPatterns,
    );
    console.log("[env-typecheck] ✅ Environment validated:", safeView);

    return result.data;
  }

  private static buildProvider(parsed: unknown): Provider {
    return {
      provide: ENV_CONFIG,
      useValue: parsed,
    };
  }

  private static redactSensitiveKeys(
    data: Record<string, unknown>,
    patterns: string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => {
        const isSensitive = patterns.some((p) =>
          k.toUpperCase().includes(p.toUpperCase()),
        );
        return [k, isSensitive ? "***" : v];
      }),
    );
  }
}
