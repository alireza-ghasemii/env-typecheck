import { Inject, Injectable } from "@nestjs/common";
import { z, ZodObject, ZodRawShape } from "zod";
import { ENV_CONFIG } from "./env.module";

/**
 * EnvService — یه wrapper type-safe روی config parse‌شده
 *
 * می‌تونی مستقیم ENV_CONFIG رو inject کنی، ولی این سرویس
 * متدهای کمکی هم داره (مثل get با default، isDev، isProd)
 *
 * @example
 * @Injectable()
 * export class AppService {
 *   constructor(private env: EnvService<typeof appEnvSchema>) {}
 *
 *   getPort() {
 *     return this.env.get('PORT'); // number — نه string!
 *   }
 * }
 */
@Injectable()
export class EnvService<
  T extends ZodObject<ZodRawShape> = ZodObject<ZodRawShape>,
> {
  private readonly config: z.infer<T>;

  constructor(@Inject(ENV_CONFIG) config: z.infer<T>) {
    this.config = config;
  }

  /**
   * مقدار یه کلید رو برمی‌گردونه
   * نوع خروجی کاملاً از schema استنتاج میشه
   */
  get<K extends keyof z.infer<T>>(key: K): z.infer<T>[K] {
    return this.config[key];
  }

  /**
   * مثل get ولی اگه مقدار undefined بود، defaultValue برمی‌گردونه
   */
  getOrDefault<K extends keyof z.infer<T>>(
    key: K,
    defaultValue: NonNullable<z.infer<T>[K]>,
  ): NonNullable<z.infer<T>[K]> {
    return (this.config[key] ?? defaultValue) as NonNullable<z.infer<T>[K]>;
  }

  /** کل config object رو برمی‌گردونه */
  getAll(): z.infer<T> {
    return { ...this.config };
  }

  /** helpers رایج */
  get isDevelopment(): boolean {
    return (
      (this.config as Record<string, unknown>)["NODE_ENV"] === "development"
    );
  }

  get isProduction(): boolean {
    return (
      (this.config as Record<string, unknown>)["NODE_ENV"] === "production"
    );
  }

  get isTest(): boolean {
    return (this.config as Record<string, unknown>)["NODE_ENV"] === "test";
  }
}
