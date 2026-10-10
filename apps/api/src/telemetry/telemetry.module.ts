import { Global, type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ErrorEventFilter } from "./error-event.filter.js";
import { RequestMetricsMiddleware } from "./request-metrics.middleware.js";
import { TelemetryService } from "./telemetry.service.js";

@Global()
@Module({
    providers: [TelemetryService, { provide: APP_FILTER, useClass: ErrorEventFilter }],
    exports: [TelemetryService],
})
export class TelemetryModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestMetricsMiddleware).forRoutes("*");
    }
}