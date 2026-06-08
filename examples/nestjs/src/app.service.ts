import { Injectable } from "@nestjs/common";
import { EnvService } from "@alireza_ghasemi/env-typecheck/nestjs";
import { envSchema } from "./env.schema";

@Injectable()
export class AppService {
  constructor(private readonly env: EnvService<typeof envSchema>) {}

  getHealth() {
    return {
      ok: true,
      environment: this.env.get("NODE_ENV"),
      databaseConfigured: Boolean(this.env.get("DATABASE_URL")),
    };
  }
}
