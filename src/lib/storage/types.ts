export type PresignedPut = {
  url: string;
  headers: {
    "Content-Type": string;
  };
};

export type StoredObjectHead = {
  contentLength: number;
  contentType: string | null;
};

export interface IStorageService {
  presignPut(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<PresignedPut>;
  presignGet(input: {
    key: string;
    expiresInSeconds: number;
    downloadName?: string;
  }): Promise<string>;
  headObject(key: string): Promise<StoredObjectHead | null>;
  deleteObject(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}
