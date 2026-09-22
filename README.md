# AI Studio — Comunicação Contábil

Base SaaS corporativa para criação, gestão e aprovação de conteúdos da Gerência de Contabilidade.

## Executar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Arquitetura

- `src/app`: rotas do App Router e páginas por módulo.
- `src/components`: componentes de layout, dashboard, estúdio e compartilhados.
- `src/data`: mocks tipados, isolados da UI para futura troca por repositórios.
- `src/types`: contratos de domínio.
- `src/lib`: navegação, utilitários e futuras fronteiras de infraestrutura.
- `src/styles`: tokens de design documentados e CSS global.

Não há integração real com autenticação, banco, Supabase, Railway ou IA nesta sprint. Variáveis futuras estão apenas documentadas em `.env.example`.
