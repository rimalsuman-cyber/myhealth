import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  visit = "33333333-3333-4333-8333-333333333333",
  leave = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function asUser(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202611170001_health_diary.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await asUser(a);
  await db.query(
    "insert into public.records(id,user_id,kind,data) values($1,$2,$3,$4)",
    [
      visit,
      a,
      "visit",
      { title: "Test visit", date: "2026-11-17", diagnosis: "Keep EXACT ä" },
    ],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL RLS with two authenticated users", () => {
  it("saves and reads an owned visit without altering diagnosis", async () => {
    await asUser(a);
    const r = await db.query<{ data: Record<string, string> }>(
      "select data from public.records where id=$1",
      [visit],
    );
    expect(r.rows[0].data.diagnosis).toBe("Keep EXACT ä");
  });
  it("hides another user records and denies updates/deletes", async () => {
    await asUser(b);
    expect(
      (await db.query("select * from public.records where id=$1", [visit]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'update public.records set data=data||\'{"title":"Hijacked"}\' where id=$1 returning id',
          [visit],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("delete from public.records where id=$1 returning id", [
          visit,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects spoofed record owners", async () => {
    await asUser(b);
    await expect(
      db.query(
        "insert into public.records(user_id,kind,data) values($1,$2,$3)",
        [a, "visit", { title: "Spoof", date: "2026-11-17" }],
      ),
    ).rejects.toThrow();
  });
  it("rejects cross-account parent references", async () => {
    await asUser(b);
    await expect(
      db.query(
        "insert into public.records(user_id,kind,data) values($1,$2,$3)",
        [b, "medicine", { title: "Cross link", visit, status: "Active" }],
      ),
    ).rejects.toThrow(/Invalid linked record/);
  });
  it("records HR changes and calculates inclusive calendar days", async () => {
    await asUser(a);
    const data = {
      title: "Leave",
      visit,
      start: "2026-03-28",
      end: "2026-03-30",
      percentage: "50",
      status: "Not sent",
    };
    await db.query(
      "insert into public.records(id,user_id,kind,data) values($1,$2,$3,$4)",
      [leave, a, "leave", data],
    );
    await db.query("update public.records set data=$1 where id=$2", [
      { ...data, status: "Sent", sent: "2026-03-28" },
      leave,
    ]);
    expect(
      (
        await db.query<{ calendar_days: number }>(
          "select calendar_days from public.sick_leave_periods where id=$1",
          [leave],
        )
      ).rows[0].calendar_days,
    ).toBe(3);
    expect(
      (
        await db.query(
          "select * from public.hr_submissions where record_id=$1",
          [leave],
        )
      ).rows,
    ).toHaveLength(2);
    await asUser(b);
    expect(
      (await db.query("select * from public.hr_submissions")).rows,
    ).toHaveLength(0);
  });
  it("prevents orphaning linked records", async () => {
    await asUser(a);
    await expect(
      db.query("delete from public.records where id=$1", [visit]),
    ).rejects.toThrow(/Remove linked records first/);
  });
  it("restricts private file metadata to the owner for all operations", async () => {
    await asUser(a);
    const path = a + "/test.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name) values('health-files',$1)",
      [path],
    );
    await asUser(b);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('health-files',$1)",
        [a + "/spoof.pdf"],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update storage.objects set name=$1 where name=$2 returning id",
          [b + "/stolen.pdf", path],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning id",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(a);
    expect(
      (await db.query("select * from storage.objects where name=$1", [path]))
        .rows,
    ).toHaveLength(1);
  });
  it("rejects attaching a file from another owner folder", async () => {
    await asUser(b);
    await expect(
      db.query(
        "insert into public.records(user_id,kind,data) values($1,$2,$3)",
        [b, "attachment", { title: "Stolen file", path: a + "/test.pdf" }],
      ),
    ).rejects.toThrow(/Invalid attachment ownership/);
  });
  it("denies anonymous access", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from public.records")).rejects.toThrow();
  });
});
