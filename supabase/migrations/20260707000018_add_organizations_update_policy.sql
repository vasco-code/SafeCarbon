-- Adiciona política de UPDATE para organizations (necessária para editar nome, logo_url, tax_id, etc)
create policy organizations_update
  on organizations for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

-- Adiciona política de DELETE para organizations (necessária para deletar)
create policy organizations_delete
  on organizations for delete
  to authenticated
  using (is_platform_admin());
