export interface Appunto {
  slug: string;
  title: string;
  excerpt: string;
  date: string;        // ISO format: "2026-01-15"
  tag: string;         // e.g. "Processi" | "Software" | "Adozione" | "UX" | "QA" | "Microcopy"
  published: boolean;  // only true renders the card publicly
}

export const appunti: Appunto[] = [
  // TODO: add published article cards here only after the full article copy is ready.
  // Example entry (keep published: false until article is complete):
  // {
  //   slug: "come-si-sceglie-un-gestionale",
  //   title: "Come si sceglie un gestionale senza farsi convincere dalla demo",
  //   excerpt: "La demo convince sempre. Il problema è quello che succede sei mesi dopo.",
  //   date: "2026-07-01",
  //   tag: "Software",
  //   published: false,
  // },
];

export const publishedAppunti = appunti.filter((a) => a.published);
