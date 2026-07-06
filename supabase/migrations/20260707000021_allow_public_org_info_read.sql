-- Permite que qualquer usuário autenticado leia informações públicas de organizações
-- (necessário para exibir logos e nomes em listagens de projetos, mesmo se não é membro)
create policy organizations_public_read
  on organizations for select
  to authenticated
  using (true);
