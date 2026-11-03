/**
 * 租户维护视图派生（REQ-2026-036 S-T2 / M00.F01）。
 *
 * 纯函数零依赖：行/详情视图、创建/更新载荷装配（fail-fast 校验，
 * 空载荷禁发）、状态文案。长度约束来自契约（tenantKey 2-64 / name 2-128）。
 */
import type {
  AdminTenantsListTenants200,
  CreateTenantRequest,
  Tenant,
  TenantStatus,
  UpdateTenantRequest,
} from '../../api/endpoints/model';

export interface TenantRowView {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
}

export interface TenantDetailView {
  id: string;
  key: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantFormInput {
  tenantKey: string;
  name: string;
}

export interface UpdateTenantFormInput {
  name?: string;
  status?: TenantStatus;
}

export function buildTenantRows(page: AdminTenantsListTenants200): TenantRowView[] {
  return page.items.map(tenant => ({
    id: tenant.id,
    key: tenant.tenantKey,
    name: tenant.name,
    status: tenant.status,
  }));
}

export function buildTenantDetail(tenant: Tenant): TenantDetailView {
  return {
    id: tenant.id,
    key: tenant.tenantKey,
    name: tenant.name,
    status: tenant.status,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

export function assembleCreateTenantBody(
  input: CreateTenantFormInput,
): CreateTenantRequest {
  const tenantKey = input.tenantKey.trim();
  const name = input.name.trim();
  if (tenantKey.length < 2 || tenantKey.length > 64) {
    throw new Error(`tenantKey 需 2-64 字符（收到 ${tenantKey.length}）`);
  }
  if (name.length < 2 || name.length > 128) {
    throw new Error(`name 需 2-128 字符（收到 ${name.length}）`);
  }
  return {tenantKey, name};
}

export function assembleUpdateTenantBody(
  patch: UpdateTenantFormInput,
): UpdateTenantRequest {
  const body: UpdateTenantRequest = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2 || name.length > 128) {
      throw new Error(`name 需 2-128 字符（收到 ${name.length}）`);
    }
    body.name = name;
  }
  if (patch.status !== undefined) {
    body.status = patch.status;
  }
  if (Object.keys(body).length === 0) {
    throw new Error('更新载荷为空——至少给出 name 或 status');
  }
  return body;
}

export function tenantStatusLabel(status: TenantStatus): string {
  if (status === 'active') return '启用中';
  if (status === 'suspended') return '已停用';
  return status;
}
