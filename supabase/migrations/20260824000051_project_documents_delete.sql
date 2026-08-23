-- Nunca existiu policy de DELETE para project_documents nem para o storage
-- do bucket project-documents — o botão "Excluir" em Documentos sempre
-- existiu na UI, mas o banco recusava silenciosamente (RLS nega por padrão
-- sem policy correspondente). Espelha exatamente as regras de INSERT já
-- existentes: developer/admin/platform_admin podem excluir qualquer
-- doc_type; verifier só os dois doc_type da área de auditoria/verificação.
create policy project_documents_delete
  on project_documents for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]) or is_platform_admin());

create policy project_documents_delete_verifier
  on project_documents for delete
  to authenticated
  using (
    doc_type in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role(project_id, array['verifier']::project_role[])
  );

create policy project_documents_storage_delete_full
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      has_project_role((storage.foldername(name))[1]::uuid, array['developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

create policy project_documents_storage_delete_verifier
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[2] in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role((storage.foldername(name))[1]::uuid, array['verifier']::project_role[])
  );
