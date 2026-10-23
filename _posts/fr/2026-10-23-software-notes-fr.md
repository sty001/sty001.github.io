---
title: "Génie logiciel — Notes d'étude : des exigences à la mise en production"
date: 2026-10-23 09:00:00 +0800
permalink: /fr/posts/software-notes/
categories: [Blog, Notes]
tags: [Notes, Génie-logiciel, Architecture]
lang: fr
---

Quelques notes sur la méthodologie du génie logiciel, centrées sur « des pratiques d'ingénierie qui se déploient vraiment » plutôt que sur la théorie pure.

## Décomposition des exigences

- Découpez les exigences floues en **user stories**, chacune vérifiable individuellement
- Utilisez **MoSCoW** pour séparer Must / Should / Could / Won't
- Le contrat d'abord : définissez l'API / les structures de données avant d'écrire l'implémentation

## Organisation du code

- Responsabilité unique + inversion des dépendances ; évitez les classes-divinité
- Isolez le changement par couches (controller / service / repository)
- Suivez Conventional Commits pour générer automatiquement les CHANGELOG

## Mise en production et observabilité

- Déploiement canari + feature flags
- Journaux, métriques et tracing — les trois sont indispensables
- En cas de problème : rollback d'abord, analyse ensuite

> L'écart de compétence en ingénierie se joue rarement dans l'écriture du code — il se joue dans « la capacité à faire livrer un système de façon stable et continue ».
