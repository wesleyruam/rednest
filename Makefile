# RedNest V2 — atalhos de operação local
# Uso: make <alvo>   (ex.: make up, make logs, make seed)

COMPOSE       = docker compose
DEV           = docker compose -f docker-compose.yml -f docker-compose.dev.yml
BACKEND       = $(COMPOSE) exec backend
BACKEND_DIR   = backend

.DEFAULT_GOAL := help

.PHONY: help up up-build down down-v restart ps logs logs-api \
        dev dev-web seed reset keys-import migrate sh-api urls

help: ## Lista os alvos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Sobe toda a stack (sem rebuild)
	$(COMPOSE) up -d

up-build: ## Sobe toda a stack reconstruindo as imagens
	$(COMPOSE) up -d --build

down: ## Para a stack (mantém os volumes/dados)
	$(COMPOSE) down

down-v: ## Para a stack e APAGA os volumes (zera o banco)
	$(COMPOSE) down -v

restart: ## Reinicia toda a stack
	$(COMPOSE) restart

ps: ## Status dos containers
	$(COMPOSE) ps

logs: ## Logs de todos os serviços (follow)
	$(COMPOSE) logs -f

logs-api: ## Logs só do backend (follow)
	$(COMPOSE) logs -f backend

dev: ## Sobe a stack com o backend em hot-reload (nest --watch)
	$(DEV) up -d --build
	@echo "Backend em hot-reload. Para o front em dev:  make dev-web"

dev-web: ## Roda o frontend em dev (Vite :5173, proxy /api → :3333)
	npm run dev

migrate: ## Aplica migrações pendentes no banco
	cd $(BACKEND_DIR) && npm run prisma:deploy

seed: ## Limpa dados de domínio e recria os usuários (preserva provider_keys)
	cd $(BACKEND_DIR) && npm run db:seed

reset: ## Reset total do banco (migrações + seed)
	cd $(BACKEND_DIR) && npm run db:reset

keys-import: ## Importa as chaves de provedores de ~/.rednest/apikeys.json
	cd $(BACKEND_DIR) && npm run keys:import

sh-api: ## Abre um shell no container do backend
	$(BACKEND) sh

urls: ## Mostra as URLs dos serviços
	@echo "App:          http://localhost:8090  (admin/admin123)"
	@echo "API/Swagger:  http://localhost:3333/api/docs"
	@echo "Grafana:      http://localhost:3001  (admin/admin)"
	@echo "Prometheus:   http://localhost:9090"
	@echo "Tempo:        http://localhost:3200"
	@echo "Alertmanager: http://localhost:9093"
