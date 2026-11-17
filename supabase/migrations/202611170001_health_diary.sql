-- Supabase Free: Postgres, Auth, private Storage only. No paid extensions.
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 language text not null default 'en' check(language in ('en','de')),
 timezone text not null default 'Europe/Zurich',
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profile_owner on public.profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- One versioned record envelope with typed payloads and enforced owner links.
-- Views below provide explicit domain collections without duplicated health data.
create table public.records (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('doctor','visit','medicine','leave','attachment','reminder')),
 data jsonb not null check(jsonb_typeof(data)='object' and length(trim(data->>'title'))>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,user_id),
 check(kind<>'medicine' or data->>'status' in ('Active','Completed','Stopped')),
 check(kind<>'leave' or (data ?& array['start','end','visit','percentage','status'] and data->>'status' in ('Not sent','Sent','Acknowledged')))
);
create index records_owner_kind on public.records(user_id,kind);
create index records_payload on public.records using gin(data);
alter table public.records enable row level security;
create policy record_owner on public.records for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.records,public.profiles to authenticated;
revoke all on public.records,public.profiles from anon;

create function public.validate_health_record() returns trigger language plpgsql set search_path=public as $$
declare ref_key text; ref_value text; expected_kind text;
begin
 if TG_OP='UPDATE' and (NEW.user_id<>OLD.user_id or NEW.kind<>OLD.kind or NEW.id<>OLD.id) then raise exception 'Record identity is immutable'; end if;
 NEW.updated_at=now();
 if NEW.data->>'title' is null or length(trim(NEW.data->>'title'))=0 then raise exception 'Title is required'; end if;
 foreach ref_key in array array['doctor','visit','medicine','leave','extends'] loop
  ref_value=NEW.data->>ref_key;
  expected_kind=case when ref_key='extends' then 'leave' else ref_key end;
  if ref_value is not null and ref_value<>'' and not exists(select 1 from public.records r where r.id=ref_value::uuid and r.user_id=NEW.user_id and r.kind=expected_kind and r.id<>NEW.id) then raise exception 'Invalid linked record'; end if;
 end loop;
 if NEW.kind='leave' then
  if coalesce(NEW.data->>'visit','')='' or (NEW.data->>'start')::date is null or (NEW.data->>'end')::date is null or (NEW.data->>'end')::date<(NEW.data->>'start')::date then raise exception 'Invalid sick leave dates or visit'; end if;
  if (NEW.data->>'percentage')::numeric not between 1 and 100 then raise exception 'Invalid incapacity percentage'; end if;
  if NEW.data->>'status'<>'Not sent' and coalesce(NEW.data->>'sent','')='' then raise exception 'Date sent is required'; end if;
 end if;
 if NEW.kind='visit' and nullif(NEW.data->>'date','')::date is null then raise exception 'Visit date is required'; end if;
 if NEW.kind='medicine' and nullif(NEW.data->>'end','')::date<nullif(NEW.data->>'start','')::date then raise exception 'Invalid medicine dates'; end if;
 if NEW.kind='attachment' and (coalesce(NEW.data->>'path','') not like NEW.user_id::text||'/%' or NEW.data->>'path' like '%..%') then raise exception 'Invalid attachment ownership'; end if;
 return NEW;
end $$;
create trigger validate_record before insert or update on public.records for each row execute function public.validate_health_record();

-- Prevent accidental orphaning; remove linked children explicitly first.
create function public.protect_health_links() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.records r where r.user_id=OLD.user_id and r.id<>OLD.id and (r.data->>'doctor'=OLD.id::text or r.data->>'visit'=OLD.id::text or r.data->>'medicine'=OLD.id::text or r.data->>'leave'=OLD.id::text or r.data->>'extends'=OLD.id::text)) then raise exception 'Remove linked records first'; end if;
 return OLD;
end $$;
create trigger protect_record before delete on public.records for each row execute function public.protect_health_links();

create view public.doctors with(security_invoker=true) as select * from public.records where kind='doctor';
create view public.visits with(security_invoker=true) as select * from public.records where kind='visit';
create view public.prescriptions with(security_invoker=true) as select * from public.records where kind='medicine';
create view public.sick_leave_periods with(security_invoker=true) as select *, (data->>'end')::date-(data->>'start')::date+1 as calendar_days from public.records where kind='leave';
create view public.attachments with(security_invoker=true) as select * from public.records where kind='attachment';
create view public.reminders with(security_invoker=true) as select * from public.records where kind='reminder';
grant select on public.doctors,public.visits,public.prescriptions,public.sick_leave_periods,public.attachments,public.reminders to authenticated;

-- HR audit contains only HR fields; no diagnosis, medicines or medical notes.
create table public.hr_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 record_id uuid not null,
 status text not null check(status in ('Not sent','Sent','Acknowledged')),
 sent_date date,
 method text,
 recipient text,
 recorded_at timestamptz not null default now(),
 foreign key(record_id,user_id) references public.records(id,user_id) on delete cascade
);
alter table public.hr_submissions enable row level security;
create policy hr_read on public.hr_submissions for select to authenticated using(user_id=auth.uid());
grant select on public.hr_submissions to authenticated;
create function public.audit_hr_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if NEW.kind='leave' and (TG_OP='INSERT' or NEW.data->>'status' is distinct from OLD.data->>'status' or NEW.data->>'sent' is distinct from OLD.data->>'sent') then
 insert into public.hr_submissions(user_id,record_id,status,sent_date,method,recipient) values(NEW.user_id,NEW.id,NEW.data->>'status',nullif(NEW.data->>'sent','')::date,NEW.data->>'method',NEW.data->>'recipient');
 end if; return NEW;
end $$;
revoke all on function public.audit_hr_status() from public,anon,authenticated;
create trigger hr_audit after insert or update on public.records for each row execute function public.audit_hr_status();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('health-files','health-files',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
create policy private_health_read on storage.objects for select to authenticated using(bucket_id='health-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_health_insert on storage.objects for insert to authenticated with check(bucket_id='health-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_health_update on storage.objects for update to authenticated using(bucket_id='health-files' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='health-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_health_delete on storage.objects for delete to authenticated using(bucket_id='health-files' and (storage.foldername(name))[1]=auth.uid()::text);
