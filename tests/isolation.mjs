// Run only against your configured disposable test project, after migration.
// Uses two EXISTING confirmed test users; never needs a service-role key.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const env = process.env;
const required = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_ANON_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];
if (required.some((k) => !env[k])) {
  console.error(
    "Missing test environment. See README: integration verification.",
  );
  process.exit(1);
}
const make = () =>
  createClient(env.TEST_SUPABASE_URL, env.TEST_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
const a = make(),
  b = make();
const loginA = await a.auth.signInWithPassword({
  email: env.TEST_USER_A_EMAIL,
  password: env.TEST_USER_A_PASSWORD,
});
const loginB = await b.auth.signInWithPassword({
  email: env.TEST_USER_B_EMAIL,
  password: env.TEST_USER_B_PASSWORD,
});
assert.ifError(loginA.error);
assert.ifError(loginB.error);
const owner = loginA.data.user.id,
  other = loginB.data.user.id;
assert.notEqual(owner, other);
const id = crypto.randomUUID(),
  leave = crypto.randomUUID(),
  med = crypto.randomUUID(),
  att = crypto.randomUUID(),
  path = `${owner}/${crypto.randomUUID()}.pdf`;
const made = [];
try {
  assert.ifError(
    (
      await a
        .from("records")
        .insert({
          id,
          user_id: owner,
          kind: "visit",
          data: {
            title: "Isolation test",
            date: "2026-11-17",
            diagnosis: "Exact Test",
          },
        })
    ).error,
  );
  made.push(id);
  assert.equal(
    (await a.from("records").select("*").eq("id", id)).data.length,
    1,
  );
  assert.deepEqual((await b.from("records").select("*").eq("id", id)).data, []);
  assert.deepEqual(
    (
      await b
        .from("records")
        .update({ data: { title: "Hijacked" } })
        .eq("id", id)
        .select()
    ).data,
    [],
  );
  assert.ok(
    (
      await b
        .from("records")
        .insert({
          user_id: owner,
          kind: "visit",
          data: { title: "Spoof", date: "2026-11-17" },
        })
    ).error,
  );
  assert.ok(
    (
      await b
        .from("records")
        .insert({
          user_id: other,
          kind: "medicine",
          data: { title: "Cross link", visit: id, status: "Active" },
        })
    ).error,
  );
  assert.ifError(
    (
      await a
        .from("records")
        .insert({
          id: med,
          user_id: owner,
          kind: "medicine",
          data: {
            title: "Example medicine",
            visit: id,
            status: "Active",
            strength: "5 mg",
            dose: "One tablet",
            frequency: "As needed",
          },
        })
    ).error,
  );
  made.push(med);
  const data = {
    title: "Test leave",
    visit: id,
    start: "2026-11-17",
    end: "2026-11-19",
    percentage: "50",
    status: "Not sent",
  };
  assert.ifError(
    (
      await a
        .from("records")
        .insert({ id: leave, user_id: owner, kind: "leave", data })
    ).error,
  );
  made.push(leave);
  assert.ifError(
    (
      await a
        .from("records")
        .update({ data: { ...data, status: "Sent", sent: "2026-11-17" } })
        .eq("id", leave)
    ).error,
  );
  assert.equal(
    (await a.from("hr_submissions").select("*").eq("record_id", leave)).data
      .length,
    2,
  );
  assert.deepEqual(
    (await b.from("hr_submissions").select("*").eq("record_id", leave)).data,
    [],
  );
  const file = new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" });
  assert.ifError(
    (await a.storage.from("health-files").upload(path, file)).error,
  );
  assert.ok((await b.storage.from("health-files").download(path)).error);
  assert.ok(
    (await b.storage.from("health-files").createSignedUrl(path, 30)).error,
  );
  assert.ok(
    (
      await b.storage
        .from("health-files")
        .upload(`${owner}/${crypto.randomUUID()}.pdf`, file)
    ).error,
  );
  assert.ifError(
    (
      await a
        .from("records")
        .insert({
          id: att,
          user_id: owner,
          kind: "attachment",
          data: { title: "Test certificate", path, leave },
        })
    ).error,
  );
  made.push(att);
  assert.ifError((await a.storage.from("health-files").download(path)).error);
  assert.ifError(
    (await a.storage.from("health-files").createSignedUrl(path, 30)).error,
  );
  console.log(
    "PASS: record saving, cross-user read/write/link denial, HR audit, private upload/download/signed-URL access.",
  );
} finally {
  await a.storage.from("health-files").remove([path]);
  for (const record of made.reverse())
    await a.from("records").delete().eq("id", record);
  await a.auth.signOut();
  await b.auth.signOut();
}
