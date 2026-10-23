---
title: "Drone Study Notes: Flight Controllers and Attitude Estimation"
date: 2026-10-18 09:00:00 +0800
permalink: /en/posts/drone-notes/
categories: [Blog, Notes]
tags: [Study-Notes, Flight-Controller, PID]
lang: en
---

A quadcopter flies not on magic, but on "attitude estimation + control loop closure".

## Where the Attitude Comes From

- Gyroscope + accelerometer + magnetometer → fused into attitude
- Complementary filter / Mahony / EKF each have their trade-offs
- Gyros are accurate short-term but drift long-term; accelerometers are stable long-term but noisy short-term → complement them

## The Control Loop

- Inner loop: angular rate (PID); outer loop: angle (PID)
- Cascaded PID is more stable and disturbance-resistant than single-stage
- Tuning order: inner loop first, then outer; P first, then I, then D

## Safety

- Bench-test with props off before flying
- Failsafe must be configured in advance
- Propellers are blades — keep hands out of the rotation plane

> The essence of a flight controller is holding "the attitude you want" steadily amid noise and disturbance.
