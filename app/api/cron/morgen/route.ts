import { morgenRunde } from "@/lib/benachrichtigen-server";

// Wird von Vercel per Zeitplan aufgerufen (siehe vercel.json) – nur mit dem geheimen CRON_SECRET.
export async function GET(req: Request) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim || req.headers.get("authorization") !== `Bearer ${geheim}`) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const bericht = await morgenRunde();
  console.log("Morgen-Runde", JSON.stringify(bericht));
  return Response.json(bericht);
}
