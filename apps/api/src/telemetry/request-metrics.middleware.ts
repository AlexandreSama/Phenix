import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { TelemetryService } from "./telemetry.service.js";

/** Mesure chaque requête, y compris celles refusées par un guard avant d'atteindre le contrôleur */
@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
    constructor(private readonly telemetry: TelemetryService) {}

    use(req: Request, res: Response, next: NextFunction) {
        if (req.originalUrl.split("?")[0] === "/health") return next(); // sondé par Docker toutes les 10 s : du bruit
        const startedAt = performance.now();
        res.on("finish", () => this.telemetry.recordRequest(performance.now() - startedAt, res.statusCode));
        next();
    }
}