---
title: Drones — Notes d'étude : contrôleur de vol et estimation d'attitude
date: 2026-10-18 09:00:00 +0800
permalink: /fr/posts/drone-notes/
categories: [Blog, Notes]
tags: [Notes, Contrôleur-de-vol, PID]
lang: fr
---

Un quadricoptère ne vole pas par magie, mais grâce à « l'estimation d'attitude + la boucle de contrôle ».

## D'où vient l'attitude

- Gyroscope + accéléromètre + magnétomètre → fusionnés pour estimer l'attitude
- Filtre complémentaire / Mahony / EKF : chacun a ses compromis
- Le gyroscope est précis à court terme mais dérive à long terme ; l'accéléromètre est stable à long terme mais bruité à court terme → on les complète

## La boucle de contrôle

- Boucle interne : vitesse angulaire (PID) ; boucle externe : angle (PID)
- Le PID en cascade est plus stable et plus robuste aux perturbations qu'un PID simple
- Ordre de réglage : boucle interne d'abord, puis externe ; P d'abord, puis I, enfin D

## Sécurité

- Testez au sol (hélices démontées) avant de voler
- Le failsafe doit être configuré à l'avance
- Les hélices sont des lames — gardez les mains hors du plan de rotation

> L'essence d'un contrôleur de vol : maintenir stable « l'attitude souhaitée » au milieu du bruit et des perturbations.
