/*
 * Created on Tue Apr 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
const DEFAULT_ALBUM_ART_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Default album art">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#131722"/>
      <stop offset="100%" stop-color="#2a3249"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" fill="url(#g)"/>
  <circle cx="160" cy="160" r="86" fill="#eef2ff" fill-opacity="0.2"/>
  <circle cx="160" cy="160" r="56" fill="#eef2ff" fill-opacity="0.65"/>
  <circle cx="160" cy="160" r="10" fill="#131722"/>
</svg>`;

export const DEFAULT_ALBUM_ART = Buffer.from(DEFAULT_ALBUM_ART_SVG, "utf8");
