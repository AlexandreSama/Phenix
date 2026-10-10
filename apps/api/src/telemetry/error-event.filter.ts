import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import type { Request } from "express";
import { TelemetryService } from "./telemetry.service.js";

/**
 * Journalise les erreurs serveur, puis laisse Nest répondre comme d'habitude
 * ({"statusCode":500,"message":"Internal server error"}, sans détail pour le client).
 * Les HttpException 4xx (validation, 401, 404…) sont des réponses normales : ignorées.
 */
@Catch()
export class ErrorEventFilter extends BaseExceptionFilter {
    constructor(
        adapterHost: HttpAdapterHost,
        private readonly telemetry: TelemetryService,
    ) {
        super(adapterHost.httpAdapter);
    }

    override catch(exception: unknown, host: ArgumentsHost) {
        const expected = exception instanceof HttpException && exception.getStatus() < 500;
        if (!expected && host.getType() === "http") {
            const req = host.switchToHttp().getRequest<Request>();
            const guildId = req.params?.["guildId"];
            void this.telemetry.recordError(exception, {
                method: req.method,
                route: req.route?.path ?? req.path, // le motif ("/guilds/:guildId/config") quand une route a répondu
                guildId: typeof guildId === "string" ? guildId : null,
            });
        }
        super.catch(exception, host);
    }
}