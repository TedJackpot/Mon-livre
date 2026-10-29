# Mon Livre — Studio éditorial

Application de mise en page de livres illustrés à partir de textes et d’images déjà créés.

## Fonctions présentes

- Mise en page de pages et choix de maquettes
- Import de textes `.txt` et `.md`, et d’images
- Couvertures personnalisables, titres, couleurs et marque-pages
- Enregistrement des projets avec un compte
- Export JSON et impression A5 / PDF depuis le navigateur
- Accès aux catalogues gratuits de modèles Canva et Adobe Express

## Organisation du dépôt

Les dossiers `pages/`, `components/`, `helpers/`, `endpoints/`, `static/` et le fichier `base.css` sont les sources exportées du projet Floot. Les dépendances utilisées sont répertoriées dans `static/__dev/dependencies.json`. L’icône de l’application est dans `static/mon-livre-icon.svg`.

## Runtime et sauvegarde

Ce dépôt est une sauvegarde des sources du projet Floot. Il ne constitue pas encore une application autonome installable avec `npm install` : le routage, les endpoints, les sessions et la base PostgreSQL utilisent le runtime et les ressources Floot. Les comptes et les projets enregistrés dans la base Floot ne sont pas inclus dans GitHub.

Pour exécuter cette version, il faut la réimporter dans Floot ou porter les routes, l’authentification et la base de données vers un environnement indépendant, puis configurer les variables secrètes côté serveur. Ne jamais ajouter de clés, mots de passe ou fichiers `.env` au dépôt.

## Modèles Canva et Adobe

Les modèles proposés dans l’interface ouvrent les bibliothèques officielles. Ils ne sont pas copiés dans le dépôt : leur disponibilité, leur badge gratuit et leurs conditions d’utilisation sont contrôlés sur chaque plateforme.
