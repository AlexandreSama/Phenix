// apps/api/src/validation.ts
import { BadRequestException, StandardSchemaValidationPipe } from "@nestjs/common";
import type { ValidationErrorResponse } from "@phenix/shared";

export type FieldError = ValidationErrorResponse["errors"][number];

/** 400 au format attendu par le panel : une erreur par champ */
export function validationError(errors: FieldError[]): BadRequestException {
    const body: ValidationErrorResponse = { statusCode: 400, message: "Requête invalide", errors };
    return new BadRequestException(body);
}

/**
 * Pipe global : valide tout paramètre déclaré avec { schema } (Zod ou tout schéma Standard Schema),
 * par exemple @Body({ schema: guildConfigPatchSchema }).
 */
export const validationPipe = new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
        validationError(
            issues.map((issue) => ({
                path: (issue.path ?? []).map((segment) => String(typeof segment === "object" ? segment.key : segment)).join("."),
                message: issue.message,
            })),
        ),
});