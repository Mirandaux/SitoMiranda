# Maison V — Hair Atelier & Beauty

Website for **Maison V di Valentina Righetti**, built on the official
Corporate Design Manual (Magenta Graphics, 13/03/2026).

Standalone [Astro](https://astro.build) project — self-contained and ready to
be lifted into its own repository (see _Promote to its own repo_ below).

## Brand system (from the manual)

| Token | Value |
| :---- | :---- |
| Brand color | **#99856F** · CMYK 32/40/52/22 · RGB 153/133/111 |
| Display / wordmark font | **Black Mango** (Creative Market, commercial) |
| Secondary / tagline font | **Montserrat** (Google Fonts) |
| Display fallback | **Cormorant Garamond** (free, high-contrast serif) |

The single source of truth lives in [`src/styles/tokens.css`](src/styles/tokens.css)
(colors, type, spacing, components) and [`src/styles/fonts.css`](src/styles/fonts.css)
(font loading). Change the brand there and every surface follows.

### Black Mango font

Black Mango is a paid font and is **not** bundled. The site renders with the
Cormorant Garamond fallback until you add the real files — see
[`public/assets/fonts/README.md`](public/assets/fonts/README.md). Drop
`BlackMango-Light.woff2` into `public/assets/fonts/` and nothing else changes.

## Develop

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to ./dist
npm run preview
```

Requires Node `>=22.12.0`.

## Promote to its own repo

This project lives in a subfolder of `SitoMiranda` only because the brand
work was synced there. To give it its own home:

```sh
# from the maison-v/ folder
git init
git add .
git commit -m "Initial commit: Maison V site from brand manual"
git remote add origin <your-new-repo-url>
git push -u origin main
```

## Structure

```text
maison-v/
├── public/
│   ├── favicon.svg
│   └── assets/fonts/        # drop Black Mango .woff2 here
└── src/
    ├── styles/
    │   ├── tokens.css        # ◆ design system — single source of truth
    │   └── fonts.css         # font loading (@font-face + Google Fonts)
    ├── layouts/Layout.astro
    ├── components/{Header,Footer}.astro
    └── pages/index.astro     # starter landing page
```

The page copy is starter placeholder content in Italian — replace it with the
atelier's real text, services, hours and contacts.
