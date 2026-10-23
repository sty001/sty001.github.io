---
title: Électronique automobile — Notes d'étude : les bases du bus CAN
date: 2026-10-19 09:00:00 +0800
permalink: /fr/posts/automotive-notes/
categories: [Blog, Notes]
tags: [Notes, CAN, Bus]
lang: fr
---

Dans les réseaux embarqués automobiles, le CAN est incontournable. Voici une note de référence rapide.

## Pourquoi le CAN

- Multi-maître, différentiel, immunisé au bruit — adapté à l'environnement électromagnétique du véhicule
- Arbitrage non destructif : les trames prioritaires gagnent automatiquement, sans perte de données
- Coût faible et écosystème mature (CAN, CAN FD)

## Structure des trames : l'essentiel

- Trame standard : ID de 11 bits ; trame étendue : 29 bits
- Champ de données : jusqu'à 8 octets (64 avec CAN FD)
- ACK, CRC et bit stuffing garantissent la fiabilité

## En pratique

- Capturez les trames rapidement avec `candump` / `cansend` (Linux)
- Les fichiers DBC décrivent la correspondance entre signaux et octets
- Attention aux résistances de terminaison de 120Ω — elles vont par paire ; il en manque une et le bus devient instable

> La difficulté de l'électronique automobile ne réside pas dans l'envoi d'une trame, mais dans le « diagnostic et le calibrage du réseau complet du véhicule ».
