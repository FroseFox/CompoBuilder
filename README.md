# Comp Builder — Outil de préparation Valorant pour équipe e-sport

Application web collaborative pour préparer les matchs d'une équipe
Valorant : composer, suivre et documenter les compositions d'agents pour
chaque map, avec joueurs assignés, statut de préparation et notes de
stratégie — **partagées en temps réel entre tous les membres de l'équipe**.

Les données de jeu (maps, agents, rôles, images) viennent de l'API publique
[valorant-api.com](https://valorant-api.com). Les compositions, l'effectif
et les comptes utilisateurs sont stockés dans une base de données
[Supabase](https://supabase.com).

> Projet réalisé à des fins scolaires / personnelles, à l'usage interne
> d'une équipe.

## ⚡ Première installation : connecter Supabase

Ce projet nécessite un projet Supabase (gratuit) pour fonctionner. Si ce
n'est pas déjà fait, suivez **[GUIDE_SUPABASE.md](./GUIDE_SUPABASE.md)** —
un guide pas-à-pas pensé pour les débutants complets (création du compte,
des tables, du compte administrateur, etc.). Ça prend environ 20 minutes,
une seule fois.

## Stack technique

- **React 18** + **Vite**
- **Supabase** (base de données Postgres, authentification, temps réel)
- **React Router** (`HashRouter`, compatible GitHub Pages sans configuration)
- **Framer Motion** pour les animations
- **CSS moderne** (variables CSS, `color-mix`, glassmorphism)

## Démarrage

```bash
# 1. Suivre GUIDE_SUPABASE.md pour créer le fichier .env (voir .env.example)
npm install
npm run dev
```

## Build de production

```bash
npm run build
npm run preview
```

## Déploiement sur GitHub Pages

Deux façons de déployer :

### Automatique (recommandé) — GitHub Actions

Un workflow (`.github/workflows/deploy.yml`) build et publie automatiquement
le site à chaque `git push` sur `main`. À configurer une seule fois :

1. Sur GitHub : **Settings > Pages > Build and deployment > Source**,
   choisir **GitHub Actions** (au lieu de "Deploy from a branch").
2. Toujours sur GitHub : **Settings > Secrets and variables > Actions >
   New repository secret**, créer `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` avec les mêmes valeurs que dans votre `.env`
   local (voir GUIDE_SUPABASE.md, étape 3).
3. `git push` sur `main` : direction l'onglet **Actions** du dépôt pour
   suivre le déploiement (1-2 minutes).

Avec cette méthode, plus besoin d'avoir `.env` sur la machine qui déploie —
seul le dépôt GitHub compte.

### Manuel — depuis votre machine

```bash
npm run deploy
```

Le fichier `.env` doit être présent sur la machine qui exécute cette
commande (il n'est jamais poussé sur GitHub — voir `.gitignore`). Détails
dans GUIDE_SUPABASE.md, étape 8. Publie directement sur la branche
`gh-pages` sans passer par GitHub Actions — pratique en dépannage, mais à
éviter en usage courant si le déploiement automatique est configuré (les
deux méthodes ne se synchronisent pas entre elles).

## Qualité de code

```bash
npm run lint
```

Vérifie le code avec ESLint (erreurs React/hooks courantes). Aucune
correction automatique n'est appliquée ; à lancer avant de commit.

## Comptes et droits

Une seule façon de se connecter : **Discord** (OAuth, via Supabase Auth).
Il n'y a plus de formulaire email/mot de passe.

- **Se connecter avec Discord crée l'effectif lui-même** : à la première
  connexion, une fiche joueur est automatiquement créée (pseudo repris de
  Discord) et reliée à ce compte — voir le trigger `handle_new_user()`
  dans `supabase/schema.sql`. Rien à "associer" à la main dans le cas
  normal ; ce joueur ne peut cocher que ses propres disponibilités.
- **Administrateur** : n'importe quel compte Discord, marqué
  `is_admin = true` dans la table `profiles` (toujours réglé à la main
  dans le dashboard Supabase — voir l'étape 4 en bas de `schema.sql`).
  Peut tout créer/modifier/supprimer, et cocher les disponibilités de
  n'importe quel joueur.
- **Retirer quelqu'un de l'effectif** (bouton "Supprimer" sur la page
  Équipe, réservé aux admins) : pour une fiche reliée à un compte Discord,
  ce bouton bannit aussi son `discord_id` (RPC `ban_and_remove_player()`).
  C'est nécessaire car **supprimer un compte Supabase ne révoque pas
  l'autorisation OAuth Discord** — sans ce bannissement, la personne
  pourrait se reconnecter et se voir recréer une fiche automatiquement.
  Pour une fiche créée à la main (jamais reliée à un compte, affichée
  "Sans compte Discord"), un simple retrait suffit.
- **Fiche "orpheline" après migration** : une fiche créée avant l'ajout de
  la connexion Discord n'a pas de `discord_id`. Si son joueur se
  connecte, une fiche séparée sera créée pour lui (rien ne permet de
  deviner que c'est la même personne) — supprimez alors le doublon, ou
  collez son `discord_id` à la main sur l'ancienne fiche. Le bouton
  "Associer" resté sur la page Disponibilités (fonction `claim_player()`)
  couvre ce cas de repli.
- **Visiteurs sans compte** : consultent tout le site (compositions,
  effectif, disponibilités…) en temps réel, en lecture seule.

## Architecture

```
src/
  components/
    Navbar/                  # nav, recherche globale, thème, connexion admin
    AuthPanel/                # bouton "Connexion Discord" / statut connecté
    MapCard/                 # carte de map (accueil) : statut, joueurs, date
    AgentSlot/                # un emplacement de composition (lecture ou édition)
    AgentSelectionModal/      # sélection d'agent : recherche, filtre rôle, tri
    CompositionTabs/          # onglets multi-compositions par map
    StatusBadge/              # pastille de statut + sélecteur segmenté
    PlayerAvatar/, PlayerSelect/  # avatar coloré et sélecteur de joueur
    RoleBadge/, RoleStats/    # badges et répartition des rôles
    NotesEditor/              # notes en autosave (debounce)
    FilterBar/                # recherche, filtres, tri (page d'accueil)
    ProgressBar/               # barre de progression réutilisable
    GlobalSearch/              # recherche globale (maps / joueurs / agents), ⌘K
    Loader/, Skeleton/, Toast/, ConfirmDialog/  # UI utilitaire
  pages/
    Home/                     # accueil : grille de maps, filtres, tri
    Editor/                   # éditeur : compositions, statut, notes, joueurs
    Team/                     # gestion de l'effectif
    Dashboard/                # statistiques globales de préparation
    Availability/              # grille de disponibilités des joueurs
  context/
    ThemeContext.jsx           # thème clair/sombre (local au navigateur)
    AuthContext.jsx             # session Supabase + statut administrateur
    DataContext.jsx             # données API Valorant (maps, agents)
    CompositionsContext.jsx    # compositions : lecture, écriture, temps réel (Supabase)
    PlayersContext.jsx         # effectif : lecture, écriture, temps réel (Supabase)
    AvailabilityContext.jsx    # disponibilités : lecture, écriture, temps réel (Supabase)
    ToastContext.jsx           # notifications
  services/
    valorantApi.js             # appels à valorant-api.com
    supabaseClient.js           # connexion au projet Supabase
    db.js                       # toutes les requêtes Supabase, avec mapping de format
  hooks/
    useGameDataSync.js          # synchronise maps/agents vers Supabase (admin uniquement)
  utils/
    storage.js                  # constantes (statuts, couleurs) et formes par défaut
    compositions.js              # fonctions dérivées (stats, tri, formatage date)
  styles/
    variables.css, global.css
supabase/
  schema.sql                    # script SQL complet (tables, sécurité, temps réel)
```

## Modèle de données (Supabase)

| Table | Rôle |
|---|---|
| `maps` | Référence des maps (uuid, nom) — synchronisée automatiquement depuis valorant-api.com |
| `agents` | Référence des agents (uuid, nom, rôle) — synchronisée automatiquement |
| `players` | Effectif de l'équipe (pseudo, rôle principal/secondaire, couleur, compte et `discord_id` reliés) |
| `compositions` | Une composition = map associée, nom, 5 emplacements (`slots` : agent + joueur assigné), statut, notes, date de dernière modification |
| `player_availability` | Créneaux (date réelle × période) où un joueur s'est déclaré disponible — un joueur ne peut cocher que sa propre ligne, via le compte associé à sa fiche (`players.user_id`, voir Sécurité) |
| `profiles` | Un compte utilisateur = administrateur ou lecture seule |
| `banned_discord_ids` | Identifiants Discord bannis (retirés de l'effectif) — empêche une fiche joueur de se recréer toute seule à la reconnexion |

Chaque map peut avoir **plusieurs compositions** (principale, anti-rush,
eco, double initiateur…). Une seule peut être marquée comme **principale**
(⭐) — c'est elle qui est résumée sur la page d'accueil.

Voir `supabase/schema.sql` pour le détail exact des colonnes et des règles
de sécurité (Row Level Security).

## Sécurité

La clé Supabase utilisée côté client (`anon public`) est conçue pour être
publique. La protection des données repose sur les policies **Row Level
Security** définies dans `supabase/schema.sql` : lecture ouverte à tous,
écriture réservée aux comptes marqués administrateur. Voir
GUIDE_SUPABASE.md, section "Pourquoi c'est sans danger", pour le détail.

**Exception : `player_availability`.** Contrairement à toutes les autres
tables, l'écriture (ajout/suppression d'un créneau) n'est réservée ni à
tout le monde ni aux seuls comptes admin — chaque compte joueur ne peut
écrire que sur la ligne du joueur auquel il est associé (`players.user_id`),
plus les admins qui gardent la main pour dépanner un joueur qui n'a pas
encore de compte. `team_settings` reste l'exception inverse (lecture *et*
écriture réservées aux admins, pour protéger le webhook Discord).

**Comment `players.user_id` se remplit.** Deux fonctions Postgres
`SECURITY DEFINER` (contournent les policies RLS, mais font elles-mêmes
toute la vérification) :
- `handle_new_user()` : trigger sur chaque nouvelle connexion. Pour une
  connexion Discord, crée automatiquement la fiche joueur (ou la relie si
  une fiche portant déjà ce `discord_id` existe), sauf si ce `discord_id`
  est dans `banned_discord_ids`.
- `claim_player()` : cas de repli pour une fiche créée avant l'ajout de la
  connexion Discord (donc sans `discord_id`) — vérifie qu'on ne s'associe
  qu'à une fiche pas encore prise, jamais à la place de quelqu'un d'autre.

**Pourquoi `banned_discord_ids` existe.** Supprimer un compte Supabase ne
révoque pas l'autorisation OAuth Discord sous-jacente : la personne peut
se reconnecter instantanément et obtenir un nouveau compte, qui recréerait
sa fiche joueur toute seule. `public.ban_and_remove_player()` (appelée par
le bouton "Supprimer" sur la page Équipe pour une fiche reliée à Discord)
retire la fiche ET enregistre son `discord_id` dans cette liste, que
`handle_new_user()` consulte avant de recréer quoi que ce soit.

Compléments :
- **Content-Security-Policy** : injectée automatiquement dans le HTML du
  build de production (voir `vite.config.js`), jamais en développement.
  Elle limite les scripts/styles/images/connexions aux origines
  strictement nécessaires (l'app elle-même, Google Fonts, Supabase,
  valorant-api.com). GitHub Pages ne permettant pas d'envoyer de vrais
  en-têtes HTTP, elle passe par une balise `<meta>` — ce qui ne couvre pas
  la protection anti-clickjacking (`frame-ancestors`, ignorée par les
  navigateurs dans une balise meta). Pour ça, il faudrait héberger sur un
  service qui permet de définir des en-têtes (Cloudflare Pages, Netlify…).
- **Dépendances** : `npm audit` signale une alerte modérée sur
  `react-router-dom` (redirection externe via une navigation forgée), sans
  correctif disponible en version 6.x — seule la version 7 (changement
  majeur) la corrige entièrement. Ce n'est exploitable que si un chemin de
  navigation est construit à partir d'un contenu non fiable (saisie libre
  d'un utilisateur, paramètre d'URL…) ; ce n'est le cas nulle part dans
  cette app (les navigations utilisent uniquement des UUID de maps/matchs
  contrôlés par l'admin). Risque jugé négligeable ici, mais à garder en
  tête si le routing évolue — voir `npm audit` pour le détail.

## Fonctionnalités

**Page d'accueil**
- Filtres : toutes les maps / avec composition / sans composition
- Recherche par nom de map, tri (alphabétique, récent, terminées/non
  terminées en premier)
- Chaque carte affiche : agents remplis, statut, joueurs assignés
  (avatars), date de dernière modification

**Éditeur de map**
- Onglets pour gérer plusieurs compositions par map (admin : créer,
  renommer, dupliquer, supprimer, définir comme principale)
- 5 emplacements par composition avec sélection d'agent (recherche, filtre
  par rôle, tri), glisser-déposer pour réorganiser, assignation d'un joueur
- Statut de préparation (À faire / En test / Validée / À retravailler)
- Notes de stratégie en sauvegarde automatique
- Visiteurs non-admin : tout est visible, rien n'est modifiable

**Page Équipe**
- Ajout, modification, suppression de joueurs (admin uniquement)
- Rôle principal, rôle secondaire, couleur d'identification

**Dashboard**
- Nombre total de maps, de compositions créées
- Répartition par statut, barre de progression globale
- Listes rapides des maps à retravailler, en test, ou sans composition

**Match Center**
- Historique des matchs joués : adversaire, map, composition utilisée,
  score, date, notes (admin : créer/modifier/supprimer)
- Résultat (victoire/défaite/nul) calculé automatiquement depuis le score

**Statistiques**
- Bilan global (victoires/défaites), forme récente
- Performance par map, par composition et par adversaire
- Statistiques par joueur, déduites des compositions utilisées en match

**Disponibilités**
- Calendrier réel (semaine navigable, précédente/suivante), pas des jours
  de semaine récurrents : chaque case correspond à une vraie date
  (Matin/Après-midi/Soir), et les jours où un match est déjà programmé
  (Match Center) sont signalés directement sur la grille
- Connexion Discord : la fiche joueur se crée (ou se relie) automatiquement
  à la première connexion, sans étape manuelle ; chacun ne peut cocher que
  ses propres créneaux, un admin peut cocher pour n'importe qui
- Chaque case affiche le nombre et les avatars des joueurs disponibles à ce
  créneau ; le créneau où le plus de monde est disponible cette semaine est
  mis en évidence automatiquement
- Synchronisé en temps réel comme le reste du site (Supabase Realtime)

**Recherche globale (⌘K)**
- Recherche unifiée sur les maps, les joueurs et les agents
- Cliquer sur un résultat ouvre directement la bonne map et composition

**Général**
- Toutes les modifications sont synchronisées **en temps réel** pour tous
  les utilisateurs connectés au site (Supabase Realtime)
- Thème clair / sombre (préférence locale au navigateur)
- Entièrement responsive (mobile, tablette, desktop)

## Fonctionnalités volontairement retirées

Sur demande, l'export JSON, l'import JSON et le bouton « copier la
composition » ont été supprimés pour recentrer l'outil sur l'usage
quotidien de l'équipe.

Nettoyage additionnel : une ancienne page de détail de match
(`MatchDetail`, avec gestion multi-maps et format BO1/BO3/BO5) a été
supprimée — elle datait d'avant la simplification du Match Center
(migration 003) et n'était plus reliée à aucune route ni à aucune donnée
existante. Un premier système de suivi de matchs plus ancien
(`MatchResultsContext`), jamais branché à l'app, a été supprimé pour la
même raison. Les colonnes `opponent_logo_url` et `position` ajoutées par
`migration_004` ne sont donc plus utilisées par aucune page ; elles n'ont
pas été retirées de la base (aucune migration destructive n'a été
exécutée automatiquement) mais peuvent être ignorées ou nettoyées
manuellement si besoin.

## Notes sur les APIs

- `valorant-api.com` : API publique, gratuite, sans authentification, pour
  les maps/agents/rôles/images (source de vérité affichée dans l'app).
- Supabase : base de données Postgres avec authentification et
  synchronisation temps réel, pour les compositions, l'effectif et les
  comptes utilisateurs.

## Performance

- Les listes dérivées (résumés de maps, statistiques du dashboard) sont
  calculées avec `useMemo`.
- Les notes utilisent une sauvegarde différée (debounce ~7600 ms).
- Les tables `maps`/`agents` ne sont resynchronisées vers Supabase qu'une
  fois par session admin (pas à chaque rendu).
- Les images bénéficient du chargement différé (`loading="lazy"`) et du
  cache HTTP natif du navigateur.
- Chaque page est chargée à la demande (`React.lazy`) plutôt que dans un
  seul gros bundle : le chargement initial ne télécharge que la page
  demandée. Les dépendances lourdes (React, Framer Motion, Supabase) sont
  dans des chunks séparés, mis en cache indépendamment du code de l'app.

## Accessibilité

- Focus clavier toujours visible (`:focus-visible`), jamais masqué.
- Le réglage système « Réduire les animations » est respecté partout,
  y compris pour les animations pilotées en JS (Framer Motion, via
  `MotionConfig reducedMotion="user"` dans `App.jsx`) et pas seulement
  pour les transitions CSS.
- Toute URL non reconnue redirige vers l'accueil au lieu d'afficher une
  page blanche.
