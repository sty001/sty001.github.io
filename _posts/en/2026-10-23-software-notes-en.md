---
title: Software Engineering Study Notes: From Requirements to Release
date: 2026-10-23 09:00:00 +0800
permalink: /en/posts/software-notes/
categories: [Blog, Notes]
tags: [Study-Notes, Software-Engineering, Architecture]
lang: en
---

A few notes on software engineering methodology, focused on "engineering practice that actually lands" rather than pure theory.

## Requirement Breakdown

- Split vague requirements into **user stories**, each one independently acceptable
- Use **MoSCoW** to separate Must / Should / Could / Won't
- Contract first: define the API / data structures before writing the implementation

## Code Organization

- Single responsibility + dependency inversion; avoid god classes
- Isolate change with layering (controller / service / repository)
- Follow Conventional Commits so CHANGELOGs can be generated automatically

## Release and Observability

- Canary releases + feature flags
- Logs, metrics, and tracing — you need all three
- When something breaks: roll back first, review afterwards

> The gap in engineering skill often lies not in writing code, but in "keeping a system delivering steadily".
