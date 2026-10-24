# RODRIGUES F1

App PWA de Fórmula 1: notícias, calendário com horários de São Paulo, fins de semana de corrida em destaque, campeonato de pilotos e construtores, e notificações antes de cada sessão.

- `docs/` — o app (publicado pelo GitHub Pages)
- `supabase/functions/` — funções no Supabase (projeto Multiatendimento, schema isolado `f1`):
  - `f1-sync` — busca calendário, sessões e campeonato (Jolpica F1 API) e notícias (RSS); roda pelo pg_cron
  - `f1-data` — entrega os dados públicos ao app
  - `f1-subscribe` — cadastra aparelhos para push e guarda as preferências
  - `f1-notify` — envia os avisos (a cada 5 min pelo pg_cron)

Este app não é oficial da Fórmula 1.
