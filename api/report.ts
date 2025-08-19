// /api/report.ts
export const config = { runtime: "edge" }; // keep Edge so Request/Response works

function htmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (m) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' } as any
  )[m]!);
}

export default async function handler(req: Request) {
  // --- CORS ---
  const allowedOriginEnv = (process.env.ALLOWED_ORIGIN || "").trim();
  const allowNull = (process.env.ALLOW_NULL_ORIGIN || "").toLowerCase() === "true";

  const origin = req.headers.get("origin") || "null";

  // If ALLOWED_ORIGIN is not set -> allow all origins (easier for testing)
  const noLock = !allowedOriginEnv;

  const isAllowed =
    noLock ||
    origin === allowedOriginEnv ||
    (origin === "null" && allowNull);

  const corsHeaders = {
    "Access-Control-Allow-Origin": noLock ? (origin === "null" ? "*" : origin) : (isAllowed ? origin : "https://example.com"),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (!isAllowed) {
    return new Response("Forbidden (origin)", { status: 403, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Only POST", { status: 405, headers: corsHeaders });
  }

  // --- Parse body ---
  let body: any = null;
  try { body = await req.json(); } catch {}
  if (!body || typeof body.score !== "number" || typeof body.maxScore !== "number") {
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
  const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID || "";
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response("Server not configured", { status: 500, headers: corsHeaders });
  }

  const {
    testId, studentName, score, maxScore,
    startedAt, finishedAt, durationSec, detailsUrl
  } = body;

  const msg =
    `🧪 <b>${htmlEscape(testId || "IELTS Listening")}</b>\n` +
    `👤 ${htmlEscape(studentName || "Unknown")}\n` +
    `✅ Score: <b>${score}</b> / ${maxScore}\n` +
    (typeof durationSec === "number" ? `⏱️ Time: ${durationSec}s\n` : "") +
    (startedAt ? `🟢 Start: ${htmlEscape(startedAt)}\n" : "") +
    (finishedAt ? `🔵 End: ${htmlEscape(finishedAt)}\n" : "") +
    (detailsUrl ? `🔗 ${htmlEscape(detailsUrl)}` : "");

  // --- Send to Telegram ---
  let tgResp: any = null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: "HTML"
      })
    });
    tgResp = await res.json();
  } catch (e: any) {
    return new Response(JSON.stringify({ ok:false, error: String(e) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!tgResp || !tgResp.ok) {
    // expose Telegram's error so you can see exactly what's wrong in Network tab
    return new Response(JSON.stringify({ ok:false, tg: tgResp }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
