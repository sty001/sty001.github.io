---
title: Automotive Electronics Study Notes: CAN Bus Fundamentals
date: 2026-10-19 09:00:00 +0800
permalink: /en/posts/automotive-notes/
categories: [Blog, Notes]
tags: [Study-Notes, CAN, Bus]
lang: en
---

In in-vehicle networking, CAN is unavoidable. Here is a quick-reference note.

## Why CAN

- Multi-master, differential, noise-immune — a good fit for the in-car electromagnetic environment
- Non-destructive arbitration: higher-priority frames win automatically, without data loss
- Low cost and a mature ecosystem (CAN, CAN FD)

## Frame Structure Essentials

- Standard frames use an 11-bit ID; extended frames use 29 bits
- Data field carries up to 8 bytes (CAN FD up to 64)
- ACK, CRC and bit stuffing guarantee reliability

## In Practice

- Grab packets quickly with `candump` / `cansend` (Linux)
- DBC files describe the mapping between signals and bytes
- Mind the 120Ω termination resistors — a pair is required; miss one and the bus becomes unstable

> The hard part of automotive electronics is not sending a frame — it is "diagnosing and calibrating the whole-vehicle network".
