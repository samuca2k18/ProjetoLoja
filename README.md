# Controle de Mensalidades - Escola de Musica

Aplicacao React + Supabase para funcionarios controlarem alunos, responsaveis, modalidades e pagamentos mensais.

## Stack

- Frontend: React + Vite
- Backend: Supabase Auth + Postgres + RLS
- Banco: SQL em `supabase/schema.sql`

## Configuracao

1. Crie um projeto no Supabase.
2. Em Authentication > Providers > Email, desligue a opcao de confirmar email.
3. Abra o SQL Editor e rode o arquivo `supabase/schema.sql`.
4. Copie `.env.example` para `.env.local`.
5. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publishable-ou-anon
```

6. Instale e rode:

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

## Acesso dos funcionarios

A tela de login nao cria conta publica. Somente funcionarios que ja existem no Supabase Auth conseguem entrar.

Crie os funcionarios em Authentication > Users. O trigger do banco cria o perfil em `public.profiles` automaticamente com role `staff`.

Para transformar alguem em administrador, rode no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'email-do-admin@exemplo.com';
```

## O que existe

- Login interno com Supabase Auth, sem tela publica de cadastro.
- Cadastro de responsavel/familia com nome, email e telefone.
- Cadastro de aluno ligado ao responsavel.
- Um aluno pode ter varias modalidades no mesmo cadastro.
- Pais/responsaveis com varios filhos ficam agrupados pelo mesmo cadastro de responsavel.
- Funcionarios podem cadastrar responsaveis, alunos, modalidades do aluno e pagamentos.
- Lancamento de pagamento pode dar baixa em varias matriculas juntas.
- Cada pagamento guarda o funcionario que lancou a baixa pelo perfil, nome e email.
- Administrador ve relatorios com responsavel, alunos/modalidades pagos juntos, forma, valor e funcionario que lancou.
- Administrador corrige data, mes, valor, forma e observacao do pagamento.
- Administrador estorna pagamentos.
- Bloqueio de pagamento duplicado por matricula/modalidade no mesmo mes.
- Tela de pendencias com matriculas em aberto e atrasadas.
- Exportacao CSV do historico financeiro.
- RLS habilitado nas tabelas publicas.

## Modelo do banco

- `guardians`: responsaveis/familias.
- `students`: alunos.
- `student_enrollments`: uma matricula por aluno e modalidade.
- `payments`: pagamento recebido, responsavel pagador e funcionario que lancou.
- `payment_items`: modalidades/matriculas pagas dentro de um pagamento conjunto.
- `payment_statuses`: status mensal usado pela tela de pendencias.

## Proximos passos

- Recibos em PDF.
- Avisos por WhatsApp.
- Tela de modalidades para editar valores padrao sem SQL.
