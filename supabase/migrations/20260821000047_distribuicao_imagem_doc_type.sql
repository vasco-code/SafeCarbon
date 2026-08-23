-- Adiciona 'distribuicao_imagem' como doc_type — a imagem única de
-- concentração geográfica de propriedades compradoras (alternativa ao mapa
-- interativo, ex.: Figura 5 do DCP), mostrada na nova seção "Distribuição
-- Geográfica" da aba Descritivo do projeto. O mapa interativo existente
-- (project_sites) passa a se chamar "Unidades Produtoras" — são coisas
-- diferentes: uma é onde a Premix produz, a outra é onde os clientes estão.
alter table project_documents drop constraint project_documents_doc_type_check;

alter table project_documents add constraint project_documents_doc_type_check
  check (doc_type in ('metodologia', 'dcp', 'resumo_calculo', 'monitoramento', 'auditoria_aprovacao', 'plano_melhorias', 'checklist', 'foto', 'distribuicao_imagem', 'outro'));
