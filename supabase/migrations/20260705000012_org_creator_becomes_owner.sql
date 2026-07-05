-- ============================================================================
-- Bug real encontrado via teste no browser (fluxo "+ Criar nova organização"
-- dentro de ProjetosListPage): criar uma organização não tornava o criador
-- membro dela. Consequência dupla:
--   1) org fica órfã — ninguém satisfaz is_org_manager/is_platform_admin, logo
--      ninguém consegue depois convidar membros ou editar a organização.
--   2) o INSERT ... RETURNING falhava com 42501 "new row violates row-level
--      security policy for table organizations", porque a policy de leitura
--      (organizations_member_read) exige ser membro, e a linha recém-criada
--      não é visível a quem não é membro ainda — Postgres trata RETURNING
--      como uma forma de SELECT para efeito de RLS.
--
-- Fix: quem cria a organização se torna 'owner' automaticamente.
-- ============================================================================

create or replace function handle_new_organization()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into org_members (org_id, user_id, member_role)
  values (new.id, auth.uid(), 'owner')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_creator_owner on organizations;
create trigger organizations_creator_owner
  after insert on organizations
  for each row
  execute function handle_new_organization();
