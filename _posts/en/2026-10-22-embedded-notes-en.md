---
title: "Embedded Development Study Notes: From Bare Metal to RTOS"
date: 2026-10-22 09:00:00 +0800
permalink: /en/posts/embedded-notes/
categories: [Blog, Notes]
tags: [Study-Notes, STM32, RTOS]
lang: en
---

The hardest step for embedded beginners is the jump from "bare metal" to a real-time operating system. Here is a relatively smooth learning path.

## Bare-Metal Stage

- Master the four essentials first: **clock tree, GPIO, interrupts, timers**
- Blink an LED with registers/GPIO, then move on to HAL/LL libraries
- Interrupt priorities (NVIC) lay the groundwork for everything that follows

## Introducing an RTOS

- Use FreeRTOS to understand **tasks, scheduling, queues, semaphores**
- Turning "polling" into "event-driven" instantly cleans up the code
- Watch for stack overflows: give each task enough stack and enable `uxTaskGetStackHighWaterMark` checks

## Common Pitfalls

- Time-consuming work inside an ISR → the system freezes
- Shared variables without protection → occasional data corruption
- printf inside an interrupt → real-time performance collapses

> Embedded development is not "writing C" — it is "doing deterministic work under resource constraints".
