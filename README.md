# Revenu Universel — jeu pédagogique multijoueur

Application web pour animer une simulation en trois manches devant un groupe (environ 10 à 100 téléphones).

Elle fait discuter :

1. les choix individuels une fois un revenu reçu ;
2. l'effet d'une hausse des prix sur le pouvoir d'achat ;
3. le financement d'un revenu universel, sans désigner une « bonne » réponse.

## Démarrage rapide (mode démonstration)

Aucune clé externe n'est requise.

```bash
npm install
npm test
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

- `/host` : créer une salle, QR code, contrôle des manches
- `/join` : rejoindre avec un code
- `/play/[code]` : interface participant
- `/screen/[code]` : projection

Un badge **Démonstration locale** s'affiche tant que Supabase n'est pas configuré. Dans ce mode, l'état est stocké dans le navigateur (`localStorage` + `BroadcastChannel`). Plusieurs onglets du **même** navigateur se mettent à jour. **Les téléphones distincts ne sont pas synchronisés.**

Depuis l'espace animateur, vous pouvez ajouter des participants fictifs, simuler leurs choix et leurs votes, puis parcourir les trois manches.

## Règles implémentées

- Solde initial : **5** jetons (entiers uniquement).
- Manche 1 (2 min, horodatage `round_ends_at`) :
  - Travail : +3 → 8
  - Temps libre : 5
  - Formation : −2 → 3, puis bonus unique +6 en manche 2
- Manche 2 : repas à 6 jetons, jamais de solde négatif.
- Manche 3 : un vote par personne ; résultats masqués jusqu'à révélation par l'animateur.
- La manche 3 est bloquée tant que la manche 2 n'est pas terminée.
- Jeton animateur distinct du code de salle.

## Configurer Supabase (synchronisation multi-appareils)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Copiez `.env.example` vers `.env.local` et renseignez :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
3. Dans l'éditeur SQL, exécutez `supabase/migrations/001_init.sql`.
4. Activez Realtime sur les tables `rooms`, `participants`, `decisions`, `transactions`, `votes` si la publication n'a pas été mise à jour.
5. Relancez `npm run dev`.

Les opérations sensibles (soldes, manches, votes) passent par `/api/rooms/...` avec la clé `service_role`. Le navigateur n'utilise que la clé anon. Les politiques RLS interdisent les écritures directes depuis le client.

Le jeton animateur est hashé en base. Connaître le code de salle ne donne pas les droits d'administration.

## Déploiement

Variables d'environnement à définir sur l'hébergeur (Vercel, etc.) : les trois clés ci-dessus. Déployez ensuite le build Next.js :

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

Les tests couvrent les soldes, l'unicité du bonus formation, le refus de paiement, la clôture des choix, le vote unique, l'ordre des manches et les doubles soumissions.

## Stack

Next.js (App Router), TypeScript strict, Tailwind CSS, Zod, Lucide, Framer Motion, Supabase (optionnel).
