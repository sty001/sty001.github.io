---
title: "Développement matériel — Notes d'étude : schémas et PCB pour débuter"
date: 2026-10-21 09:00:00 +0800
permalink: /fr/posts/hardware-notes/
categories: [Blog, Notes]
tags: [Notes, PCB, Schémas]
lang: fr
---

En venant du logiciel vers le matériel, le premier obstacle est de « dessiner une carte correctement ». Quelques essentiels pour démarrer.

## Schémas

- Dessinez d'abord **l'arbre d'alimentation** : d'où viennent les rails 5V/3,3V et comment ils sont répartis
- Les condensateurs de découplage près des broches d'alimentation des puces — ne faites pas l'économie
- Les signaux critiques (horloge, reset) ont leur propre piste : courte et droite

## Placement PCB

- Partition par fonction : alimentation / numérique / analogique / RF, chacun dans son bloc
- Ne routez rien sous le quartz ; protégez-le avec un plan de masse
- Élargissez les pistes d'alimentation ; cuivre de remplissage là où le courant est fort

## Vérifications avant fabrication

- DRC/ERC entièrement au vert
- Sérigraphie ne recouvrant pas les pastilles
- Quantités de la BOM vérifiées une à une contre les empreintes

> Pour le matériel, « compiler » c'est commander un prototype — chaque révision coûte bien plus cher qu'en logiciel ; les vérifications initiales sont donc les plus rentables.
