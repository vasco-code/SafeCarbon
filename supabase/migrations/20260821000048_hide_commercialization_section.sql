-- Permite ocultar a seção "Comercialização" (import de NF-e) dentro de
-- Cálculo das emissões e remoções, por projeto — alguns projetos (ex.:
-- Premix) têm as evidências de comercialização como parte do relatório de
-- auditoria externo, não dessa tela, então os dados de exemplo em tela
-- ficam confusos. Nullable/default false: nenhum projeto existente muda de
-- comportamento até ser marcado explicitamente.
alter table carbon_projects
  add column hide_commercialization_section boolean not null default false;
