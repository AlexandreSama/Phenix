// src/storage/storage.service.ts
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

@Injectable()
export class StorageService implements OnModuleInit {
    readonly bucket: string;
    private readonly s3: S3Client;

    constructor(config: ConfigService) {
        this.bucket = config.getOrThrow<string>("S3_BUCKET");
        this.s3 = new S3Client({
            endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
            region: "us-east-1", // ignorée par SeaweedFS, mais exigée par le SDK
            forcePathStyle: true, // http://hote:8333/bucket/cle plutôt que http://bucket.hote
            credentials: {
                accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
                secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
            },
            // Le SDK ajoute par défaut des sommes de contrôle que tous les serveurs compatibles S3 ne gèrent pas
            requestChecksumCalculation: "WHEN_REQUIRED",
            responseChecksumValidation: "WHEN_REQUIRED",
        });
    }

    /** Crée le bucket au premier démarrage */
    async onModuleInit() {
        try {
            await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch {
            await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        }
    }

    async put(objectKey: string, body: Buffer, contentType: string) {
        await this.s3.send(
            new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: contentType }),
        );
    }

    /** Flux de l'objet, à renvoyer au navigateur après vérification des droits */
    async get(objectKey: string) {
        const object = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
        return object.Body;
    }
}