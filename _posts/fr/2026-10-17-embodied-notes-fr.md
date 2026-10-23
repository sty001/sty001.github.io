---
title: Robotique incarnée — Notes d'étude : des VLA au Sim2Real
date: 2026-10-17 09:00:00 +0800
permalink: /fr/posts/embodied-notes/
categories: [Blog, Notes]
tags: [Notes, VLA, Apprentissage-par-renforcement]
lang: fr
---

L'intelligence incarnée fait sortir les « grands modèles » de l'écran pour les plonger dans le monde physique. Voici quelques fils conducteurs essentiels.

## Qu'est-ce que le VLA

- Vision-Language-Action : voir le monde, comprendre les instructions, produire des actions
- Il relie de bout en bout la perception multimodale et la politique d'action
- Paradigme typique : vision + langage → tokenisation → blocs d'actions (action chunks)

## Données d'entraînement

- La téléopération sur robot réel coûte cher et prend du temps → générer à grande échelle en simulation
- Les démonstrations et l'apprentissage par renforcement (RL) se complètent
- La diversité des données détermine directement le plafond de généralisation

## Sim2Real

- Le fossé entre simulation et réel : frottements, latence, bruit des capteurs
- La randomisation de domaine (domain randomization) est la technique clé
- Le fine-tuning sur robot réel comble le dernier kilomètre

> La difficulté de l'IA incarnée, ce n'est pas le « modèle » — c'est empêcher le modèle de faire naufrage dans la physique réelle.
