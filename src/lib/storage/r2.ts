import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { attachmentDisposition } from "@/lib/storage/disposition";
import type { IStorageService, StoredObjectHead } from "@/lib/storage/types";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const signedPutHeaders = new Set(["content-type", "content-length"]);

export function r2ConfigFromEnv(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function createR2Storage(config: R2Config): IStorageService {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async presignPut(input) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: input.expiresInSeconds,
        signableHeaders: signedPutHeaders,
      });

      return {
        url,
        headers: {
          "Content-Type": input.contentType,
        },
      };
    },
    async presignGet(input) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: input.key,
        ResponseContentDisposition: input.downloadName
          ? attachmentDisposition(input.downloadName)
          : undefined,
      });

      return getSignedUrl(client, command, {
        expiresIn: input.expiresInSeconds,
      });
    },
    async headObject(key): Promise<StoredObjectHead | null> {
      try {
        const head = await client.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }),
        );

        return {
          contentLength: Number(head.ContentLength ?? 0),
          contentType: head.ContentType ?? null,
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error.name === "NotFound" || error.name === "NoSuchKey")
        ) {
          return null;
        }

        const status =
          typeof error === "object" &&
          error !== null &&
          "$metadata" in error &&
          typeof error.$metadata === "object" &&
          error.$metadata !== null &&
          "httpStatusCode" in error.$metadata
            ? error.$metadata.httpStatusCode
            : undefined;

        if (status === 404) {
          return null;
        }

        throw error;
      }
    },
    async deleteObject(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
    },
    async deletePrefix(prefix) {
      let token: string | undefined;

      do {
        const listed = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        const objects = (listed.Contents ?? [])
          .map((item) => item.Key)
          .filter((key): key is string => Boolean(key))
          .map((key) => ({ Key: key }));

        if (objects.length > 0) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: config.bucket,
              Delete: { Objects: objects },
            }),
          );
        }

        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
