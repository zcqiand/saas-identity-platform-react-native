/**
 * 会话/租户上下文页视图（REQ-2026-036 S-T1 / M01.F01.I01, M01.F03.I01/I02 页面承接）。
 *
 * 断言形状照 login-form/auth-chain 首片配方：纯函数视图模型 + stub 数据，
 * 不触真实网络与原生模块；RN renderer 断言随 native 工程面另片（REQ §1 分叉面 1）。
 */
import {fnTest} from './fn';

import {buildIdentityCard, buildTenantItems} from '../src/features/identity/context-view';
import type {SessionSnapshot} from '../src/session/session';
import type {CurrentUser, TenantMembership} from '../src/api/endpoints/model';

const USER: CurrentUser = {
  id: 'u-1',
  email: 'alice@saas.local',
  memberships: [],
  currentTenantId: 't-acme',
};

const MEMBERSHIPS: TenantMembership[] = [
  {
    id: 'm-1',
    userId: 'u-1',
    tenantId: 't-acme',
    roleIds: ['r-admin'],
    status: 'active',
    joinedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm-2',
    userId: 'u-1',
    tenantId: 't-beta',
    roleIds: ['r-viewer', 'r-editor'],
    status: 'active',
    joinedAt: '2026-02-01T00:00:00Z',
  },
];

function snapshot(patch: Partial<SessionSnapshot>): SessionSnapshot {
  return {availableTenants: [], ...patch};
}

fnTest(
  ['M01.F01.I01'],
  '身份卡视图回填会话身份字段，displayName 缺失走 || 回退链',
  async () => {
    const card = buildIdentityCard(snapshot({user: USER, currentTenantId: 't-acme'}));
    expect(card.displayName).toBe('alice@saas.local');
    expect(card.tenantLabel).toBe('t-acme');

    // email 缺席 → 回退 id，禁空串兜底（家族回退链 || 纪律）
    const fallback = buildIdentityCard(
      snapshot({
        user: {...USER, email: undefined},
        currentTenantId: 't-acme',
      }),
    );
    expect(fallback.displayName).toBe('u-1');

    // 无会话 → 占位文案而非空串/异常
    const empty = buildIdentityCard(snapshot({}));
    expect(empty.displayName).toBe('未登录');
    expect(empty.tenantLabel).toBe('未选择租户');
    await Promise.resolve();
  },
);

fnTest(['M01.F03.I01'], '租户列表视图逐成员展开，含角色与选中态', async () => {
  const items = buildTenantItems(
    snapshot({
      availableTenants: MEMBERSHIPS,
      currentTenantId: 't-acme',
    }),
  );
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    tenantId: 't-acme',
    label: 't-acme',
    selected: true,
    roleIds: ['r-admin'],
  });
  expect(items[1]).toMatchObject({
    tenantId: 't-beta',
    selected: false,
    roleIds: ['r-viewer', 'r-editor'],
  });
  await Promise.resolve();
});

fnTest(['M01.F03.I02'], '切租户后列表选中态与身份卡租户标签同步翻转', async () => {
  const before = {
    card: buildIdentityCard(
      snapshot({
        user: USER,
        availableTenants: MEMBERSHIPS,
        currentTenantId: 't-acme',
      }),
    ),
    items: buildTenantItems(
      snapshot({
        availableTenants: MEMBERSHIPS,
        currentTenantId: 't-acme',
      }),
    ),
  };
  expect(before.items.find(i => i.tenantId === 't-beta')?.selected).toBe(false);

  // switchTenant 成功后 session.applyTenantSwitch 落新 currentTenantId——
  // 视图层从新快照重建即翻面（与 auth-chain 流程断言同源）
  const after = {
    card: buildIdentityCard(
      snapshot({
        user: USER,
        availableTenants: MEMBERSHIPS,
        currentTenantId: 't-beta',
      }),
    ),
    items: buildTenantItems(
      snapshot({
        availableTenants: MEMBERSHIPS,
        currentTenantId: 't-beta',
      }),
    ),
  };
  expect(after.card.tenantLabel).toBe('t-beta');
  expect(after.items.find(i => i.tenantId === 't-beta')?.selected).toBe(true);
  expect(after.items.find(i => i.tenantId === 't-acme')?.selected).toBe(false);
  await Promise.resolve();
});
