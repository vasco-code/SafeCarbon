-- Permite marcar cada lançamento de atividade com um mês (1-12) do ano do
-- inventário, para viabilizar entrada mensal e relatórios de subperíodo.
-- Nullable: lançamentos existentes e futuros sem mês informado continuam
-- válidos, tratados como "ano inteiro" nos relatórios.
alter table ghg_activity_entries add column period_month smallint;

alter table ghg_activity_entries add constraint ghg_activity_entries_period_month_check
  check (period_month is null or period_month between 1 and 12);
