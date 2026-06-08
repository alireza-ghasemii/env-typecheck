import { z, ZodObject, ZodRawShape } from "zod";
import { config } from "dotenv";
import { formatErrors } from "./reporter";

export function createEnv<T extends ZodRawShape>(
  schema: ZodObject<T>,
  options: { path?: string | string[]; exitOnError?: boolean } = {},
): z.infer<ZodObject<T>> {
  const paths = Array.isArray(options.path)
    ? options.path
    : [options.path ?? ".env"];

  for (const path of paths) {
    config({ path, override: false });
  }

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const message = formatErrors(result.error);
    if (options.exitOnError !== false) {
      console.error(
        "\n[env-typecheck] Invalid environment variables:\n" + message,
      );
      process.exit(1);
    }
    throw new Error(message);
  }

  return result.data;
}
