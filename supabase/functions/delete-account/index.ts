import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") || "http://127.0.0.1:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(401, { error: "Unauthorized" });
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return reply(401, { error: "Unauthorized" });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  // Never accept a user ID from request input. Only the verified caller is deleted.
  try {
    while (true) {
      const { data, error } = await admin.storage
        .from("health-files")
        .list(user.id, { limit: 100 });
      if (error) throw error;
      if (!data.length) break;
      const removed = await admin.storage
        .from("health-files")
        .remove(data.map((f) => `${user.id}/${f.name}`));
      if (removed.error) throw removed.error;
    }
    // Remove payload references first so the orphan protection trigger allows deletion.
    const { data: records, error: readError } = await admin
      .from("records")
      .select("id,data")
      .eq("user_id", user.id);
    if (readError) throw readError;
    // Delete attachments/reminders/medicines, then leaves newest-first (extensions), visits and doctors.
    for (const kind of [
      "attachment",
      "reminder",
      "medicine",
      "leave",
      "visit",
      "doctor",
    ]) {
      const pending = await admin
        .from("records")
        .select("id,data")
        .eq("user_id", user.id)
        .eq("kind", kind);
      if (pending.error) throw pending.error;
      let remaining = pending.data;
      while (remaining.length) {
        const leaves = remaining.filter(
          (r) => !remaining.some((other) => other.data.extends === r.id),
        );
        if (!leaves.length) throw new Error("Circular references");
        for (const record of leaves) {
          const deleted = await admin
            .from("records")
            .delete()
            .eq("id", record.id)
            .eq("user_id", user.id);
          if (deleted.error) throw deleted.error;
        }
        remaining = remaining.filter((r) => !leaves.some((x) => x.id === r.id));
      }
    }
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
    return reply(200, { deleted: true });
  } catch {
    return reply(500, {
      error: "Deletion did not finish. Retry to complete it.",
    });
  }
});
