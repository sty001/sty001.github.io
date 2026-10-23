---
title: Procédés de fabrication — Notes d'étude : SMT et soudure
date: 2026-10-20 09:00:00 +0800
permalink: /fr/posts/process-notes/
categories: [Blog, Notes]
tags: [Notes, SMT, Soudure]
lang: fr
---

Concevoir le matériel n'est que la première étape — savoir le **fabriquer de façon stable** est le vrai savoir-faire des procédés.

## La ligne SMT

- Impression de pâte à braser → placement → brasage par refusion → inspection AOI
- Les ouvertures du pochoir déterminent le volume de pâte ; des ouvertures inadaptées créent des ponts ou des soudures froides
- Le profil de température de refusion (montée / palier / refusion / refroidissement) doit correspondre à la spécification de la pâte

## Soudure manuelle

- Fer autour de 350 °C ; une panne en biseau convient au drag soldering
- Drag soldering d'un QFP : fixez d'abord deux broches en diagonale, puis balayez d'un seul geste
- Pour les composants 0805 et plus petits, préférez la station d'air chaud — ne forcez pas au fer

## Fiabilité

- Les composants sensibles à l'humidité (MSL) : utilisez-les vite après ouverture, ou passez-les au four
- Après nettoyage de la carte, séchez-la soigneusement avant toute mise sous tension

> Les procédés déterminent le rendement, le rendement détermine le coût, et le coût détermine si la production de masse est possible.
