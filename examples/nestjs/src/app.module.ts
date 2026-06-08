import { Module } from "@nestjs/common";
import { EnvModule } from "env-typecheck/nestjs";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { envSchema } from "./env.schema";

@Module({
  imports: [
    EnvModule.forRoot({
      isGlobal: true,
      schema: envSchema,
      envFilePath: [".env.local", ".env"],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
