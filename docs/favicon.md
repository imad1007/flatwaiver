# FlatWaiver favicon

The approved source is `public/flatwaiver-logo.png` (512×512, transparent PNG).
Do not replace it with a recreated mark. To regenerate its resized assets:

```sh
node scripts/generate-favicons.mjs
node scripts/verify-favicons.mjs
npm run build
node scripts/verify-favicons.mjs --serve
```

Next.js file-based metadata advertises `src/app/favicon.ico`, `src/app/icon.png`,
`src/app/apple-icon.png`, and `src/app/manifest.ts` automatically. No manual
icon links are needed in the root layout. The manifest uses 192px and 512px
images and keeps browser navigation behavior; these icons are not maskable.

## Production diagnosis, November 9, 2026

The live apex homepage redirected to `https://www.flatwaiver.com/` with a final
200 response. Its HTML advertised both `/favicon.ico?...` and `/icon.svg?...`.
The ICO contained the Vercel triangle; the SVG contained the older flat shield.
The live ICO matched the repository's original ICO exactly (SHA-256
`2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932`).
Both icon URLs returned 200 with image content types and no X-Robots-Tag.
Production robots.txt allowed `/`. The problem was a shipped starter favicon,
not only Google caching. The standalone `public/vercel.svg` and `public/next.svg`
assets were not advertised as icons and are left untouched.

## After an approved deployment

Verify the www homepage's icon and manifest links and open each icon URL without
authentication. Confirm the ICO and PNG show the approved gradient shield.
Use Google Search Console URL Inspection on `https://www.flatwaiver.com/`,
test the live URL, and request indexing. Keep the favicon URLs stable.
Google's refresh can take days to weeks, and a favicon appearance is not guaranteed:
https://developers.google.com/search/docs/appearance/favicon-in-search/
Do not report a changed Google result until it has been independently observed.
