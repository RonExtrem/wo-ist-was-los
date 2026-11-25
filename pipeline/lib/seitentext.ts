// Macht aus einer Webseite lesbaren Text für die KI – Links bleiben als „Text <URL>“ erhalten.
import * as cheerio from "cheerio";

export function seitenText(html: string, basisUrl: string, maxZeichen = 40_000): string {
  const $ = cheerio.load(html);
  // Titel und Seitenbeschreibung voranstellen – manche Seiten (im Umbau, viel JavaScript) haben die Termine nur dort
  const meta = [
    $("title").first().text(),
    $('meta[name="description"]').attr("content") ?? "",
    $('meta[property="og:description"]').attr("content") ?? "",
  ]
    .map((t) => cheerio.load(`<div>${t}</div>`)("div").text().replace(/\s+/g, " ").trim())
    .filter((t, i, arr) => t && arr.indexOf(t) === i)
    .join("\n");
  $("script, style, noscript, svg, iframe, form, [aria-hidden='true']").remove();
  $("nav, footer, header .menu, .cookie, #cookie, .cookie-banner").remove();

  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const abs = new URL(href, basisUrl).href;
      const text = $(a).text().replace(/\s+/g, " ").trim();
      if (text) $(a).replaceWith(` ${text} <${abs}> `);
    } catch {
      /* ungültiger Link */
    }
  });
  $("br, p, div, li, h1, h2, h3, h4, h5, h6, tr, article, section").each((_, el) => {
    $(el).append("\n");
  });

  const text = (meta ? `[Seiteninfo] ${meta}\n` : "") + $("body").text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.length > maxZeichen ? text.slice(0, maxZeichen) + "\n[… gekürzt]" : text;
}
