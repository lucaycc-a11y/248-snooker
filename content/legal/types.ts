// Shared shape for a single legal document, one file per (document, locale)
// pair under content/legal/. Content is a plain exported constant — no
// runtime fetch, no CMS layer. See content/legal/index.ts for the registry
// that ties these together per locale.

export type LegalSection = {
  title: string
  body: string
}

export type LegalDocument = {
  title: string
  // `subtitle` — used by the venue-rules doc, which has a single
  // 【重要提示】-prefixed intro paragraph before its numbered sections.
  subtitle?: string
  // `intro` — used by website-terms / privacy, which have an unprefixed
  // intro paragraph before their numbered sections.
  intro?: string
  sections: LegalSection[]
}
