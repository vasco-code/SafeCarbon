-- Adiciona logo_url a organizations (cada org pode ter seu logo)
alter table organizations add column logo_url text;

-- Tabela de configuração de branding por subdomínio
create table if not exists branding_configs (
  id uuid default gen_random_uuid() primary key,
  subdomain text not null unique,
  logo_url text,
  favicon_url text,
  primary_oklch text default 'oklch(0.440 0.150 269)',
  accent_oklch text default 'oklch(0.700 0.130 195)',
  success_oklch text default 'oklch(0.500 0.140 145)',
  danger_oklch text default 'oklch(0.520 0.180 25)',
  warning_oklch text default 'oklch(0.680 0.150 70)',
  updated_at timestamp with time zone default now(),
  updated_by uuid references auth.users(id)
);

alter table branding_configs enable row level security;

-- RLS: admins podem ler/escrever; usuários comuns lêem só
create policy branding_read on branding_configs for select
  to authenticated
  using (true);

create policy branding_write on branding_configs for insert
  to authenticated
  with check (is_platform_admin());

create policy branding_update on branding_configs for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

create policy branding_delete on branding_configs for delete
  to authenticated
  using (is_platform_admin());

-- Index pra lookup rápido por subdomínio
create index branding_configs_subdomain_idx on branding_configs(subdomain);
