---
layout: page
icon: fas fa-book-open
order: 7
title: 学习笔记
---

> 把每个方向的学习，沉淀成**可检索、可追溯**的笔记。每篇概览开篇给出该方向的子栏目地图，之后按子栏目逐个填充；系列文章标题带序号（如「XX 系列 03」）。

## 学习笔记总览

下面按时间聚合所有带「学习笔记」标签的文章（含各专栏概览与系列连载），新增即自动出现在此：

{% assign note_posts = site.tags["学习笔记"] | sort: "date" %}
{% for post in note_posts %}
- [{{ post.title }}]({{ post.url | relative_url }}) · <span class="readtime-zh">{{ post.date | date: "%Y-%m-%d" }}</span>
{% endfor %}

## 按专栏入口

| 专栏 | 概览笔记 |
|------|----------|
| 软件 | [软件工程学习笔记：从需求到上线](/posts/software-notes/) |
| 嵌入式 | [嵌入式开发学习笔记：从裸机到 RTOS](/posts/embedded-notes/) |
| 硬件开发 | [硬件开发学习笔记：原理图与 PCB 入门](/posts/hardware-notes/) |
| 工艺 | [制造工艺学习笔记：SMT 与焊接](/posts/process-notes/) |
| 汽车电子 | [汽车电子学习笔记：CAN 总线基础](/posts/automotive-notes/) |
| 无人机 | [无人机学习笔记：飞控与姿态解算](/posts/drone-notes/) |
| 具身机器人 | [具身机器人学习笔记：从 VLA 到 Sim2Real](/posts/embodied-notes/) |

> 全部带「学习笔记」标签的文章见 [标签页 · 学习笔记](/tags/学习笔记/)。
