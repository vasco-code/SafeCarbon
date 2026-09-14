-- ============================================================================
-- Bucket público para logos (organizações e branding por subdomínio).
--
-- Motivação: os dois lugares que guardam "logo_url" (organizations.logo_url e
-- branding_configs.logo_url/favicon_url) eram campos de texto livre — dois
-- casos reais de logo quebrado encontrados em produção: (1) usuário colou a
-- home page do site da empresa em vez do arquivo de imagem; (2) usuário colou
-- a signed URL temporária (1h) de uma foto de projeto, que expirou e nunca
-- mais funcionou. Um bucket PÚBLICO resolve os dois problemas de uma vez: a
-- URL devolvida por getPublicUrl() é permanente (não expira, diferente de
-- createSignedUrl) e só existe depois de um upload real de arquivo de imagem
-- (não é mais possível colar um link qualquer).
--
-- Escrita (upload/update/delete) só para platform admin — mesma regra que já
-- protege UPDATE em organizations (20260707000018) e em branding_configs
-- (20260706000017). Leitura pública explícita, apesar do bucket já ser
-- `public: true` (o endpoint /object/public/ ignora RLS de qualquer forma) —
-- mantém o storage auditável por policy, como o resto do projeto.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('logos-public', 'logos-public', true)
on conflict (id) do nothing;

create policy logos_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'logos-public');

create policy logos_public_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos-public' and is_platform_admin());

create policy logos_public_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos-public' and is_platform_admin())
  with check (bucket_id = 'logos-public' and is_platform_admin());

create policy logos_public_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos-public' and is_platform_admin());
