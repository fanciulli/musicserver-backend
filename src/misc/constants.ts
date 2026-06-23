/*
 * Created on Thu Mar 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export enum HttpMethods {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export enum HttpHeaders {
  CONTENT_TYPE = "content-type",
}

export enum MimeTypes {
  APPLICATION_OCTET_STREAM = "application/octet-stream",
  IMAGE_SVG_XML = "image/svg+xml",
  IMAGE_PNG = "image/png",
  IMAGE_JPEG = "image/jpeg",
  IMAGE_WEBP = "image/webp",
  IMAGE_GIF = "image/gif",
  TEXT_PLAIN = "text/plain",
}

export enum Format {
  UNKNOWN = "UNKNOWN",
  MP3 = "MP3",
  FLAC = "FLAC",
  WAV = "WAV",
  AAC = "AAC",
}

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
