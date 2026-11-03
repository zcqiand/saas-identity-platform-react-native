/**
 * 租户维护消费编排（REQ-2026-036 S-T2 / M00.F01.I01-I05）。
 *
 * 形状照 auth-service 首片：只做编排（orval 生成 op + 会话头注入），
 * 错误统一归一为 `code：message` 形（缺项回退，禁静默吞错）。
 * admin/tenants 面要求平台管理员会话——越权由后端 403 归一上抛。
 */
import type {
  AdminTenantsListTenantsParams,
  AdminTenantsListTenants200,
  CreateTenantRequest,
  Tenant,
  UpdateTenantRequest,
} from '../../api/endpoints/model';
import {
  adminTenantsListTenants,
  adminTenantsCreateTenant,
  adminTenantsGetTenant,
  adminTenantsUpdateTenant,
  adminTenantsDeleteTenant,
} from '../../api/endpoints/admin-tenants/admin-tenants';
import type {Session} from '../../session/session';

export interface TenantAdminService {
  listTenants(
    params?: AdminTenantsListTenantsParams,
  ): Promise<AdminTenantsListTenants200>;
  createTenant(request: CreateTenantRequest): Promise<Tenant>;
  getTenant(id: string): Promise<Tenant>;
  updateTenant(id: string, request: UpdateTenantRequest): Promise<Tenant>;
  removeTenant(id: string): Promise<void>;
}

export function createTenantAdminService({
  session,
}: {
  session: Session;
}): TenantAdminService {
  const fail = (status: number, body: unknown, fallback: string): Error => {
    const parts: string[] = [];
    if (typeof body === 'object' && body !== null) {
      const code = (body as {code?: unknown}).code;
      const message = (body as {message?: unknown}).message;
      if (code) parts.push(String(code));
      if (message) parts.push(String(message));
    }
    return new Error(parts.join('：') || fallback);
  };

  const headers = (): RequestInit => ({headers: session.authHeaders()});

  return {
    async listTenants(params) {
      const response = await adminTenantsListTenants(params, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `租户列表失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async createTenant(request) {
      const response = await adminTenantsCreateTenant(request, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `创建租户失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async getTenant(id) {
      const response = await adminTenantsGetTenant(id, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `租户详情失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async updateTenant(id, request) {
      const response = await adminTenantsUpdateTenant(id, request, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `更新租户失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async removeTenant(id) {
      const response = await adminTenantsDeleteTenant(id, headers());
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `删除租户失败（HTTP ${response.status}）`,
        );
      }
    },
  };
}
