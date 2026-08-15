import { assertSafePublicUrlAsync } from "./safe-url";

const MAX_RESPONSE_BYTES = 1_500_000;
const REQUEST_TIMEOUT_MS = 12_000;

export type ResearchObservation = {
  url: string;
  direct: { ok: boolean; title?: string; text?: string; status?: number; error?: string };
  browser: { ok: boolean; title?: string; text?: string; error?: string };
  reconciledText: string;
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
}

async function fetchDirect(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "user-agent": "GenForge/0.1 public-research" },
    });
    const location = response.headers.get("location");
    if (location) {
      await assertSafePublicUrlAsync(new URL(location, url).toString());
      return { ok: false, status: response.status, error: "Redirect was not followed; submit the final public URL instead." };
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) throw new Error("Response exceeds the configured size limit.");
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, status: response.status, error: "Empty response body." };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("Response exceeds the configured size limit.");
        }
        chunks.push(value);
      }
    }
    const html = Buffer.concat(chunks).toString("utf8");
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    return { ok: response.ok, status: response.status, title, text: stripHtml(html), error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Direct fetch failed." };
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectBrowser(url: URL) {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route("**/*", async (route) => {
        try {
          await assertSafePublicUrlAsync(route.request().url());
          await route.continue();
        } catch {
          await route.abort("blockedbyclient");
        }
      });
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: REQUEST_TIMEOUT_MS });
      await assertSafePublicUrlAsync(page.url());
      const content = await page.locator("body").innerText({ timeout: REQUEST_TIMEOUT_MS });
      return { ok: true, title: await page.title(), text: content.replace(/\s+/g, " ").trim().slice(0, 20_000) };
    } finally {
      await context.close();
      await browser.close();
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Browser inspection unavailable." };
  }
}

export async function researchPublicUrl(rawUrl: string): Promise<ResearchObservation> {
  const url = await assertSafePublicUrlAsync(rawUrl);
  const [directResult, browserResult] = await Promise.all([fetchDirect(url), inspectBrowser(url)]);
  const pieces = [directResult.text, browserResult.text].filter(Boolean).map((piece) => piece!.trim());
  const reconciledText = Array.from(new Set(pieces)).join("\n\n").slice(0, 30_000);
  return {
    url: url.toString(),
    direct: directResult,
    browser: browserResult,
    reconciledText,
  };
}
