---
title: "Bienvenue sur mon blog"
date: 2026-10-23 12:00:00 +0800
permalink: /fr/posts/welcome/
categories: [Blog, Notes]
tags: [Bienvenue, Blog]
lang: fr
---

<div class="lang-switcher-bar">
  <a href="/">简体中文</a> · <a href="/en/">English</a> · <a href="/ja/">日本語</a> · <span class="lang-current">Français</span>
</div>

Ceci est le premier article de mon blog, écrit pour vérifier que la mise en place de GitHub Pages + Jekyll (thème Chirpy) fonctionne de bout en bout.

## Ce que ce blog va traiter

J'y consignerai mes apprentissages et mes pratiques dans les domaines suivants :

- **FPGA / Circuits numériques** : Quartus, Verilog, contraintes de temporisation, etc.
- **Chaînes d'outils EDA** : Cadence, Keil, etc.
- **Développement web full-stack** : front end, back end et déploiement
- **IA / Grands modèles de langage** : fine-tuning, déploiement, pratique des Agents

## Comment écrire un nouvel article

Il suffit de créer un fichier dans le répertoire `_posts/`, nommé `YYYY-MM-DD-titre.md`, avec un Front Matter en tête :

```yaml
---
title: "Titre de l'article"
date: 2026-10-23 12:00:00 +0800
categories: [Catégorie]
tags: [Tag]
---
```

Puis un `git push` vers la branche `main` — GitHub Actions compile et déploie automatiquement sur GitHub Pages.

> Tout est prêt. Restez à l'écoute pour la suite ✨
