-- ============================================================================
-- "Metodologia" deixa de ser um menu top-level (MetodologiaListPage/
-- MetodologiaDetailPage seguem existindo, só saem da navegação) e passa a
-- ser um doc_type de upload dentro de Documentos, como DCP/Resumo de
-- Cálculo/etc. Só amplia o check constraint — nenhuma policy nova precisa,
-- as policies de project_documents já cobrem qualquer doc_type por role.
-- ============================================================================

alter table project_documents drop constraint project_documents_doc_type_check;

alter table project_documents add constraint project_documents_doc_type_check
  check (doc_type in ('metodologia', 'dcp', 'resumo_calculo', 'auditoria_aprovacao', 'plano_melhorias', 'checklist', 'foto', 'outro'));
