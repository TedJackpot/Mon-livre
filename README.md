# Mon Livre

Mon Livre est un studio de mise en page pour créer des livres illustrés avec vos textes et vos images. Le dépôt contient une version autonome installable en application web (PWA), qui fonctionne avec des outils gratuits et conserve les données sur votre appareil.

## Démarrer en local

Prérequis : Node.js 24 ou plus récent. Aucune dépendance npm externe, clé API ou abonnement n’est requis.

```sh
cd standalone
npm start
```

Ouvrez ensuite [http://localhost:4321](http://localhost:4321). Dans Chrome ou Edge sur ordinateur, utilisez l’icône d’installation dans la barre d’adresse ou le menu **Installer Mon Livre**. Le serveur Node sert l’interface et enregistre les comptes et projets dans `standalone/app-data/mon-livre.sqlite`.

## Utiliser sur téléphone

L’interface est adaptée aux petits écrans. Pour installer la PWA sur téléphone, l’application doit être servie via HTTPS (ou depuis `localhost` sur le téléphone). Un déploiement HTTPS gratuit peut être fait sur un hébergeur statique compatible, mais la sauvegarde SQLite locale nécessite alors un serveur Node persistant. Le service worker garde l’interface disponible après son premier chargement ; les images et projets restent stockés localement sur l’appareil ou dans le serveur local choisi.

## Fonctions

- Maquettes de pages, styles de couverture, couleurs et polices.
- Import d’images depuis l’appareil, recadrage/compression locale et suppression.
- Texte, titres, pages duplicables/supprimables, marque-pages et aperçu.
- Brouillon automatique dans le stockage du navigateur, export JSON et impression/PDF.
- Comptes locaux et projets sauvegardés dans SQLite, avec mots de passe hachés.
- Liens vers les catalogues de modèles gratuits de Canva et Adobe Express. Ces modèles restent hébergés par leurs plateformes d’origine ; leur badge gratuit, licence et conditions sont à vérifier avant réutilisation.

## Données et limites

La version locale ne synchronise pas les appareils : un compte créé sur un ordinateur n’existe que dans sa base SQLite locale. Exportez régulièrement les livres JSON pour en garder une copie. Pour accéder depuis d’autres appareils, il faut héberger le serveur et protéger l’accès réseau. Les services externes de modèles et les polices Google nécessitent une connexion internet ; l’éditeur et les brouillons locaux sont conçus pour rester utilisables hors ligne après chargement.

Le code Floot d’origine est conservé dans les dossiers racine du dépôt. La version autonome se trouve dans `standalone/`.
