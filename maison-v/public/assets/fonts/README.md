# Fonts

Drop the self-hosted web font files here.

## Black Mango (display / wordmark)

Black Mango is a **commercial** font from Creative Market
(https://creativemarket.com/creativemedialab/5484322-Black-Mango-Modern-beauty-font)
and is **not** redistributed in this repo for licensing reasons.

Once you have a web license, export `.woff2` files and place them here with
these exact names so `src/styles/fonts.css` picks them up automatically:

- `BlackMango-Light.woff2`   → maps to font-weight 300 (the wordmark weight)
- `BlackMango-Regular.woff2` → maps to font-weight 400 (optional)

Until then the site falls back to **Cormorant Garamond** (a free, high-contrast
serif loaded from Google Fonts), which keeps the wordmark on-brand.

## Montserrat

Montserrat is loaded from Google Fonts in `fonts.css`, so no local file is
needed. If you prefer to self-host it for performance, add the `.woff2` files
here and add matching `@font-face` rules.
