-- Permite que usuários não autenticados leiam branding_configs (necessário para página de login)
create policy branding_read_anon on branding_configs for select
  to anon
  using (true);
