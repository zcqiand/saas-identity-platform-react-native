/**
 * 会话/租户上下文页视图模型（REQ-2026-036 S-T1）。
 *
 * M01.F01.I01（身份卡）/ M01.F03.I01（租户列表）/ M01.F03.I02（切租户选中态）
 * 的页面承接：纯函数从 SessionSnapshot 派生渲染面，不碰网络与组件状态——
 * 断言形状照 login-form 首片配方（REQ §1 分叉面 1：jest 断言 + L4.5 bundle 门）。
 * 回退链一律 `||`（禁空串兜底，家族在册指纹）。
 */
import type {TenantMembership} from '../../api/endpoints/model';
import type {SessionSnapshot} from '../../session/session';

export interface IdentityCardView {
  /** 展示名：email → id 回退链；无会话占位「未登录」。 */
  displayName: string;
  /** 当前租户标签；未选租户占位「未选择租户」。 */
  tenantLabel: string;
}

export interface TenantItemView {
  tenantId: string;
  /** 列表展示标签（成员关系无租户名字段，tenantId 即标签）。 */
  label: string;
  selected: boolean;
  roleIds: string[];
}

const NOT_SIGNED_IN = '未登录';
const NO_TENANT = '未选择租户';

export function buildIdentityCard(snapshot: SessionSnapshot): IdentityCardView {
  const user = snapshot.user;
  const displayName = user?.email || user?.id || NOT_SIGNED_IN;
  const tenantLabel = snapshot.currentTenantId || NO_TENANT;
  return {displayName, tenantLabel};
}

export function buildTenantItems(snapshot: SessionSnapshot): TenantItemView[] {
  const memberships: TenantMembership[] = snapshot.availableTenants || [];
  return memberships.map(membership => ({
    tenantId: membership.tenantId,
    label: membership.tenantId || '未知租户',
    selected: membership.tenantId === snapshot.currentTenantId,
    roleIds: membership.roleIds || [],
  }));
}
