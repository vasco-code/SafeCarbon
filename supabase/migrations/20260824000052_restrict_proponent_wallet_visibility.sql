-- credit_issuances_read e blockchain_tokens_read davam a QUALQUER papel do
-- projeto (inclusive 'proponent') acesso a todos os tokens/emissões do
-- projeto, sem olhar para holder_org_id. Isso não importava enquanto só
-- existia 1 token por lote (sempre no nome do proponente) — mas agora que um
-- lote pode ser dividido entre organizações (ex.: 95% Premix / 5% E2Carbon),
-- isso deixava o proponente ver a carteira de outras organizações que só
-- detêm parte dos créditos do mesmo projeto.
--
-- Tira 'proponent' do array — developer/admin continuam com visão completa
-- (operam a emissão/aposentadoria/transferência, então precisam ver tudo,
-- independente de quem detém). Verifier mantém acesso a blockchain_tokens
-- (auditoria). O proponente passa a enxergar só o que já é seu, via as
-- policies *_select_holder (holder_org_id) que já existiam.
drop policy credit_issuances_read on credit_issuances;
create policy credit_issuances_read
  on credit_issuances for select
  to authenticated
  using (
    exists (
      select 1 from credit_batches b
      join credit_calculation_cycles c on c.id = b.cycle_id
      where b.id = credit_issuances.credit_batch_id
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

drop policy blockchain_tokens_read on blockchain_tokens;
create policy blockchain_tokens_read
  on blockchain_tokens for select
  to authenticated
  using (
    has_project_role(
      credit_issuance_project_id(blockchain_tokens.credit_issuance_id),
      array['developer', 'verifier', 'admin']::project_role[]
    )
    or is_platform_admin()
  );
