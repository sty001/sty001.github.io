---
title: 具身机器人学习笔记：从 VLA 到 Sim2Real
date: 2026-10-17 09:00:00 +0800
categories: [具身机器人, 学习笔记]
tags: [学习笔记, VLA, 强化学习]
---

具身智能把「大模型」从屏幕里请到了物理世界，这里记几条关键脉络。

## VLA 是什么

- Vision-Language-Action：看世界、懂指令、出动作
- 把多模态感知与动作策略端到端打通
- 典型范式：视觉+语言 → tokenize → 动作块（action chunk）

## 训练数据

- 真机遥操作贵且慢 → 靠仿真大规模生成
- 示教（demonstration）+ 强化学习（RL）互补
- 数据多样性直接决定泛化上限

## Sim2Real

- 仿真到现实的鸿沟：摩擦、延迟、传感器噪声
- 域随机化（domain randomization）是关键手段
- 真机微调（fine-tune）补最后一块短板

> 具身难的不是「模型」，而是「让模型在真实物理里不翻车」。
