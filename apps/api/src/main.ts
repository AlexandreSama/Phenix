// apps/api/src/main.ts
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.use(cookieParser()); // remplit req.cookies (session, state OAuth2)
app.enableShutdownHooks(); // ferme Prisma et Redis proprement sur SIGTERM
await app.listen(Number(process.env["API_PORT"] ?? 3001));