---
title: "Embodied Robotics Study Notes: From VLA to Sim2Real"
date: 2026-10-17 09:00:00 +0800
permalink: /en/posts/embodied-notes/
categories: [Blog, Notes]
tags: [Study-Notes, VLA, Reinforcement-Learning]
lang: en
---

Embodied intelligence brings "large models" out of the screen and into the physical world. Here are a few key threads.

## What Is VLA

- Vision-Language-Action: see the world, understand instructions, output actions
- Connects multimodal perception and action policies end to end
- Typical paradigm: vision + language → tokenize → action chunks

## Training Data

- Real-robot teleoperation is expensive and slow → generate at scale in simulation
- Demonstrations and reinforcement learning (RL) complement each other
- Data diversity directly determines the ceiling of generalization

## Sim2Real

- The reality gap from simulation to the physical world: friction, latency, sensor noise
- Domain randomization is the key technique
- Real-robot fine-tuning closes the last mile

> The hard part of embodied AI is not the "model" — it is keeping the model from failing in real physics.
