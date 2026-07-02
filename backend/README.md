# RedNest V2 — Backend

CTI/OSINT platform API. **NestJS 11 + Prisma 6 + PostgreSQL 17**, JWT auth (access/refresh),
RBAC (admin/analyst/viewer), API keys, audit logging, rich engagement data as JSONB.

## Stack

| Camada      | Tecnologia                          |
| ----------- | ----------------------------------- |
| Framework   | NestJS 11 (monólito modular)        |
| ORM         | Prisma 6                            |
| Banco       | PostgreSQL 17                       |
| Auth        | JWT (access 15m + refresh 7d), Argon2id |
| Cache/Fila  | Redis (docker-compose, uso futuro)  |
| Logs        | Pino (nestjs-pino)                  |
| Rate limit  | @nestjs/throttler (100 req/min)     |
| Docs        | Swagger em `/api/docs`              |

## Subir o ambiente

```bash
cd backend
cp .env.example .env            # ajuste os segredos
docker compose up -d            # PostgreSQL + Redis
npm install
npm run prisma:generate         # gera o Prisma Client
npm run prisma:migrate          # cria as tabelas (migração inicial)
npm run db:seed                 # popula com os dados dos mocks do front
npm run start:dev               # API em http://localhost:3333/api
```

Swagger: `http://localhost:3333/api/docs`

## Usuários criados pelo seed

| usuário | senha       | papel    |
| ------- | ----------- | -------- |
| admin   | admin123    | admin    |
| analyst | analyst123  | analyst  |
| viewer  | viewer123   | viewer   |

## Estrutura

```
src/
├── auth/          # login, refresh, logout, me  (JWT)
├── users/         # CRUD de usuários (admin)
├── operations/    # CRUD + /:id/engagements + /:id/timeline
├── engagements/   # CRUD + /:id/status  (JSONB por tipo)
├── iocs/          # CRUD + filtros + /:id/related (grafo)
├── timeline/      # eventos cronológicos
├── alerts/        # listagem + ack
├── dashboard/     # /stats
├── api-keys/      # geração/revogação (argon2, mostrada 1x)
├── audit/         # registro de auditoria (global)
├── common/        # guards, decorators, util
└── prisma/        # PrismaService global
```

## Endpoints principais

| Método | Rota                          | Papel mínimo |
| ------ | ----------------------------- | ------------ |
| POST   | `/api/auth/login`             | público      |
| POST   | `/api/auth/refresh`           | público      |
| GET    | `/api/auth/me`                | autenticado  |
| GET    | `/api/operations`             | viewer       |
| POST   | `/api/operations`             | analyst      |
| GET    | `/api/engagements/:id`        | viewer       |
| PATCH  | `/api/engagements/:id/status` | analyst      |
| GET    | `/api/iocs?type=&threatLevel=&operation=&engagement=` | viewer |
| POST   | `/api/iocs`                   | analyst      |
| GET    | `/api/timeline`               | viewer       |
| GET    | `/api/alerts`                 | viewer       |
| PATCH  | `/api/alerts/:id/read`        | viewer       |
| GET    | `/api/dashboard/stats`        | viewer       |
| GET/POST | `/api/api-keys`             | autenticado  |
| GET    | `/api/users`                  | admin        |
| GET    | `/api/integrations`           | viewer       |
| PUT    | `/api/integrations/:service`  | analyst      |
| POST   | `/api/integrations/:service/test` | analyst  |
| POST   | `/api/enrich/ip` `/domain` `/cve` `/asn` `/whois` `/subdomains` `/wayback` | analyst |
| POST   | `/api/checkhost`              | analyst      |

## Integrações externas (portadas da v1)

Com chave (`provider_keys`, criptografadas AES-256-GCM): **AbuseIPDB, VirusTotal,
AlienVault OTX, ThreatFox, Censys**. Sem chave: **Check-Host**, **crt.sh / CertSpotter /
Anubis** (subdomínios), **CIRCL + NVD** (CVE), **BGPView + ipinfo** (ASN), **rdap.org +
DNS** (WHOIS), **Wayback Machine**.

- `GET /api/integrations` — estado de cada provedor (configurado? chave mascarada?).
- `PUT /api/integrations/:service` `{ "value": "<chave>" }` — define/remove a chave.
- `POST /api/integrations/:service/test` — testa a chave contra `8.8.8.8`.
- `POST /api/enrich/ip` `{ "ip": "..." }` — threat intel agregado (5 provedores) + veredito.
- `POST /api/enrich/domain` `{ "domain": "..." }` — VT + OTX + ThreatFox + veredito.
- `POST /api/enrich/cve|asn|whois|subdomains|wayback` — enriquecimento sem chave.
- `POST /api/checkhost` `{ "target": "...", "kind": "ping|http|tcp|dns" }`.

Importar as chaves da v1 (`~/.rednest/apikeys.json`) para o banco da v2:

```bash
# INTEGRATIONS_SECRET precisa ser o mesmo que o backend usa para descriptografar
INTEGRATIONS_SECRET=<seu-segredo> npm run keys:import
```

## Dados ricos dos engagements

Cada engagement guarda seu payload específico (`osintData`, `webData`, `domainData`,
`infraData`, `personData`, `orgData`, `socialData`, `leakData`) na tabela `engagement_data`
(coluna `data JSONB`, índice GIN recomendado). A API serializa de volta para a chave que o
front espera conforme o `type` do engagement.

## Segurança

- Senhas e API keys com **Argon2id** (nunca texto puro).
- **Soft delete** em operations/engagements/iocs (`deleted_at` / `deleted_by`).
- **Auditoria** de login/logout, criação/remoção de IOC, engagement, API keys.
- **Rate limiting** global; headers sensíveis omitidos dos logs.
- Dados sensíveis (CPF/credenciais) já chegam mascarados nos mocks; o RBAC restringe escrita.

## Próximas fases (não implementadas)

- BullMQ + Redis para jobs de enriquecimento/monitoramento.
- Integrações externas (VirusTotal, Shodan, Censys, AbuseIPDB, MISP).
- Módulo de evidências e geração de relatórios.
