-- Vincula cada inventário da Pegada a um projeto de crédito de carbono
-- (carbon_projects) — primeira ligação entre os módulos Pegada e Créditos,
-- hoje totalmente separados. A trava de "um inventário por ano por
-- organização" passa a ser "um por ano por organização E por projeto",
-- permitindo vários inventários no mesmo ano (um por projeto).
alter table ghg_inventories add column project_id uuid references carbon_projects (id) on delete set null;

alter table ghg_inventories drop constraint ghg_inventories_organization_id_inventory_year_key;
alter table ghg_inventories add constraint ghg_inventories_org_year_project_key
  unique (organization_id, inventory_year, project_id);
