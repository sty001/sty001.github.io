---
title: "Développement embarqué — Notes d'étude : du bare metal au RTOS"
date: 2026-10-22 09:00:00 +0800
permalink: /fr/posts/embedded-notes/
categories: [Blog, Notes]
tags: [Notes, STM32, RTOS]
lang: fr
---

Pour les débutants en embarqué, l'obstacle le plus redouté est le passage du « bare metal » à un système temps réel. Voici un parcours d'apprentissage relativement fluide.

## Étape bare metal

- Maîtrisez d'abord les quatre essentiels : **arbre d'horloge, GPIO, interruptions, timers**
- Faites clignoter une LED par registres/GPIO, puis passez aux bibliothèques HAL/LL
- Les priorités d'interruption (NVIC) fondent tout le reste

## Introduire un RTOS

- Utilisez FreeRTOS pour comprendre **tâches, ordonnancement, files, sémaphores**
- Transformer le « polling » en « pilotage par événements » rend le code immédiatement plus propre
- Attention aux débordements de pile : donnez assez de pile à chaque tâche et activez la vérification par `uxTaskGetStackHighWaterMark`

## Pièges classiques

- Travail long dans une ISR → le système se fige
- Variables partagées sans protection → corruption ponctuelle des données
- printf dans une interruption → le temps réel s'effondre

> L'embarqué, ce n'est pas « écrire du C » — c'est « faire du déterminisme sous contrainte de ressources ».
