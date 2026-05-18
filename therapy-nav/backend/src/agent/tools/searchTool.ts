import { chromium } from "playwright";
import { IntakePreferences, NormalizedProfile } from "../../types/index.js";
import { v4 as uuidv4 } from "uuid";
import { emitEvent } from "../../sessionStore.js";

const MAX_RESULTS = parseInt(process.env.MAX_SEARCH_RESULTS ?? "20", 10);
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";

interface RawListing {
  name: string;
  url: string;
  source: string;
  snippet: string;
}

function buildPsychologyTodayUrl(prefs: IntakePreferences): string {
  const base = "https://www.psychologytoday.com/us/therapists";
  const parts: string[] = [];

  if (prefs.location !== "telehealth") {
    const loc = prefs.location as { zip?: string; city?: string; state?: string };
    if (loc.zip) parts.push(loc.zip);
    else if (loc.city && loc.state) parts.push(`${loc.city}-${loc.state}`.toLowerCase().replace(/\s+/g, "-"));
  }

  const query = new URLSearchParams();
  if (prefs.specialty.length > 0) query.set("category", prefs.specialty[0]);
  if (prefs.insurance && prefs.insurance !== "self-pay") query.set("insurance", prefs.insurance);
  if (prefs.location === "telehealth") query.set("telehealth", "1");

  const path = parts.length > 0 ? `/${parts.join("/")}` : "";
  const qs = query.toString() ? `?${query.toString()}` : "";
  return `${base}${path}${qs}`;
}

async function scrapeListingPage(
  url: string,
  source: string,
  sessionId: string
): Promise<RawListing[]> {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const listings: RawListing[] = [];

  try {
    emitEvent(sessionId, { type: "search_progress", source, found: 0 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    if (source === "psychology_today") {
      const cards = await page.$$eval(
        '[data-testid="result-card"], .results-row .profile-card, .profile-results-card',
        (els) =>
          els.slice(0, 20).map((el) => ({
            name: (el.querySelector("h2, h3, .profile-title") as HTMLElement)?.innerText?.trim() ?? "",
            url: (el.querySelector("a[href*='/therapists/']") as HTMLAnchorElement)?.href ?? "",
            snippet: (el as HTMLElement).innerText?.slice(0, 300) ?? "",
          }))
      );
      for (const c of cards) {
        if (c.name && c.url) listings.push({ ...c, source });
      }
    } else if (source === "zocdoc") {
      const cards = await page.$$eval(
        '[data-test="result-card"], .SearchResult',
        (els) =>
          els.slice(0, 20).map((el) => ({
            name: (el.querySelector("[data-test='provider-name'], h2") as HTMLElement)?.innerText?.trim() ?? "",
            url: (el.querySelector("a") as HTMLAnchorElement)?.href ?? "",
            snippet: (el as HTMLElement).innerText?.slice(0, 300) ?? "",
          }))
      );
      for (const c of cards) {
        if (c.name && c.url) listings.push({ ...c, source });
      }
    }

    emitEvent(sessionId, { type: "search_progress", source, found: listings.length });
  } catch (err) {
    console.error(`Search error for ${source}:`, err);
    emitEvent(sessionId, { type: "search_progress", source, found: 0 });
  } finally {
    await browser.close();
  }

  return listings;
}

export async function searchDirectories(
  prefs: IntakePreferences,
  sessionId: string
): Promise<NormalizedProfile[]> {
  const ptUrl = buildPsychologyTodayUrl(prefs);

  // Run searches with concurrency limit
  const sources = [
    { url: ptUrl, source: "psychology_today" },
  ];

  const allListings: RawListing[] = [];
  for (const { url, source } of sources) {
    const results = await scrapeListingPage(url, source, sessionId);
    allListings.push(...results);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Convert raw listings to normalized profiles (basic extraction from snippet)
  const profiles: NormalizedProfile[] = allListings
    .slice(0, MAX_RESULTS)
    .map((listing, i) => {
      emitEvent(sessionId, {
        type: "extraction_progress",
        total: Math.min(allListings.length, MAX_RESULTS),
        done: i + 1,
      });
      return extractFromSnippet(listing);
    });

  return profiles;
}

function extractFromSnippet(listing: RawListing): NormalizedProfile {
  const text = listing.snippet;

  // Heuristic extraction from snippet text
  const specialties: string[] = [];
  const specialtyKeywords = [
    "anxiety", "depression", "trauma", "ptsd", "couples", "family",
    "grief", "addiction", "ocd", "bipolar", "adhd", "stress", "anger",
    "eating disorder", "lgbtq", "relationship", "career", "life transitions",
  ];
  for (const kw of specialtyKeywords) {
    if (text.toLowerCase().includes(kw)) specialties.push(kw);
  }

  const telehealth =
    text.toLowerCase().includes("telehealth") ||
    text.toLowerCase().includes("online therapy") ||
    text.toLowerCase().includes("video");

  const acceptingNewPatients = !text.toLowerCase().includes("not accepting new");

  const credentialsMatch = text.match(/\b(LCSW|LMFT|PhD|PsyD|LPC|LMHC|MD|MSW|MFT|NP)\b/);
  const credentials = credentialsMatch ? credentialsMatch[1] : "";

  const insuranceMatch = text.match(/insurance[:\s]+([^\n.]+)/i);
  const insuranceAccepted = insuranceMatch
    ? insuranceMatch[1]
        .split(/,|and/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const rateMatch = text.match(/\$(\d+)/);
  const selfPayRate = rateMatch ? `$${rateMatch[1]}` : undefined;

  const locationMatch = text.match(/([A-Z][a-z]+,\s*[A-Z]{2})/);
  const location = locationMatch ? locationMatch[1] : "Unknown";

  return {
    id: uuidv4(),
    source: listing.source,
    name: listing.name,
    credentials,
    specialties: specialties.slice(0, 5),
    insuranceAccepted,
    selfPayRate,
    location,
    telehealth,
    acceptingNewPatients,
    nextAvailableSlot: undefined,
    bookingUrl: listing.url,
    profileUrl: listing.url,
    rawExcerpt: text,
  };
}
