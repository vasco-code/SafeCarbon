-- ============================================================================
-- A trigger da migration 000012 (organizations_creator_owner) resolve o
-- problema de fundo — quem cria a org se torna owner — mas NÃO resolve o
-- "INSERT ... RETURNING" que o client-side usa (.insert().select().single()):
-- o Postgres avalia a visibilidade SELECT para o RETURNING usando o snapshot
-- do próprio comando INSERT, que não reflete a linha que o trigger AFTER
-- INSERT grava em org_members durante a mesma instrução. Resultado: mesmo
-- com o trigger funcionando (comprovado via teste manual em transação — a
-- linha em org_members existe), o RETURNING ainda falha com 42501.
--
-- Fix definitivo: parar de depender de outra tabela para a visibilidade do
-- RETURNING. Adicionar created_by e usar isso diretamente na policy de
-- leitura — sem depender de uma linha escrita por um trigger em outra tabela
-- dentro do mesmo statement.
-- ============================================================================

alter table organizations add column if not exists created_by uuid references auth.users(id);
alter table organizations alter column created_by set default auth.uid();

drop policy if exists organizations_member_read on organizations;
create policy organizations_member_read
  on organizations for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from org_members om
      where om.org_id = organizations.id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );
