---
title: Manufacturing Process Study Notes: SMT and Soldering
date: 2026-10-20 09:00:00 +0800
permalink: /en/posts/process-notes/
categories: [Blog, Notes]
tags: [Study-Notes, SMT, Soldering]
lang: en
---

Getting the hardware designed is only the first step — being able to **build it consistently** is where process engineering shows its worth.

## The SMT Line

- Solder paste printing → pick & place → reflow soldering → AOI inspection
- Stencil apertures determine paste volume; wrong apertures lead to bridging or cold joints
- The reflow temperature profile (ramp / soak / reflow / cooling) must match the paste spec

## Hand Soldering

- Iron temperature around 350°C; a chisel tip suits drag soldering
- Drag soldering a QFP: fix two diagonal pins first, then sweep in one motion
- For 0805 and smaller passives, prefer a hot-air rework station — don't force the iron

## Reliability

- Use moisture-sensitive devices (MSL) promptly after opening, or bake them
- After board washing, dry thoroughly before powering up

> Process yields determine yield, yield determines cost, and cost determines whether mass production is viable.
