-- Permite vincular cada lançamento do Inventário de Emissões a um local
-- (project_sites) do projeto, para viabilizar inventário por fazenda/unidade
-- e totais por local. Nullable + on delete set null: lançamentos existentes
-- e sem local continuam válidos ("Projeto, sem local específico"), e excluir
-- um site não derruba os lançamentos já feitos.
alter table emission_inventory_entries
  add column site_id uuid references project_sites (id) on delete set null;

create index idx_emission_inventory_entries_site
  on emission_inventory_entries (project_id, site_id);
