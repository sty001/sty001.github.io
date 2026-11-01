---
layout: page
title: C++ 知识库总览
icon: fas fa-code
order: 7
permalink: /cpp-overview/
---

《C++开发从入门到精通》思维导图重构版：26 章、30000+ 行，主线 C++20，前瞻 C++23，同时把 C++11/14/17 的演进脉络讲透。原书的 DirectX 播放器、视频监控卡等过时实战已替换为 CMake/asio/FFmpeg/并发服务等现代工程实践，每个节点都讲"是什么、为什么这么设计、什么时候别用、坑在哪"。

## 分区直达
{: .sec-sum}

- [开篇与工具链](#开篇与工具链) · [语言基础](#语言基础) · [运算符表达式与流程控制](#运算符表达式与流程控制)
- [指针与复合类型](#指针与复合类型) · [函数与输入输出](#函数与输入输出) · [面向对象](#面向对象)
- [泛型与标准库](#泛型与标准库) · [异常内存与调试](#异常内存与调试) · [预处理与构建](#预处理与构建) · [工程实战](#工程实战)

## 开篇与工具链
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [01-C++概述与现代工具链](/posts/cpp-ch01/) | 2026 年谁在用 C++、标准演进时间线、编译四阶段、三大编译器与标准库、CMake/vcpkg、工具链全家桶、Hello World 三种写法 |
| [02-程序结构面向对象与算法思维](/posts/cpp-ch02/) | OOP 三要素与"不是银弹"、编译单元与 ODR、编码规范、STL 算法与 C++20 Ranges 管道 |

## 语言基础
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [03-标识符数据类型与字面量](/posts/cpp-ch03/) | 保留字与雷区、LP64/LLP64 数据模型差异、定宽整型、char8_t 家族、字面量前后缀大全、auto 推导入门 |
| [04-变量常量与初始化](/posts/cpp-ch04/) | 声明/定义/初始化辨析、`{}` 窄化保护、最令人沮丧的解析、静态初始化顺序惨剧、const/constexpr/consteval/constinit |
| [05-运算符全解](/posts/cpp-ch05/) | 优先级与结合律、求值顺序与 UB 清单、位运算工具箱、`<bit>` 库、三路比较 `<=>` |

## 运算符表达式与流程控制
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [06-表达式类型转换与值类别](/posts/cpp-ch06/) | 值类别分类树、`std::move` 不移动、引用折叠、四种 cast 的代价、严格别名与 `bit_cast` |
| [07-流程控制语句](/posts/cpp-ch07/) | if/switch 带初始化、`if constexpr`、fallthrough、range-for 的坑、goto 的合理与不合理 |
| [08-指针全解](/posts/cpp-ch08/) | `int* p, q` 坑、nullptr vs NULL、指针算术 UB、数组退化三证据、指针 vs 引用对比表、函数指针与成员指针 |
| [09-数组结构体与现代复合类型](/posts/cpp-ch09/) | 行主序与缓存、span/mdspan、enum class、聚合初始化与指派初始化、padding 推算、union → variant |

## 函数与输入输出
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [10-函数Lambda与协程门径](/posts/cpp-ch10/) | 传参决策表、NRVO 与强制移动、lambda 捕获大全、std::function 的开销、main 与命令行、C++20 协程门径 |
| [11-流文件系统与格式化](/posts/cpp-ch11/) | 流状态与错误恢复、iomanip 粘性坑、std::format/print、charconv、fstream、std::filesystem |

## 面向对象
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [12-类与封装](/posts/cpp-ch12/) | Rule of Zero/Three/Five/Six、初始化列表顺序坑、RAII 深析、`=default/=delete`、noexcept 移动、PIMPL |
| [13-命名空间作用域与名字查找](/posts/cpp-ch13/) | inline namespace 版本化、ADL 与 hidden friend、`using namespace std` 批判、匿名命名空间与 ODR |
| [14-继承与派生](/posts/cpp-ch14/) | is-a 与 Liskov、虚析构何时必须、对象切割、菱形与虚继承代价、组合优于继承 |
| [15-多态虚函数与运算符重载](/posts/cpp-ch15/) | vtable/vptr、override/overload/hide 三者辨析、运算符重载黄金法则、`<=>` 自动生成、NVI 惯用法 |

## 泛型与标准库
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [16-模板与泛型编程](/posts/cpp-ch16/) | 推导五形态、SFINAE 到 Concepts 的演进、`if constexpr`、可变参数模板与折叠表达式、策略类与 CRTP、手写迷你 function |
| [17-字符串处理全解](/posts/cpp-ch17/) | SSO 三家实现差异、npos 截断坑、string_view 悬垂清单、charconv、UTF-8 与 char8_t、日志格式化与 CSV 解析实战 |

## 异常内存与调试
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [18-异常处理与错误传递](/posts/cpp-ch18/) | 栈展开全程、catch 切片、异常安全三保证、noexcept 与 vector 扩容、expected(C++23) 链式 |
| [19-内存管理RAII与智能指针](/posts/cpp-ch19/) | 进程内存七区、new 三层次、pmr 分配器、unique/shared/weak 全要点、内存序入门、ASan 实战 |
| [21-错误分类调试与可观测性](/posts/cpp-ch21/) | 编译/链接/运行三层错误解读、gdb 实战、sanitizer 全家、clang-tidy、perf 与火焰图 |

## 预处理与构建
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [20-预处理器头文件与C++20模块](/posts/cpp-ch20/) | include guard vs pragma once、宏陷阱清单、特性测试宏、C++20 模块三件套与迁移路径 |

## 工程实战
{: .sec-sum}

| 篇目 | 内容速览 |
| --- | --- |
| [22-现代CMake工程与图书借阅系统](/posts/cpp-ch22/) | 领域建模、CMake target 思维、vcpkg/Conan、doctest 单元测试、CI workflow |
| [23-现代C++网络编程](/posts/cpp-ch23/) | 五种 I/O 模型、BSD socket 全景、asio 三种写法对照、C++20 协程 HTTP 服务、优雅退出 |
| [24-现代C++游戏项目实践](/posts/cpp-ch24/) | 固定步长游戏循环、ECS 与数据导向设计、稀疏集、对象池、SDL2 接入、可运行骨架 |
| [25-音视频媒体管线](/posts/cpp-ch25/) | PCM 与音频回调铁律、FFmpeg RAII 封装、SPSC 环形缓冲、音视频同步、jthread 管线 |
| [26-并发服务与可观测监控体系](/posts/cpp-ch26/) | C++20 并发全家桶、线程池、SQLite 时序存储、REST+RBAC、告警状态机、Prometheus 指标 |

## 学习路径建议
{: .sec-best}

- **零基础**：01 → 02 → 03 → 04 → 05 → 07 → 08 → 09，打完地基再进 12/14/15，最后 16/19；实战从 22 起步
- **有 C 基础**：03、06、08 快速过（重点看辨析与坑），直奔 12 → 14 → 15 → 16 → 19，工程篇按需取用
- **赶面试**：06 值类别、08 指针引用、12 特殊成员函数、15 重载决议、16 模板推导、19 智能指针——这六篇是高频考点集中区

> **注意：** 原思维导图第 22~26 章的 DirectX 媒体播放器、监控卡选购等内容已过时，本知识库按"保留业务场景、替换技术栈"的原则重做，对应关系在各实战篇开头注明。
{: .sec-note}

> **拓展：** 每篇末尾都有「知识点速查」「动手练」「变式追问」三个收尾区，适合当复习卡片用；文中所有 `{: .sec-*}` 标注由博客样式自动渲染成带图标的分区，无需手动处理。
