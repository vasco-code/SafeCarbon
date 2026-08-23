-- Corrige "infinite recursion detected in policy for relation
-- credit_issuances" (erro 42P17). A policy credit_issuances_select_holder
-- (20260708000026) consulta blockchain_tokens dentro do próprio USING, e
-- blockchain_tokens_read (mesma migration em diante) consulta credit_issuances
-- de volta — cada SELECT nessas tabelas força o Postgres a reavaliar a RLS
-- da outra, entrando em loop. Isso quebrava silenciosamente qualquer leitura
-- que envolvesse essas tabelas (ex.: os KPIs "Ciclo vigente"/"Redução de
-- emissões elegível"/"Créditos gerados" do Descritivo do projeto, que fazem
-- credit_calculation_cycles -> credit_batches -> credit_issuances num único
-- select aninhado).
--
-- Mesma solução já usada por has_project_role/is_platform_admin: funções
-- security definer leem a tabela "do outro lado" sem passar pela RLS dela,
-- cortando o ciclo.

create or replace function is_blockchain_token_holder(p_credit_issuance_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from blockchain_tokens t
    where t.credit_issuance_id = p_credit_issuance_id
      and t.holder_org_id is not null
      and exists (
        select 1 from org_members om
        where om.org_id = t.holder_org_id and om.user_id = auth.uid()
      )
  );
$$;

create or replace function credit_issuance_project_id(p_credit_issuance_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select c.project_id
  from credit_issuances i
  join credit_batches b on b.id = i.credit_batch_id
  join credit_calculation_cycles c on c.id = b.cycle_id
  where i.id = p_credit_issuance_id;
$$;

drop policy credit_issuances_select_holder on credit_issuances;
create policy credit_issuances_select_holder
  on credit_issuances for select
  to authenticated
  using (is_blockchain_token_holder(credit_issuances.id));

drop policy blockchain_tokens_read on blockchain_tokens;
create policy blockchain_tokens_read
  on blockchain_tokens for select
  to authenticated
  using (
    has_project_role(
      credit_issuance_project_id(blockchain_tokens.credit_issuance_id),
      array['proponent', 'developer', 'verifier', 'admin']::project_role[]
    )
    or is_platform_admin()
  );
