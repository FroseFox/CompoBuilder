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

```bash
npm run deploy
```

Le fichier `.env` doit être présent sur la machine qui exécute cette
commande (il n'est jamais poussé sur GitHub — voir `.gitignore`). Détails
dans GUIDE_SUPABASE.md, étape 8.

## Comptes et droits

- **Administrateur** : un compte email/mot de passe créé dans Supabase
  (Authentication > Users), marqué `is_admin = true` dans la table
  `profiles`. Peut tout créer/modifier/supprimer. Se connecte via le bouton
  **Connexion admin** dans la barre du haut.
- **Membres de l'équipe** : aucun compte nécessaire. Ils ouvrent le site et
  consultent les compositions, en temps réel, en lecture seule.

## Architecture

```
src/
  components/
    Navbar/                  # nav, recherche globale, thème, connexion admin
    AuthPanel/                # modal de connexion administrateur
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
  context/
    ThemeContext.jsx           # thème clair/sombre (local au navigateur)
    AuthContext.jsx             # session Supabase + statut administrateur
    DataContext.jsx             # données API Valorant (maps, agents)
    CompositionsContext.jsx    # compositions : lecture, écriture, temps réel (Supabase)
    PlayersContext.jsx         # effectif : lecture, écriture, temps réel (Supabase)
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
| `players` | Effectif de l'équipe (pseudo, rôle principal/secondaire, couleur) |
| `compositions` | Une composition = map associée, nom, 5 emplacements (`slots` : agent + joueur assigné), statut, notes, date de dernière modification |
| `profiles` | Un compte utilisateur = administrateur ou lecture seule |

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
- Statut de préparation (Validée / En test / À retravailler)
- Notes de stratégie en sauvegarde automatique
- Visiteurs non-admin : tout est visible, rien n'est modifiable

**Page Équipe**
- Ajout, modification, suppression de joueurs (admin uniquement)
- Rôle principal, rôle secondaire, couleur d'identification

**Dashboard**
- Nombre total de maps, de compositions créées
- Répartition par statut, barre de progression globale
- Listes rapides des maps à retravailler, en test, ou sans composition

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

## Notes sur les APIs

- `valorant-api.com` : API publique, gratuite, sans authentification, pour
  les maps/agents/rôles/images (source de vérité affichée dans l'app).
- Supabase : base de données Postgres avec authentification et
  synchronisation temps réel, pour les compositions, l'effectif et les
  comptes utilisateurs.

## Performance

- Les listes dérivées (résumés de maps, statistiques du dashboard) sont
  calculées avec `useMemo`.
- Les notes utilisent une sauvegarde différée (debounce ~600 ms).
- Les tables `maps`/`agents` ne sont resynchronisées vers Supabase qu'une
  fois par session admin (pas à chaque rendu).
- Les images bénéficient du chargement différé (`loading="lazy"`) et du
  cache HTTP natif du navigateur.
