import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { appOrigin } from "@/lib/events/code";
import { isStorageKey } from "@/lib/uploads/policy";
import { storageSignature } from "@/lib/storage/signature";
import type { IStorageService, StoredObjectHead } from "@/lib/storage/types";

function storageRoot() {
  return path.resolve(process.cwd(), ".data", "storage");
}

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;

  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required for local storage signatures");
  }

  return value;
}

function objectPath(key: string) {
  if (!isStorageKey(key) || key.includes("..")) {
    throw new Error("Invalid storage key");
  }

  const root = storageRoot();
  const full = path.resolve(root, ...key.split("/"));

  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }

  return full;
}

function signedUrl(input: {
  method: "PUT" | "GET";
  key: string;
  contentType: string;
  contentLength: string;
  expiresInSeconds: number;
}) {
  const expiresAt = Date.now() + input.expiresInSeconds * 1000;
  const signature = storageSignature({
    method: input.method,
    key: input.key,
    contentType: input.contentType,
    contentLength: input.contentLength,
    expiresAt,
    secret: secret(),
  });
  const params = new URLSearchParams({
    method: input.method,
    key: input.key,
    contentType: input.contentType,
    contentLength: input.contentLength,
    expiresAt: String(expiresAt),
    signature,
  });

  return `${appOrigin()}/api/dev-storage?${params.toString()}`;
}

export function createLocalDiskStorage(): IStorageService {
  return {
    async presignPut(input) {
      return {
        url: signedUrl({
          method: "PUT",
          key: input.key,
          contentType: input.contentType,
          contentLength: String(input.contentLength),
          expiresInSeconds: input.expiresInSeconds,
        }),
        headers: {
          "Content-Type": input.contentType,
        },
      };
    },
    async presignGet(input) {
      return signedUrl({
        method: "GET",
        key: input.key,
        contentType: "",
        contentLength: "",
        expiresInSeconds: input.expiresInSeconds,
      });
    },
    async headObject(key): Promise<StoredObjectHead | null> {
      try {
        const info = await stat(objectPath(key));

        if (!info.isFile()) {
          return null;
        }

        let contentType: string | null = null;

        try {
          contentType = (await readFile(`${objectPath(key)}.type`, "utf8")).trim() || null;
        } catch {
          contentType = null;
        }

        return {
          contentLength: info.size,
          contentType,
        };
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }

        throw error;
      }
    },
    async deleteObject(key) {
      await rm(objectPath(key), { force: true });
      await rm(`${objectPath(key)}.type`, { force: true });
    },
    async deletePrefix(prefix) {
      if (!/^events\/[0-9a-f-]{36}\/$/.test(prefix)) {
        throw new Error("Invalid storage prefix");
      }

      await rm(path.resolve(storageRoot(), ...prefix.split("/").filter(Boolean)), {
        recursive: true,
        force: true,
      });
    },
  };
}

export async function writeSignedObject(
  key: string,
  body: Readable,
  byteLength: number,
  contentType: string,
) {
  const destination = objectPath(key);
  const partial = `${destination}.partial`;

  await mkdir(path.dirname(destination), { recursive: true });
  await pipeline(body, createWriteStream(partial));
  const written = await stat(partial);

  if (written.size !== byteLength) {
    await rm(partial, { force: true });
    throw new Error("Content length does not match the signed upload");
  }

  await rename(partial, destination);
  await writeFile(`${destination}.type`, contentType);
}

export async function readSignedObject(key: string) {
  return readFile(objectPath(key));
}

export async function readSignedContentType(key: string) {
  try {
    return (await readFile(`${objectPath(key)}.type`, "utf8")).trim();
  } catch {
    return "application/octet-stream";
  }
}
