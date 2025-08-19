// /api/report.ts
// Node runtime is fine (default). Remove config if you want Node instead of Edge.
// export const config = { runtime: "edge" };

function htmlEscape(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
}

export default async function handler(req: Request) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";
  const origin = req.headers.get("origin") || "null";
  const isAllowed =
    origin === allowedOrigin ||
    (origin === "null" && process.env.ALLOW_NULL_ORIGIN === "true");

  const cors = {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://example.com",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (!isAllowed) {
    return new Response("Forbidden (origin)", { status: 403, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response("Only POST", { status: 405, headers: cors });
  }

  let body: any = null;
  try { body = await req.json(); } catch {}
  if (!body || typeof body.score !== "number" || typeof body.maxScore !== "number") {
    return new Response("Bad request", { status: 400, headers: cors });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response("Server not configured", { status: 500, headers: cors });
  }

  const { testId, studentName, score, maxScore, startedAt, finishedAt, durationSec, detailsUrl } = body;

  const msg =
    `🧪 <b>${htmlEscape(testId || "IELTS Listening")}</b>\n` +
    `👤 ${htmlEscape(studentName || "Unknown")}\n` +
    `✅ Score: <b>${score}</b> / ${maxScore}\n` +
    (typeof durationSec === "number" ? `⏱️ Time: ${durationSec}s\n` : "") +
    (startedAt ? `🟢 Start: ${htmlEscape(startedAt)}\n` : "") +
    (finishedAt ? `🔵 End: ${htmlEscape(finishedAt)}\n` : "") +
    (detailsUrl ? `🔗 ${htmlEscape(detailsUrl)}` : "");

  const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" })
  }).then(r => r.json()).catch(() => null);

  if (!tgResp || !tgResp.ok) {
    return new Response("Telegram failed", { status: 502, headers: cors });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
