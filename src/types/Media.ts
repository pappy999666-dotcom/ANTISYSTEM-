/**
 * PAPPYBOT V2 — Media Type Definitions
 */

export type MediaType = 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';

export interface MediaInfo {
  /** Detected MIME type */
  mimeType: string;
  /** Detected media type */
  type: MediaType;
  /** File size in bytes */
  size: number;
  /** Original filename if available */
  fileName?: string;
  /** Local temp path if stored */
  tempPath?: string;
}

export interface UploadResult {
  url?: string;
  mediaKey?: Buffer;
  fileEncSha256?: Buffer;
  fileSha256?: Buffer;
  fileLength?: number;
}

export interface MediaDownloadOptions {
  maxSizeBytes?: number;
  saveTo?: string;
}

/** Size limits by media type (in bytes) */
export const MEDIA_SIZE_LIMITS: Record<MediaType, number> = {
  image: 16 * 1024 * 1024,    // 16 MB
  video: 64 * 1024 * 1024,    // 64 MB
  audio: 16 * 1024 * 1024,    // 16 MB
  voice: 16 * 1024 * 1024,    // 16 MB
  document: 100 * 1024 * 1024, // 100 MB
  sticker: 500 * 1024,         // 500 KB
};
