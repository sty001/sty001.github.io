---
title: Hardware Development Study Notes: Schematics and PCB Basics
date: 2026-10-21 09:00:00 +0800
permalink: /en/posts/hardware-notes/
categories: [Blog, Notes]
tags: [Study-Notes, PCB, Schematics]
lang: en
---

Coming from software to hardware, the first hurdle is "drawing a board correctly". A few essentials to get started.

## Schematics

- Draw the **power tree** first: where the 5V/3.3V rails come from and how they are distributed
- Put decoupling capacitors close to the chip's power pins — never skimp
- Critical signals (clock, reset) get their own routes: short and straight

## PCB Layout

- Partition by function: power / digital / analog / RF, each in its own block
- Do not route traces under the crystal; guard it with ground
- Widen power traces; use copper pours where current is high

## Pre-Fabrication Checks

- DRC/ERC fully passing
- Silkscreen not covering pads
- BOM quantities cross-checked against footprints one by one

> For hardware, "compiling" means ordering a prototype — each revision costs far more than in software, so upfront checks pay the most.
