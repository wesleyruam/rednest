╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    ██████╗ ███████╗██████╗ ███╗   ██╗███████╗███████╗████████╗               ║
║    ██╔══██╗██╔════╝██╔══██╗████╗  ██║██╔════╝██╔════╝╚══██╔══╝               ║
║    ██████╔╝█████╗  ██║  ██║██╔██╗ ██║█████╗  ███████╗   ██║                  ║
║    ██╔══██╗██╔══╝  ██║  ██║██║╚██╗██║██╔══╝  ╚════██║   ██║                  ║
║    ██║  ██║███████╗██████╔╝██║ ╚████║███████╗███████║   ██║                  ║
║    ╚═╝  ╚═╝╚══════╝╚═════╝ ╚═╝  ╚═══╝╚══════╝╚══════╝   ╚═╝                  ║
║                                                                              ║
║         Plataforma de CTI · OSINT · Investigação Digital  —  self-hosted     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

  RedNest é uma plataforma unificada, auto-hospedada, para conduzir investigações
  de inteligência de ameaças (CTI), coleta em fontes abertas (OSINT) e investigação
  digital — do reconhecimento inicial à correlação de achados, dossiês, evidências
  e relatórios. Tudo organizado por Operações e Engajamentos, com um modelo de
  entidades unificado onde "cada informação existe uma única vez".

  ⚠  Uso restrito a investigações AUTORIZADAS, pesquisa de segurança, CTI defensivo
     e fins educacionais. Veja "AVISO LEGAL" no fim.


────────────────────────────────────────────────────────────────────────────────
  ÍNDICE
────────────────────────────────────────────────────────────────────────────────
  1.  Visão geral
  2.  Capacidades (o que a plataforma faz)
  3.  Arquitetura & stack
  4.  Começando (subir em 1 comando)
  5.  Estrutura do repositório
  6.  Segurança & privacidade
  7.  Screenshots
  8.  Aviso legal & uso ético
  9.  Licença


────────────────────────────────────────────────────────────────────────────────
  1. VISÃO GERAL
────────────────────────────────────────────────────────────────────────────────

  RedNest foi desenhado como uma PLATAFORMA DE INVESTIGAÇÃO, e não um "launcher"
  de ferramentas. Cada ferramenta é uma ENGINE interna que produz resultados
  ESTRUTURADOS (não texto de terminal), que viram "achados" persistidos, navegáveis
  e correlacionáveis. As engines conversam entre si por um Event Bus (Timeline) e
  alimentam um modelo de entidades único por operação (Alvos, grafo, Threat Score).

  Organização:
    • OPERAÇÃO  — o caso/investigação (status, prioridade, tags, objetivo, KPIs).
    • ENGAJAMENTO — um alvo dentro da operação (Web, Domínio, Infra, OSINT, Pessoa…),
                    com um conjunto de ferramentas adequado ao tipo.
    • ACHADOS   — tudo que as engines descobrem (subdomínios, hosts, e-mails, perfis,
                  IOCs, vazamentos, credenciais, CVEs, tecnologias, capturas…).


────────────────────────────────────────────────────────────────────────────────
  2. CAPACIDADES
────────────────────────────────────────────────────────────────────────────────

  ▸ INVESTIGAÇÃO & GESTÃO
      - Operações e engajamentos com status (em andamento / concluída / arquivada),
        prioridade, tags, KPIs e Threat Score calculado por fórmula.
      - Modelo de entidades unificado ("Alvos") + grafo de relacionamentos.
      - Timeline / Investigation Event Bus (toda ação vira evento).
      - Anotações (prioridade/status/prazo) e Evidências por operação/engajamento.
      - Relatórios e Denúncias (tracking de abuse reports: plataforma, ticket, status).

  ▸ RECON & WEB
      - Recon Pipeline: encadeia Subdomínios → HTTP Discovery → Service Scan →
        Screenshots → Correlação de CVEs, com progresso ao vivo e KPIs.
      - WordPress Engine (motor estilo WPScan, nativo): detecção+versão, usuários
        (REST/oEmbed/author brute/sitemap), plugins/temas (passivo + wordlist +
        namespaces REST), achados sensíveis (xmlrpc, debug.log, config backups,
        DB dumps…) e correlação com CVE (NVD + CISA KEV).
      - Atribuição de Domínio (WHOIS/RDAP → IP → hosting/ipinfo).
      - Subdomínios passivos, Service Scan (HTTP/TLS/SSH/FTP), Content Discovery
        (estilo Gobuster), Crawler (estilo Katana), Check-Host distribuído,
        Wayback Machine.
      - Screenshot Engine (Chromium/Playwright) com:
          · rotação por proxy (tenta o pool até capturar),
          · bypass de desafios anti-bot JS (Imunify360 / Cloudflare "Just a moment").

  ▸ OSINT DE IDENTIDADE
      - Inteligência de E-mail & Usuários (Gravatar, Hunter, holehe, Leak-Lookup,
        COMB) com consulta dinâmica em paralelo e escolha do que salvar.
      - WhatsMyName (username em ~700 sites, streaming) e Redes Sociais.
      - Pessoa (Dossiê): ficha OSINT completa — identidade, documentos, históricos
        (residencial/profissional/acadêmico), empresas, patrimônio, judicial,
        presença digital/técnica, relacionamentos, linha do tempo, mídia, resumo
        executivo — com foto, idade automática e EXPORTAÇÃO EM PDF.
      - Google Dorks.

  ▸ THREAT INTELLIGENCE & VULNS
      - IOCs (enriquecimento VirusTotal / AbuseIPDB / OTX / ThreatFox), veredito
        e correlação.
      - Threat Feeds (CISA KEV, RSS) e base NVD sincronizada (dashboard de CVEs).
      - Correlation Engine: domínio→IP→ASN→threat e tecnologia→CVE (KEV + NVD).

  ▸ MONITORAMENTO
      - Monitores de mudança de conteúdo (hash + diff + captura por execução) e
        re-checagem de IOCs, agendados (BullMQ/Redis).
      - Alertas via Telegram (mudança, falha ao capturar, recuperação).
      - Opção de monitorar via proxy (anonimiza a origem).

  ▸ PROXIES (pool global)
      - Importa/valida proxies (ProxyScrape + colagem manual + upload de arquivo),
        HTTP/SOCKS4/SOCKS5; status, latência, país e nível de anonimato.
      - Teste individual, rotação de saída nas engines e checagem geo-distribuída
        (anti-cloaking: compara a resposta do alvo por vários países).


────────────────────────────────────────────────────────────────────────────────
  3. ARQUITETURA & STACK
────────────────────────────────────────────────────────────────────────────────

    ┌───────────────┐   HTTP/SSE   ┌────────────────────┐   ┌──────────────┐
    │  Frontend      │ ───────────► │  Backend (API)     │──►│ PostgreSQL   │
    │  React + Vite  │              │  NestJS + Prisma   │   └──────────────┘
    │  Zustand       │ ◄─────────── │  Engines/Event Bus │──►│ Redis (BullMQ)│
    │  (nginx)       │              │  Playwright/Chromium│  └──────────────┘
    └───────────────┘              └────────────────────┘
                                        │  observabilidade
                                        ▼
                        Prometheus · Grafana · Tempo · Alertmanager

    Backend .... NestJS 11, Prisma 6, PostgreSQL 17, Redis + BullMQ, Playwright,
                 JWT (access+refresh), RBAC, rate-limit, OpenTelemetry.
    Frontend ... React 18, Vite, TypeScript, Zustand, ReactFlow (grafo), Recharts.
    Infra ...... Docker Compose (stack completa), nginx (SPA + proxy /api + SSE).


────────────────────────────────────────────────────────────────────────────────
  4. COMEÇANDO
────────────────────────────────────────────────────────────────────────────────

  Pré-requisitos: Docker + Docker Compose.

    1)  git clone https://github.com/wesleyruam/rednest.git
        cd rednest

    2)  # crie os arquivos de ambiente a partir dos exemplos e AJUSTE os segredos
        cp .env.example .env
        cp backend/.env.example backend/.env
        #  → troque JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INTEGRATIONS_SECRET,
        #    SEED_ADMIN_PASSWORD e (opcional) TELEGRAM_BOT_TOKEN/CHAT_ID.

    3)  docker compose up -d --build

    4)  Acesse:  http://localhost:8090
        Login inicial (seed):  admin / admin123   ←  TROQUE em produção.

  Observabilidade (opcional): Grafana em http://localhost:3001.


────────────────────────────────────────────────────────────────────────────────
  5. ESTRUTURA DO REPOSITÓRIO
────────────────────────────────────────────────────────────────────────────────

    rednest/
    ├─ src/                     Frontend (React/Vite/Zustand)
    │  ├─ components/           Painéis, operações, engajamento, layout
    │  ├─ pages/                Login, IOCs, Timeline, Vulnerabilidades, Proxies…
    │  ├─ services/             Clientes HTTP/SSE por módulo
    │  └─ store/                Estado global (Zustand)
    ├─ backend/
    │  ├─ src/                  Módulos NestJS (auth, operations, engagements,
    │  │                        findings, integrations, engines, monitoring,
    │  │                        proxy, persons, complaints, timeline, nvd…)
    │  └─ prisma/               Schema + migrações
    ├─ monitoring/             Prometheus, Grafana, Tempo, Alertmanager
    ├─ docs/screenshots/       Capturas (dados fictícios)
    ├─ docker-compose.yml      Stack completa
    ├─ nginx.conf              SPA + proxy /api + SSE
    └─ README.txt / README.md


────────────────────────────────────────────────────────────────────────────────
  6. SEGURANÇA & PRIVACIDADE
────────────────────────────────────────────────────────────────────────────────

    • Segredos NÃO são versionados: .env e backend/.env estão no .gitignore.
      Use os arquivos .env.example como template.
    • As chaves de provedores externos são guardadas cifradas (AES-256-GCM) no
      banco, usando INTEGRATIONS_SECRET.
    • Dados de investigação vivem no banco (volume do PostgreSQL), fora do repo.
    • Autenticação JWT (access curto + refresh rotacionado), RBAC (admin/analyst/
      viewer), rate-limiting e, no front, logout automático em sessão expirada.
    • Proxies públicos são para GET de recon não autenticado — nunca envie
      credenciais por eles.


────────────────────────────────────────────────────────────────────────────────
  7. SCREENSHOTS  (dados 100% fictícios)
────────────────────────────────────────────────────────────────────────────────

  Veja o manual ilustrado em README.md. Capturas (dados fictícios) em docs/screenshots/:

    01-login ........................ Tela de acesso
    02-operacao-visao-geral ......... Dashboard da operação (KPIs, mapa)
    03-operacao-alvos ............... Modelo de entidades unificado (Alvos)
    04-operacao-atividades .......... Event Viewer (Investigation Event Bus)
    05-operacao-anotacoes ........... Anotações do caso
    06-operacao-denuncias ........... Denúncias / abuse tracking
    07-wordpress-scan ............... WordPress Engine (estilo WPScan)
    08-recon-pipeline ............... Recon Pipeline (execução ao vivo)
    09-content-discovery ............ Content Discovery (estilo Gobuster)
    10-service-scan ................. Service Scan (HTTP/TLS/SSH/FTP)
    11-atribuicao-dominio ........... WHOIS/RDAP -> IP -> hosting
    12-screenshot-engine ............ Screenshot Engine (Chromium/proxy)
    13-crawler ...................... Crawler (estilo Katana)
    14-pessoa-dossie ................ Pessoa (Dossiê OSINT + PDF)
    15-email-intel-consult .......... Inteligência de E-mail (consulta ao vivo)
    16-username-search .............. Username Search (~700 sites, SSE)
    17-google-dorks ................. Google Dorks
    18-proxies ...................... Pool de Proxies (validação/rotação/geo)
    19-vulnerabilidades ............. Vulnerabilidades (NVD)
    20-threat-feeds ................. Threat Feeds (CISA KEV / RSS)


────────────────────────────────────────────────────────────────────────────────
  8. AVISO LEGAL & USO ÉTICO
────────────────────────────────────────────────────────────────────────────────

  Esta plataforma foi construída para investigações AUTORIZADAS, resposta a
  incidentes, threat intelligence defensivo, pesquisa de segurança e educação.

  Você é o único responsável por como a utiliza. Só investigue/consulte alvos
  para os quais tenha autorização legal. Respeite as leis aplicáveis (incluindo
  LGPD/GDPR), os termos de serviço das fontes e os direitos de terceiros. Os
  autores não se responsabilizam por uso indevido.

  NÃO use para assédio, perseguição (stalking), doxxing, acesso não autorizado,
  ataques ou qualquer atividade ilegal.


────────────────────────────────────────────────────────────────────────────────
  9. LICENÇA
────────────────────────────────────────────────────────────────────────────────

  Definir pelo autor (ex.: MIT). Enquanto não houver arquivo LICENSE, todos os
  direitos reservados ao proprietário do repositório.

  ── RedNest · OSINT & CTI Platform ────────────────────────────────────────────
