# Organiza Racha

Sistema web completo para gestão de rachas esportivos com foco em experiência do organizador e do atleta.

## Stack implementada

- Next.js 16 + App Router
- TypeScript
- Tailwind CSS 4
- Prisma ORM
- SQLite para desenvolvimento local didático
- Auth.js / NextAuth com Google Login e acesso demo local
- Componentes reutilizáveis com abordagem inspirada em shadcn/ui

## Principais funcionalidades

- Cadastro e edição de rachas
- Modalidade, regras, limite de atletas, data, horário e preço por participante
- WhatsApp do organizador, link do grupo e chave PIX
- Imagem de capa e imagem de perfil por URL
- Localização com preview de Google Maps
- Racha público ou privado com chave secreta
- Inscrição com nome, telefone, posição, nível e aceite das regras
- Confirmação de pagamento via PIX
- Cancelamento com prazo definido pelo organizador
- Solicitação de reembolso dentro da janela configurada
- Lista de espera quando o racha lota
- Painel do organizador para acompanhar participantes e pagamentos
- Página do usuário com suas inscrições

## Tecnologias recomendadas para evolução

Se quiser uma arquitetura ainda mais forte para produção, estas são as melhores opções para esse tipo de sistema:

1. **Next.js + PostgreSQL + Prisma + Auth.js**
   - Melhor equilíbrio entre produtividade, SEO, performance e manutenção.
   - Recomendação principal para o Organiza Racha.

2. **Next.js + Supabase**
   - Ótimo se quiser banco PostgreSQL, autenticação e storage prontos mais rápido.
   - Excelente para subir MVP com menos infraestrutura.

3. **NestJS no backend + Next.js no frontend**
   - Melhor quando o sistema crescer muito, com regras complexas, app mobile e integrações externas.
   - Mais robusto, porém mais trabalhoso.

4. **Laravel + Inertia/Vue**
   - Alternativa muito boa se preferir ecossistema PHP e produtividade alta.

## Como rodar o projeto

1. Instale as dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente copiando `.env.example` para `.env`.

3. Gere o banco local:

```bash
npm run db:push
```

4. Popule com dados de exemplo:

```bash
npm run db:seed
```

5. Rode o ambiente de desenvolvimento:

```bash
npm run dev
```

## Google Login

Para ativar o login com Google:

1. No Google Cloud Console, crie (ou selecione) um projeto.
2. Vá em **APIs e serviços > Tela de consentimento OAuth** e configure os dados básicos.
3. Em **Credenciais**, crie um **ID do cliente OAuth 2.0** (tipo **Aplicativo da Web**).
4. Adicione a URI autorizada de redirecionamento:
   - `http://localhost:3000/api/auth/callback/google`

5. Copie o Client ID e Client Secret para o `.env` (ou `.env.local`):

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

Também é aceito o padrão `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

Enquanto isso, o projeto também oferece um acesso demo local para facilitar validação e desenvolvimento.

## Próximos passos sugeridos

- Integrar PIX real com provedor de pagamento
- Upload real de imagens com Cloudinary ou UploadThing
- Notificações por WhatsApp e e-mail
- Geolocalização com busca por distância
- App mobile com React Native ou Expo
