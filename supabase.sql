-- Spusťte jednou v Supabase → SQL Editor → New query → Run

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  text        text not null default '',
  url         text not null default '',
  image_url   text,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Přístup jen přes server (secret key). Veřejný klíč nemá k tabulce přístup.
alter table public.items enable row level security;

-- Veřejný bucket na obrázky
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;
