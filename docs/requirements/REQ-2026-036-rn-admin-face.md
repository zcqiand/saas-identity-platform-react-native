# REQ-2026-036 saas-react-native 控制台业务面（admin 五页 + 菜单/OAuth 消费）

| 项 | 值 |
|---|---|
| 提出人 | zcqiand |
| 提出日期 | 2026-11-02 |
| 优先级 | P1 |
| 状态 | 已上线（S-T1-T6 全收官 2026-11-04，人工验收通过，GA 已翻转） |
| 关联 ADR | — |
| 先例 | REQ-2026-032（本仓登录链首片）/ saas miniprogram knife2-knife4 配方（登录链→admin 五页→OAuth+菜单）/ REQ-2026-029（saas-angular full-feature-sync） |

## 1. 需求描述

> 人裁原话（2026-11-02）：「要立项」（RN 业务面推进，双家族各一单，本单是 saas 侧）。

理解：saas-RN 从登录链首片态（REQ-2026-032：whoami/租户列表/切换/密码登录/登出 5 ID）推到控制台业务面——对齐 saas miniprogram 已交付面与 saas-react 同域覆盖：**M00 tenant-admin 配置面五页（租户维护/租户成员/租户角色/角色权限/租户应用）+ M04 应用与菜单管理消费面**。镜像树现状 9 ID 全「开发中」（M01.F01/F03/F04），业务域 0 页。

### RN 栈分叉面（相对 miniprogram/react 先例的差异，即本单风险面）

1. **无 dev server**：五门全 CLI（L1 prettier / L2 eslint / L3 tsc / L4 jest / L4.5 metro bundle 产物落 `_work/`）；页面验证靠 jest（RN renderer）+ metro bundle 门，无浏览器 live 探针——断言形状照本仓 `tests/login-form.test.ts` 首片配方
2. **门命令形状**：`npx --no -- <tool>` 分隔（npm 11 假绿事故纪律）；jest trace 标题尾锚适配器（X16 首航配方）
3. **家族树 ID 不通用**：saas RN 镜像锚 saas shared 树，不照搬 lab 家族树业务域编号（REQ-2026-033 批在册教训）；本单消费面按镜像免批通道随片登记进本仓 function-tree.md
4. **native 工程面不在骨架**（android/ ios/ 文件夹后置）：本批仍为 JS/TS 面交付，真机/dev client 与 APK/IPA 分发维持 Phase 1+ 挂账——AC 不含设备依赖
5. **契约消费只认生成物**：orval fetch client（hard §4），页面经 mutator 直调家族后端或 mock store——mock 姿态随 saas-react 同款约定

### 澄清记录

| 疑问 | 澄清结论 | 澄清人 | 日期 |
|---|---|---|---|
| 范围 | = miniprogram knife3（admin 五页）+ knife4（菜单消费）的 RN 版；OAuth 浏览器流不适用原生客户端（REQ-2026-032 同语义，不登记 SSO I 项） | Claude（按「要立项」起草，z 裁） | 2026-11-02 |

## 2. 验收标准

| 编号 | 场景（给定） | 操作（当） | 面预期（则） |
|---|---|---|---|
| AC-1 | saas shared 树 M00.F01-F05 / M04.F04（菜单）活跃 I 项 | 逐项实现 + `@fn` 锚 jest 测试 + TRACE_MAP=1 跑 trace_cmd | ✅ 全部实现 ID 入 trace.json（禁 skip 挂 ID），gate L0-L5 全绿 |
| AC-2 | 页面组件逐页交付 | jest 渲染 + 交互断言（RN renderer） | ✅ 五页 CRUD 交互断言绿；列表分页/过滤语义与 saas-react 同款 |
| AC-3 | metro bundle 门 | L4.5 构建 | ✅ bundle 产物落 `_work/` 成功（零 Android SDK 依赖） |
| AC-4 | 镜像树 | 逐域 mirror 登记（免批通道 ADR-0042） | ✅ 交付 I 项状态翻转有据；无悬空引用（L5） |

### 2.1 交付态核对（S-T6，2026-11-03）

| AC | 达成情况 |
|---|---|
| AC-1 | ✅ 37 fn ID 全 trace（47 测试），gate L0-L5 全绿 49 条目；无 skip 挂 ID |
| AC-2 | ◐ 页面以 **service+view 分层 + jest 断言**交付（无设备依赖）；S-T1 另有 screen 组件（`src/features/identity/context-screen.tsx`）。**RN renderer 组件级交互断言与 S-T2-T5 screen 组件随 native 工程面另片**（REQ §1 分叉面 1/4 既定挂账）——jest 断言位=视图派生纯函数（列表分页/过滤/装配语义与 saas-react 同款已核） |
| AC-3 | ✅ L4.5 metro bundle 门绿（产物落 `_work/`，零 Android SDK 依赖） |
| AC-4 | ✅ 35 I 项 mirror 免批登记（S-T1-T5 六批提案），L5 无悬空引用 |

**宿主接线挂账确认**：`App.tsx` 维持 Phase 0 零业务骨架；context-screen 数据接线（App 持 auth-service 装配）随 native 工程面批挂账——本单 AC 不含设备依赖，不受影响。

## 3. 任务拆解

| 任务 ID | 任务描述 | 类型 | 负责人 | 预估 | 状态 |
|---|---|---|---|---|---|
| S-T1 | 会话/租户上下文页（M01.F01/F03 消费面 UI 化：身份卡 + 租户列表 + 切租户——登录链 5 ID 的页面承接） | 开发 | Claude | — | ✅ 已完成（e77acb4，含 context-screen 组件） |
| S-T2 | M00.F01 租户维护页（admin 列表/创建/详情/更新，platform admin 范围） | 开发 | Claude | — | ✅ 已完成（46ad1a8，service+view 5 锚） |
| S-T3 | M00.F02 租户成员页（CRUD + 邀请/接受/状态流；I07 接受邀请 BASE 无端点不含） | 开发 | Claude | — | ✅ 已完成（6fe4a50，service+view 7 锚） |
| S-T4 | M00.F03 租户角色页 + M00.F04 角色权限矩阵页（role↔permission + 角色菜单授权；F04.I01 已废弃不消费） | 开发 | Claude | — | ✅ 已完成（f7f904f，service+view 8 锚） |
| S-T5 | M00.F05 租户应用页 + M04.F04 菜单管理消费页（菜单树只读+维护面） | 开发 | Claude | — | ✅ 已完成（3308a89，service+view 12 锚） |
| S-T6 | 收官：mirror 推进（GA 翻转）+ route/trace 全绿 + handoff | 收口 | Claude | — | ✅ 代码面完成（2026-11-03，REQ 勾销+AC 核对 §2.1）；**GA 翻转待人工验收后另步执行** |

## 4. 功能影响

| 功能 ID | 功能名称 | 影响类型 | 说明 | 关联任务 |
|---|---|---|---|---|
| M00.F01-F05、M04.F04、M01.F01/F03 页面承接 | saas 控制台域 | 新增/变更 | I 级随实现逐段 mirror 登记（已落 35 I 项，见 §2.1 AC-4） | S-T1-S-T6 |

## 5. 人工验收记录

**2026-11-04 人签：人工验收通过（zcqiand）。** 同日执行 GA 翻转——M00/M01/M04 三模块行 + 46 F/I 行 开发中→已上线（M00/M04 模块行 规划→开发中→已上线 两段落地），mirror 免批凭本记录；**3 个 UI 行（M01.F01.I01、M01.F03.I01、M04.F04.I08，`unreachable_shipped` 清单）按 gate 处方退回开发中**——消费逻辑已交付但界面入口随 native 工程面另片（§2.1 AC-2 ◐），上界面时随屏翻 GA。

代码交付摘要 2026-11-03：五片 35 消费 op / 37 fn ID 全 trace / gate L0-L5 全绿 49 条目；分片 commit e77acb4 / 46ad1a8 / 6fe4a50 / f7f904f / 3308a89。
