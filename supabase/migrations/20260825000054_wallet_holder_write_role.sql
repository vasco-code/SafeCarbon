-- blockchain_tokens_update_holder (20260708000026_wallet_holder_and_transfers.sql)
-- libera update (transferir/aposentar, via as edge functions transfer-credit/
-- retire-credit, que rodam com o JWT do próprio chamador — RLS é a única
-- barreira real aqui) pra QUALQUER membro da org detentora do token, sem
-- checar member_role. Descoberto testando o usuário viewer criado para
-- validar has_project_write_role: ele via os botões "Transferir"/"Aposentar"
-- na própria Carteira, e o RLS realmente deixaria a ação passar.
--
-- Braço "detentor" ganha a mesma exigência de member_role <> 'viewer' já
-- usada em has_project_write_role. Braço "developer/admin do projeto" (opera
-- em nome do dono) passa a usar has_project_write_role por consistência.
drop policy blockchain_tokens_update_holder on blockchain_tokens;
create policy blockchain_tokens_update_holder
  on blockchain_tokens for update
  to authenticated
  using (
    (holder_org_id is not null and exists (
      select 1 from org_members om
      where om.org_id = blockchain_tokens.holder_org_id
        and om.user_id = auth.uid()
        and om.member_role <> 'viewer'
    ))
    or exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_write_role(c.project_id, array['developer', 'admin']::project_role[])
    )
    or is_platform_admin()
  )
  with check (
    (holder_org_id is not null and exists (
      select 1 from org_members om
      where om.org_id = blockchain_tokens.holder_org_id
        and om.user_id = auth.uid()
        and om.member_role <> 'viewer'
    ))
    or exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_write_role(c.project_id, array['developer', 'admin']::project_role[])
    )
    or is_platform_admin()
  );
