import { getStore } from "@netlify/blobs";

// Stores the training plan as JSON in Netlify Blobs.
// GET  /api/plan          -> current plan (public, read-only)
// GET  /api/plan?check=1  -> 204 if x-edit-password is correct, 401 otherwise
// PUT  /api/plan          -> save plan (requires x-edit-password = EDIT_PASSWORD)
export default async (req) => {
  const store = getStore("trainingsplan");
  const secret = (globalThis.Netlify?.env?.get("EDIT_PASSWORD")) ?? process.env.EDIT_PASSWORD ?? "";
  const given = req.headers.get("x-edit-password") ?? "";
  const authed = secret !== "" && given === secret;
  const noStore = { "cache-control": "no-store" };

  if (req.method === "GET") {
    if (new URL(req.url).searchParams.has("check")) {
      return new Response(null, { status: secret === "" ? 503 : authed ? 204 : 401, headers: noStore });
    }
    const plan = await store.get("plan", { type: "json", consistency: "strong" });
    return Response.json(plan ?? null, { headers: noStore });
  }

  if (req.method === "PUT") {
    if (secret === "") return new Response("EDIT_PASSWORD is not set", { status: 503 });
    if (!authed) return new Response("Unauthorized", { status: 401 });
    const text = await req.text();
    if (text.length > 1_000_000) return new Response("Too large", { status: 413 });
    let plan;
    try { plan = JSON.parse(text); } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (!plan || !Array.isArray(plan.days)) return new Response("Invalid plan", { status: 400 });
    await store.setJSON("plan", plan);
    return new Response(null, { status: 204, headers: noStore });
  }

  return new Response("Method not allowed", { status: 405, headers: { allow: "GET, PUT" } });
};

export const config = { path: "/api/plan" };
