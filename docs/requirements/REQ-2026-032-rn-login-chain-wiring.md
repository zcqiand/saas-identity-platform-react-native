# REQ-2026-032 RN 登录链接线首片（session/token/authed fetch）

| 项 | 值 |
|---|---|
| 提出人 | zcqiand（2026-11-01 人裁：saas RN 登录链首片，照 harmonyos/angular 先例） |
| 提出日期 | 2026-11-01 |
| 优先级 | P1 |
| 状态 | 开发中 |
| 关联 ADR | — |

## 1. 需求描述

用户原话：「react native版本都完成了吗？」——骨架完成、切片为零；人裁「saas RN 登录链首片」。

本片交付 saas RN 的登录链**逻辑接线面**（Phase 0，无真机）：

- `SessionState` 会话状态 + 可注入 token store（内存版；持久化 Phase 1+ 接真机存储）
- mutator 传输层 token 注入（`src/api/mutator.ts` 自述「token 注入 Phase 1 接线时补」，本片即该接线批）
- 登录（密码换 session）/ 登出（本地清理 + 全局 logout）/ whoami / 列我的租户 / 切租户 五条流程的消费面
- 登录入参装配与校验纯函数（fail-fast，harmonyos RoleForms 同构）

**范围外（后置）**：登录页 UI（shared 树认证域页面子项）——RN native 工程面（android/ ios/）骨架不含、真机 Phase 1+，无可触达界面，随 native 面落地另片登记；token 持久化存储（AsyncStorage 等原生模块）后置；metro env 烘焙（babel transform-inline-environment-variables）随 dev server 面另批。

### 澄清记录

| 疑问 | 澄清结论 | 澄清人 | 日期 |
|---|---|---|---|
| 首片是否含登录页 UI？ | 不含。真机面 Phase 1+，先切逻辑接线（harmonyos 先例同构：纯函数+生成模型，本地单测无设备依赖） | zcqiand（人裁批文） | 2026-11-01 |

## 2. 验收标准

| 编号 | 场景（给定） | 操作（当） | 预期（则） |
|---|---|---|---|
| AC-1 | 无会话 | `login(email, password)` 走 stub fetch 返回 200 session | token/用户入 store，后续请求带 Authorization |
| AC-2 | 已登录 | 登录请求体缺 username、password 或 clientId | fail-fast 抛错，不发请求 |
| AC-3 | 已登录 | 后端回 423 Locked | 登录流程抛锁定错并清空本地 session 残留 |
| AC-4 | 已登录 | `whoami()` | 带 token 调 `/me/whoami`，返回当前用户 |
| AC-5 | 已登录 | `listMyTenants()` / `switchTenant(id)` | 分别带 token 调对应端点，切租户更新会话租户上下文 |
| AC-6 | 已登录 | `logout()` | 调 `/auth/logout` 后本地 token/用户/租户全部清空 |
| AC-7 | 全部 | `npx --no -- jest` 全绿 + TRACE_MAP=1 trace 六锚落 `.state/trace.json` | gate L0-L5 exit 0 |

## 3. 任务拆解

| 任务 ID | 任务描述 | 类型 | 负责人 | 预估 | 状态 |
|---|---|---|---|---|---|
| T-1 | 树 mirror 登记六 ID（M01.F01.I01/F03.I01/F03.I02/F04.I01/F04.I06 + 占位说明） | 对齐 | Claude | 0.5h | 完成 |
| T-2 | 登录链测试面（fnTest 锚，stub fetch，覆盖 AC-1~6） | 测试 | Claude | 2h | 完成 |
| T-3 | session/token store + authed fetch + 五流程消费面实现 | 实现 | Claude | 2h | 完成 |
| T-4 | 全门 L0-L5 + 收链提交 + suite gitlink | 门禁 | Claude | 0.5h | 完成 |

## 4. 功能影响（需求与功能对齐的唯一位置）

| 功能 ID | 功能名称 | 影响类型 | 说明 | 关联任务 |
|---|---|---|---|---|
| M01.F01.I01 | 当前用户 whoami（React Native 消费面） | 新增 | `meWhoami` 消费，session 建立后身份回填 | T-2/T-3 |
| M01.F03.I01 | 列出我的租户成员关系（React Native 消费面） | 新增 | `meListMyTenants` 消费 | T-2/T-3 |
| M01.F03.I02 | 切换当前租户（React Native 消费面） | 新增 | `meSwitchTenant` 消费，更新会话租户上下文 | T-2/T-3 |
| M01.F04.I01 | 密码登录（React Native 消费面） | 新增 | `sessionsLogin` 消费 + 入参装配校验 + 423 分流 | T-2/T-3 |
| M01.F04.I06 | 登出（React Native 消费面） | 新增 | `sessionsLogout` 消费 + 本地全清 | T-2/T-3 |

（登录页 UI 本片不登记——范围外，见 §1。功能影响表只收本片交付的五个 ID。）

## 5. 流程影响

无（RN 仓 flow-function-map 尚无流程面；首片为端到端登录链，无中间流程拆分）。

## 6. 风险与回滚

| 风险 | 影响面 | 缓解 | 回滚方式 |
|---|---|---|---|
| jest preset 对纯 TS 模块之外的导入爆原生依赖 | 测试面 | 只测纯函数 + fetch 注入层，禁触原生模块（harmonyos 纪律同构） | 删测试文件回骨架态 |
| mutator 手写层被业务逻辑污染 | 传输层 | token 注入落 session/拦截层，mutator 只加透明 token 参数 | revert 单 commit |
