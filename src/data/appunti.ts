export interface Appunto {
  slug: string;
  title: string;
  excerpt: string;
  date: string;        // ISO format: "2026-01-15"
  tag: string;         // e.g. "Processi" | "Software" | "Adozione" | "UX" | "QA" | "Microcopy"
  published: boolean;  // only true renders the card publicly
}

export const appunti: Appunto[] = [
  {
    slug: "appunti-demo-gestionale-martedi-mattina",
    title: "La demo ti vende il software. Il martedì mattina ti dice se regge.",
    excerpt: "Prima di scegliere un gestionale, guarda il lavoro che dovrà sopportare: processi reali, eccezioni, adozione e lavoro nascosto.",
    date: "2026-06-21",
    tag: "Software Fit Sprint",
    published: true,
  },
  {
    slug: "appunti-software-su-misura-rincorrere",
    title: "Il software su misura non serve a fare tutto",
    excerpt: "Quando ha senso progettare uno strumento custom e quando invece stai solo trasformando il caos in codice.",
    date: "2026-06-23",
    tag: "Software su misura",
    published: true,
  },
  // TODO: add published article cards here only after the full article copy is ready.
];

export const publishedAppunti = appunti.filter((a) => a.published);
