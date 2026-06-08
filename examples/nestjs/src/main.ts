import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { EnvService } from "@alireza_ghasemi/env-typecheck/nestjs";
import { AppModule } from "./app.module";
import { envSchema } from "./env.schema";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get<EnvService<typeof envSchema>>(EnvService);

  await app.listen(env.get("PORT"));
  console.log(`NestJS example is running on port ${env.get("PORT")}`);
}

void bootstrap();
