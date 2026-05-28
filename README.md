# Controle de Mensalidades - Escola de Música

Aplicação React + Supabase para controlar alunos, mensalidades e pagamentos.

## Stack

- Frontend: React + Vite
- Backend: Supabase Auth + Postgres + RLS
- Banco: SQL em `supabase/schema.sql`

## Configuração

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e rode o arquivo `supabase/schema.sql`.
3. Copie `.env.example` para `.env.local`.
4. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable-ou-anon
```

5. Instale e rode:

```bash
npm install
npm run dev
```

Para aplicar o banco automaticamente pelo terminal, coloque a connection string do Postgres no `.env`:

```env
SUPABASE_DB_URL=postgresql://...
```

Depois rode:

```bash
npm run db:apply
```

Se preferir não colocar a connection string localmente, rode `supabase/schema.sql` manualmente no SQL Editor. O arquivo usa `create table if not exists`, `alter table ... add column if not exists`, `create or replace function` e recria políticas, então ele também aplica os ajustes novos.

## Permissões

Toda conta nova entra como `staff`. Depois de criar a conta do seu pai, rode no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = 'ID-DO-USUARIO-DO-SEU-PAI';
```

O ID do usuário aparece em Authentication > Users no painel do Supabase.

## O que já existe

- Login/cadastro com Supabase Auth.
- Cadastro e listagem de alunos.
- Edição de alunos: nome, telefone, modalidade, mensalidade, vencimento, status e observações.
- Modalidades iniciais: Piano, Violão, Bateria, Canto e Pintura.
- Lançamento de pagamento mensal.
- Correção de pagamento para administrador: aluno, mês, data, valor, forma e observação.
- Estorno de pagamento para administrador.
- Bloqueio de pagamento duplicado por aluno/mês.
- Funcionária vê alunos, pendências e status de pagamento.
- Funcionária não consulta a tabela de pagamentos nem relatórios financeiros.
- Tela de pendências com alunos em aberto e atrasados.
- Administrador vê recebido no dia, no período, pendências e histórico.
- Administrador filtra relatórios por período e exporta CSV.
- Administrador gerencia usuários e permissões `staff`/`admin`.
- RLS habilitado nas tabelas públicas.

## Próximos passos

- Recibos em PDF.
- Avisos por WhatsApp.
- Auditoria detalhada das alterações.
- Tela de modalidades para editar valores padrão sem SQL.
# ProjetoLoja
