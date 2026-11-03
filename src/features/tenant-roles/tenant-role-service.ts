/**
 * 租户角色 + 角色权限消费编排（REQ-2026-036 S-T4 / M00.F03.I01-I05, M00.F04.I02-I04）。
 *
 * tenantId 取会话 currentTenantId（缺则 fail-fast，禁兜底字面量——ADR-0019）；
 * 错误统一归一 `code：message` 形。M00.F04.I01 权限矩阵绑定已废弃不消费。
 */
import type {
  CreateSysRoleRequest,
  RoleMenuGrant,
  SysRole,
  TenantRolesListSysRoles200,
  TenantRolesListSysRolesParams,
  UpdateSysRoleRequest,
} from '../../api/endpoints/model';
import {
  tenantRolesListSysRoles,
  tenantRolesCreateSysRole,
  tenantRolesGetSysRole,
  tenantRolesUpdateSysRole,
  tenantRolesDeleteSysRole,
} from '../../api/endpoints/tenant-roles/tenant-roles';
import {
  tenantRoleMenusListSysRoleMenus,
  tenantRoleMenusSetSysRoleMenus,
  tenantRoleMenusClearSysRoleMenus,
} from '../../api/endpoints/tenant-role-menus/tenant-role-menus';
import type {Session} from '../../session/session';

export interface TenantRoleService {
  listRoles(params?: TenantRolesListSysRolesParams): Promise<TenantRolesListSysRoles200>;
  createRole(request: CreateSysRoleRequest): Promise<SysRole>;
  getRole(roleId: string): Promise<SysRole>;
  updateRole(roleId: string, request: UpdateSysRoleRequest): Promise<SysRole>;
  removeRole(roleId: string): Promise<void>;
  getRoleMenus(roleId: string): Promise<RoleMenuGrant>;
  setRoleMenus(roleId: string, menuIds: string[]): Promise<RoleMenuGrant>;
  clearRoleMenus(roleId: string): Promise<void>;
}

export function createTenantRoleService({
  session,
}: {
  session: Session;
}): TenantRoleService {
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

  const tenantId = (): string => {
    const current = session.snapshot()?.currentTenantId;
    if (!current) {
      throw new Error('currentTenantId 缺失——先登录并选定租户，再消费角色面');
    }
    return current;
  };

  const headers = (): RequestInit => ({headers: session.authHeaders()});

  return {
    async listRoles(params) {
      const response = await tenantRolesListSysRoles(tenantId(), params, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `角色列表失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async createRole(request) {
      const response = await tenantRolesCreateSysRole(tenantId(), request, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `创建角色失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async getRole(roleId) {
      const response = await tenantRolesGetSysRole(tenantId(), roleId, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `角色详情失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async updateRole(roleId, request) {
      const response = await tenantRolesUpdateSysRole(
        tenantId(),
        roleId,
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `更新角色失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async removeRole(roleId) {
      const response = await tenantRolesDeleteSysRole(tenantId(), roleId, headers());
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `删除角色失败（HTTP ${response.status}）`,
        );
      }
    },

    async getRoleMenus(roleId) {
      const response = await tenantRoleMenusListSysRoleMenus(
        tenantId(),
        roleId,
        undefined,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `角色菜单查询失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async setRoleMenus(roleId, menuIds) {
      const response = await tenantRoleMenusSetSysRoleMenus(
        tenantId(),
        roleId,
        {menuIds},
        undefined,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `设置角色菜单失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async clearRoleMenus(roleId) {
      const response = await tenantRoleMenusClearSysRoleMenus(
        tenantId(),
        roleId,
        undefined,
        headers(),
      );
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `清空角色菜单失败（HTTP ${response.status}）`,
        );
      }
    },
  };
}
