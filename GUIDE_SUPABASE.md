# Guide : connecter le projet à Supabase (pour débutant complet)

Ce guide explique, étape par étape, comment brancher l'application sur une
vraie base de données en ligne (Supabase), pour que toute votre équipe voie
les mêmes compositions. Aucune connaissance préalable de Supabase ou de SQL
n'est nécessaire : vous pouvez copier-coller chaque bloc tel quel.

Comptez environ **20 à 30 minutes** la première fois.

---

## Ce qui va changer concrètement

- Avant : chaque personne avait ses propres compositions, stockées dans son
  navigateur (`localStorage`).
- Après : toutes les compositions sont stockées sur un serveur Supabase.
  Tout le monde voit les mêmes données, mises à jour **en temps réel**.
- Un compte **administrateur** peut créer/modifier/supprimer. Les autres
  membres de l'équipe consultent le site normalement, **sans avoir besoin de
  créer de compte** — ils voient tout, mais ne peuvent rien modifier.

---

## Étape 1 — Créer un compte Supabase et un projet

1. Allez sur [supabase.com](https://supabase.com) et cliquez sur **Start your project**.
2. Créez un compte (avec GitHub, c'est le plus rapide).
3. Cliquez sur **New project**.
4. Donnez-lui un nom (ex. `valorant-comp-builder`).
5. Choisissez un mot de passe pour la base de données et **notez-le
   quelque part** (vous n'en aurez normalement pas besoin au quotidien, mais
   gardez-le de côté).
6. Choisissez une région proche de vous ou de votre équipe (ex. `eu-central`
   pour l'Europe).
7. Cliquez sur **Create new project** et patientez 1 à 2 minutes pendant
   que Supabase prépare votre base de données.

---

## Étape 2 — Créer les tables (copier-coller un script SQL)

1. Dans le menu de gauche de votre projet Supabase, cliquez sur **SQL Editor**.
2. Cliquez sur **New query**.
3. Ouvrez le fichier **`supabase/schema.sql`** fourni dans le projet, copiez
   **tout son contenu**, et collez-le dans l'éditeur SQL de Supabase.
4. Cliquez sur **Run** (ou `Ctrl/Cmd + Entrée`).
5. Vous devriez voir un message de succès (`Success. No rows returned`).

Ce script crée automatiquement :
- la table `maps` (les maps Valorant)
- la table `agents` (les agents Valorant)
- la table `players` (votre effectif)
- la table `compositions` (vos compositions, avec les 5 agents, les joueurs
  assignés, le statut, les notes et la date de modification)
- la table `profiles` (qui sert uniquement à savoir qui est administrateur)
- toutes les règles de sécurité nécessaires (voir Étape 6)

Vous pouvez vérifier que tout a été créé en allant dans **Table Editor**
(menu de gauche) : vous devriez voir les 5 tables listées.

---

## Étape 3 — Récupérer vos clés d'API

1. Dans le menu de gauche, cliquez sur l'icône d'engrenage **Project Settings**.
2. Cliquez sur **API** dans le sous-menu.
3. Vous verrez deux informations à copier :
   - **Project URL** (ressemble à `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** (une longue clé qui commence par `eyJ...`)

Gardez cet onglet ouvert, vous allez en avoir besoin juste après.

> **Ces deux valeurs sont faites pour être publiques.** Elles vont se
> retrouver dans le code JavaScript envoyé au navigateur de vos joueurs — et
> c'est normal, ce n'est pas une fuite de sécurité. Voir la section
> "Pourquoi c'est sans danger" plus bas.

---

## Étape 4 — Configurer le projet en local

1. À la racine du projet, dupliquez le fichier `.env.example` et renommez la
   copie en `.env` (sans `.example`).
2. Ouvrez `.env` et remplacez les deux valeurs :

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ....................................
```

3. Installez les dépendances si ce n'est pas déjà fait, puis lancez le
   site :

```bash
npm install
npm run dev
```

4. Ouvrez `http://localhost:5173`. Si tout est correct, le site se charge
   normalement (les maps s'affichent). Si vous voyez un écran
   "Configuration Supabase manquante", vérifiez que le fichier s'appelle
   bien `.env` (pas `.env.example`) et qu'il est à la racine du projet.

---

## Étape 5 — Créer votre compte administrateur

1. Dans Supabase, allez dans **Authentication** (menu de gauche) > **Users**.
2. Cliquez sur **Add user** > **Create new user**.
3. Renseignez un email (peut être fictif, ex. `admin@monequipe.gg`) et un
   mot de passe. Décochez "Auto Confirm User" s'il est proposé, ou laissez
   coché pour ne pas avoir à confirmer par email — le plus simple pour
   débuter est de **laisser "Auto Confirm User" coché**.
4. Cliquez sur **Create user**.
5. Cliquez sur l'utilisateur que vous venez de créer pour voir sa fiche, et
   copiez son **UID** (un identifiant du type `3f2a1b4c-....`).

---

## Étape 6 — Activer les droits administrateur

1. Retournez dans **SQL Editor** > **New query**.
2. Collez cette ligne, en remplaçant `VOTRE_UID` par l'UID copié à
   l'étape précédente :

```sql
update public.profiles set is_admin = true where id = 'VOTRE_UID';
```

3. Cliquez sur **Run**.

C'est fait : ce compte peut désormais créer et modifier des compositions.
Tous les autres comptes (ou aucun compte du tout, pour un simple visiteur)
resteront en lecture seule.

---

## Étape 7 — Se connecter dans l'application

1. Retournez sur le site (`npm run dev` si ce n'est pas déjà lancé).
2. En haut à droite, cliquez sur **Connexion admin**.
3. Entrez l'email et le mot de passe créés à l'étape 5.
4. Vous devriez voir un badge **● Admin** apparaître, et tous les boutons
   d'édition (ajouter un agent, créer une composition, ajouter un joueur…)
   deviennent visibles.

**Astuce :** la toute première fois que vous vous connectez en admin,
patientez quelques secondes avant de créer votre première composition : le
site synchronise en arrière-plan la liste des maps et agents (depuis
valorant-api.com) vers vos tables Supabase. Un message d'erreur "Impossible
de créer la composition" à la toute première tentative signifie
généralement qu'il faut juste patienter et réessayer.

Les autres membres de votre équipe n'ont besoin de rien faire de spécial :
ils ouvrent simplement le lien du site et voient déjà tout, en lecture
seule, sans avoir de compte.

---

## Étape 8 — Déployer sur GitHub Pages

Le fichier `.env` n'est **jamais envoyé sur GitHub** (il est ignoré via
`.gitignore`), donc pas de risque de le publier par erreur. En revanche, il
doit être présent **sur votre ordinateur** au moment où vous construisez le
site, car c'est à ce moment que ses valeurs sont intégrées au code.

```bash
npm run deploy
```

Ce script (déjà configuré) construit le site avec vos valeurs Supabase puis
le publie sur la branche `gh-pages` de votre dépôt. Tant que vous lancez
cette commande depuis un poste où `.env` existe, tout fonctionne. Si un
autre membre de l'équipe doit déployer depuis son propre ordinateur, il doit
d'abord refaire l'étape 4 (créer son propre `.env` avec les mêmes valeurs).

---

## Pourquoi c'est sans danger (sécurité)

C'est la question la plus naturelle à se poser : si l'URL et la clé
Supabase sont visibles dans le code du site, n'importe qui pourrait-il
modifier vos données ?

**Non**, grâce à un mécanisme appelé **Row Level Security (RLS)**, activé
par le script SQL de l'étape 2 :

- La clé **anon public** ne donne accès qu'à ce que les règles de sécurité
  autorisent explicitement — jamais un accès total à la base.
- Les règles créées disent : *"tout le monde peut lire, mais seule une
  personne dont le compte est marqué `is_admin = true` peut écrire"*.
- Cette vérification se fait **sur le serveur Supabase**, pas dans le
  navigateur : même quelqu'un qui lirait le code source du site ne pourrait
  pas modifier une composition sans se connecter avec un compte admin
  valide.

C'est exactement le modèle de sécurité que Supabase recommande pour ce type
d'application, et il est utilisé par de nombreux sites en production.

---

## Résumé des tables créées

| Table | Contenu |
|---|---|
| `maps` | Référence des maps (uuid, nom) — synchronisée automatiquement |
| `agents` | Référence des agents (uuid, nom, rôle) — synchronisée automatiquement |
| `players` | Votre effectif (pseudo, rôle principal/secondaire, couleur) |
| `compositions` | Une composition = une map, un nom, 5 emplacements (`slots`, agent + joueur assigné), un statut, des notes, une date de modification |
| `profiles` | Un compte = admin (peut écrire) ou non (lecture seule) |

---

## En cas de problème

- **"Configuration Supabase manquante"** : le fichier `.env` n'existe pas,
  n'est pas à la racine du projet, ou a un nom incorrect (vérifiez qu'il n'y
  a pas de `.example` à la fin).
- **"Action refusée : vous devez être connecté en tant qu'administrateur"**
  en étant pourtant connecté : vérifiez à l'étape 6 que la ligne SQL a bien
  été exécutée avec le bon UID (Authentication > Users pour re-vérifier
  l'UID exact).
- **Les compositions ne se synchronisent pas entre deux navigateurs** :
  vérifiez dans Supabase, Table Editor > `compositions`, que la
  réplication temps réel est active (Database > Replication, les tables
  `compositions` et `players` doivent être cochées — normalement déjà fait
  par le script SQL).
- **Une map n'a "aucune composition"** même après connexion admin : c'est
  normal la toute première fois — cliquez sur la map, la composition
  principale se crée automatiquement dès que vous êtes connecté en admin.
