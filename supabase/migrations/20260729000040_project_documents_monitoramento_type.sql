-- ============================================================================
-- Adiciona 'monitoramento' como doc_type de upload em Documentos (Documento
-- de Monitoramento dos Resultados, mesmo padrão de DCP/Resumo de Cálculo).
-- 'foto' permanece um doc_type válido — sai da UI de Documentos mas passa a
-- ser gravado a partir do cadastro do projeto (ProjetosListPage).
-- ============================================================================

alter table project_documents drop constraint project_documents_doc_type_check;

alter table project_documents add constraint project_documents_doc_type_check
  check (doc_type in ('metodologia', 'dcp', 'resumo_calculo', 'monitoramento', 'auditoria_aprovacao', 'plano_melhorias', 'checklist', 'foto', 'outro'));
