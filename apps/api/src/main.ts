// src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: process.env["WEB_ORIGIN"], credentials: true });
app.enableShutdownHooks(); // ferme Prisma et Redis proprement sur SIGTERM
await app.listen(Number(process.env["API_PORT"] ?? 3001));