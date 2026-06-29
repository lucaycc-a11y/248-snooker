// Render JSON-LD structured data safely as escaped <script> children.
//
// React escapes text children, but inside <script> the browser does not decode
// HTML entities — so a raw `&`/`<`/`>` in dynamic JSON (e.g. a post title) would
// either break the JSON or allow a `</script>` breakout. We escape those three
// characters to their \uXXXX JSON forms, which crawlers parse back correctly and
// which contain no HTML-significant characters. Use as:
//   <script type="application/ld+json">{safeJsonLd(data)}</script>
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
