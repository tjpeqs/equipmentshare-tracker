// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RepRoute AI Bid Feed Scanner
// Supabase Edge Function — deploy to: supabase/functions/bid-feed/index.ts
//
// SETUP:
// 1. Install Supabase CLI: npm install -g supabase
// 2. supabase login
// 3. supabase functions deploy bid-feed
// 4. Add secrets:
//    supabase secrets set ANTHROPIC_API_KEY=your_key_here
//    supabase secrets set SUPABASE_SERVICE_KEY=your_service_role_key
// 5. Schedule daily at 6am in Supabase Dashboard → Edge Functions → Schedule
//    Cron: 0 6 * * *
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_KEY") || "";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";

// ── Feed sources ─────────────────────────────────────────────
const FEEDS = [
  // CT DOT Bid Opportunities RSS
  {
    name: "CT DOT Bids",
    url: "https://www.ct.gov/dot/cwp/view.asp?a=3532&q=415508",
    type: "html",
    state: "CT",
  },
  // MA Commbuys state procurement
  {
    name: "MA Commbuys",
    url: "https://www.commbuys.com/bso/external/publicBids.sdo",
    type: "html",
    state: "MA",
  },
  // CT eSEARCH RSS (if available)
  {
    name: "eSEARCH CT Projects",
    url: "https://www.ctconstructionnews.com/feed/",
    type: "rss",
    state: "CT",
  },
  // Berkshire Eagle construction news
  {
    name: "Berkshire Eagle",
    url: "https://www.berkshireeagle.com/search/?q=construction+bid&f=rss",
    type: "rss",
    state: "MA",
  },
  // Republican-American (Waterbury CT)
  {
    name: "Republican-American",
    url: "https://www.rep-am.com/search/?q=construction&f=rss",
    type: "rss",
    state: "CT",
  },
  // CT Construction News
  {
    name: "CT Construction News",
    url: "https://www.ctconstructionnews.com/feed/",
    type: "rss",
    state: "CT",
  },
];

// ── Target counties/towns ────────────────────────────────────
const TARGET_AREAS = [
  // Litchfield County CT
  "Torrington", "Winsted", "New Milford", "Litchfield", "Waterbury",
  "Watertown", "Thomaston", "Bantam", "Salisbury", "Canaan", "Norfolk",
  "Cornwall", "Sharon", "Kent", "Harwinton", "Burlington",
  // Berkshire County MA
  "Pittsfield", "Great Barrington", "Lenox", "Lee", "North Adams",
  "Adams", "Dalton", "Sheffield", "Williamstown", "Stockbridge",
  // Hampden County MA
  "Springfield", "Chicopee", "Holyoke", "Westfield", "Agawam",
  "West Springfield", "Longmeadow", "Ludlow", "Palmer", "Southwick",
  // Hartford County CT
  "Hartford", "New Britain", "Bristol", "Southington", "Farmington",
  "Canton", "Simsbury", "Avon", "Plainville", "Wolcott",
];

// ── Fetch a feed ──────────────────────────────────────────────
async function fetchFeed(feed: typeof FEEDS[0]): Promise<string> {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "RepRoute/1.0 (field-sales-intelligence)",
        "Accept": "application/rss+xml, application/xml, text/html, */*",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    const text = await response.text();
    // Truncate to ~8000 chars to fit in Claude context
    return text.slice(0, 8000);
  } catch(e) {
    console.error(`Feed fetch failed (${feed.name}):`, e.message);
    return "";
  }
}

// ── Parse with Claude ─────────────────────────────────────────
async function parseWithClaude(feedName: string, content: string, state: string): Promise<any[]> {
  if (!content.trim()) return [];

  const prompt = `You are a construction bid data extractor for a field sales intelligence app covering western Connecticut and western Massachusetts.

Extract construction project bids, awards, and opportunities from this content from "${feedName}".

ONLY extract projects in these target areas: ${TARGET_AREAS.join(", ")}.

For each project found, return a JSON array. Each item must have:
- project: string (project name/description)
- owner: string (project owner/municipality, or "")  
- gc: string (general contractor if known, or "TBD")
- value: number (dollar value, 0 if unknown)
- type: one of "Commercial" | "Municipal" | "Residential" | "Industrial"
- county: string (county name)
- state: "${state}"
- town: string (town/city)
- bid_date: string (YYYY-MM-DD format, or null)
- status: "Not Contacted"
- priority: "High" | "Medium" | "Low" (High if >$1M or infrastructure, Low if <$100K)
- notes: string (brief description, stage, relevant details)
- source: "AI Feed"
- confidence: number 0-100 (how confident you are in the extracted data)

Return ONLY valid JSON array, no markdown, no explanation. If no relevant projects found, return [].

Content:
${content}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", await response.text());
      return [];
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    // Clean and parse
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) {
    console.error("Parse error:", e.message);
    return [];
  }
}

// ── Deduplicate against existing projects ─────────────────────
async function deduplicateProjects(projects: any[]): Promise<any[]> {
  if (!projects.length) return [];

  // Get recent project names from Supabase
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/bid_feed_queue?select=project_name&order=created_at.desc&limit=500`,
    {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
    }
  );

  const existing = response.ok ? await response.json() : [];
  const existingNames = new Set(
    (Array.isArray(existing) ? existing : []).map((e: any) =>
      (e.project_name || "").toLowerCase().slice(0, 40)
    )
  );

  return projects.filter(p => {
    const key = (p.project || "").toLowerCase().slice(0, 40);
    return !existingNames.has(key);
  });
}

// ── Save to bid_feed_queue table ──────────────────────────────
async function saveToBidQueue(projects: any[], feedName: string): Promise<number> {
  if (!projects.length) return 0;

  const rows = projects
    .filter(p => p.confidence >= 50) // only save confident extractions
    .map(p => ({
      project_name:  p.project,
      owner:         p.owner || "",
      gc:            p.gc || "TBD",
      value:         Number(p.value) || 0,
      type:          p.type || "Commercial",
      county:        p.county || "",
      state:         p.state || "CT",
      town:          p.town || "",
      bid_date:      p.bid_date || null,
      status:        "Not Contacted",
      priority:      p.priority || "Medium",
      notes:         p.notes || "",
      source:        feedName,
      confidence:    p.confidence || 0,
      review_status: "pending", // pending | approved | dismissed
      created_at:    new Date().toISOString(),
    }));

  if (!rows.length) return 0;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/bid_feed_queue`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    console.error("Save error:", await response.text());
    return 0;
  }

  return rows.length;
}

// ── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  // Allow manual trigger via POST or scheduled cron
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  }

  console.log("🔍 RepRoute AI Bid Feed Scanner starting...");
  const results: Record<string, number> = {};
  let totalNew = 0;

  for (const feed of FEEDS) {
    console.log(`Fetching: ${feed.name}`);
    const content = await fetchFeed(feed);
    if (!content) { results[feed.name] = 0; continue; }

    console.log(`Parsing with Claude: ${feed.name}`);
    const projects = await parseWithClaude(feed.name, content, feed.state);
    console.log(`  Found ${projects.length} projects`);

    const newProjects = await deduplicateProjects(projects);
    console.log(`  New after dedup: ${newProjects.length}`);

    const saved = await saveToBidQueue(newProjects, feed.name);
    results[feed.name] = saved;
    totalNew += saved;

    // Small delay between feeds to be respectful
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ Done. Total new projects: ${totalNew}`);

  return new Response(
    JSON.stringify({
      success: true,
      totalNew,
      results,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
