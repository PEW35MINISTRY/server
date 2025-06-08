# Asset Directory Guidlines

This directory contains static assets included in **Git version control**.  
Suggested to minify before adding: https://tinypng.com/

REQUIRED: `ASSET_URL` in `.env` directs to relevant source

### AWS `DEVELOPMENT`/`PRODUCTION` serves files from CDN (S3 Bucket)

**→ ALL ASSETS MUST BE UPLOADED TO AWS S3 BUCKET**

### `LOCAL` Environment
Assets are served directly from: `1-src/0-assets/public`
** Note: Non-typescript files are not compiled nor copied to `/0-compiled`

# HTML File Usage
- `1-src/0-assets/static-pages/` holds raw `.html` files used for static pages
- These `.html` files are automatically registered and served at `/{filename}` (EX: `not-found.html` -> `/not-found`)
- During `npm run build:html`, a script (`1-src/5-scripts/static-pages.mts`) 
    - Copies these files to: `/0-compiled/0-assets/static-pages/`
    - Replaces all instances of `{{ASSET_URL}}` with from the defined environment variable `ASSET_URL`.

#### Link to `/CSS`:
** Base component styling & header are inherited from: `styles-core.css` **
```
<link rel="stylesheet" href="${ASSET_URL}/assets/css/styles-core.css">
```

#### Link to `/images`:
```
<img src="${ASSET_URL}/assets/images/logo.png" alt="Site Logo">
```
