# Phenix

Bot Discord multi-serveurs avec un panel web de configuration.

- **Bot** : niveaux / XP, modération, giveaways, tickets, événements The Division 2 (raids et incursions)
- **Panel** : connexion Discord, configuration de chaque serveur, journal des modifications
- **Télémétrie** : statistiques journalières par serveur, métriques des services, journal des erreurs

## Architecture

```
apps/
  bot/        discord.js : événements, commandes, tâches planifiées (BullMQ)
  api/        NestJS : OAuth2 Discord, sessions, configuration des serveurs
  web/        Next.js : le panel, qui appelle l'API côté serveur
packages/
  database/   schéma Prisma (MySQL), migrations et client généré
  shared/     constantes, types et schémas Zod communs aux trois apps
docker/       Compose de dev (infrastructure seule) et de prod (tout)
```

Services utilisés :

| Service   | Rôle                                                                 |
| --------- | -------------------------------------------------------------------- |
| MySQL     | Source de vérité                                                     |
| Redis     | Sessions, caches, compteurs du jour, pub/sub et files BullMQ         |
| SeaweedFS | Stockage S3 des fichiers (transcripts de tickets, images du panel)   |

Le schéma (`packages/database/prisma/schema.prisma`) documente en tête ses conventions et ce qui vit dans Redis.

## Développement

Prérequis : Node 24, pnpm 12 (`corepack enable`), Docker.

```bash
pnpm install
cp .env.example .env      # puis remplir les valeurs Discord et TOKEN_ENCRYPTION_KEY
pnpm infra:up             # MySQL, Redis et SeaweedFS
pnpm db:migrate           # applique les migrations
pnpm --filter @phenix/bot commands:deploy   # publie les commandes slash sur DISCORD_DEV_GUILD_ID
pnpm dev                  # bot, API (:3001) et panel (:3000) en parallèle
```

Dans l'application Discord, ajoutez la redirection OAuth2 `http://localhost:3000/api/auth/callback`.
En dev, le panel relaie `/api/*` vers l'API, si bien que le navigateur ne voit qu'une seule origine.

| Commande          | Effet                                       |
| ----------------- | ------------------------------------------- |
| `pnpm test`       | Tests Vitest de tous les packages           |
| `pnpm typecheck`  | Vérification des types                      |
| `pnpm lint`       | Lint                                        |
| `pnpm build`      | Build complet                               |
| `pnpm db:studio`  | Prisma Studio                               |
| `pnpm infra:down` | Arrête l'infrastructure (garde les volumes) |

## Production

```bash
cp .env.production.example .env.production    # puis remplir les valeurs
# docker/seaweedfs/s3.prod.json : mêmes identifiants que S3_ACCESS_KEY / S3_SECRET_KEY (format de s3.json)
docker compose --env-file .env.production -f docker/compose.prod.yml up -d --build
```

Le service `migrate` applique les migrations avant le démarrage du bot et de l'API.
L'API et le panel n'écoutent que sur `127.0.0.1`, derrière Nginx Proxy Manager :

- `/` vers le panel, `127.0.0.1:3000`
- `/api/` vers l'API, `127.0.0.1:3001`, **sans le préfixe `/api`**. Par exemple dans l'onglet *Advanced* de l'hôte :

  ```nginx
  location /api/ {
      proxy_pass http://127.0.0.1:3001/;   # la barre finale retire le préfixe /api
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

Dans l'application Discord de prod, ajoutez la redirection `WEB_ORIGIN/api/auth/callback`.
