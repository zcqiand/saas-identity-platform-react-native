/**
 * 租户应用订阅 + 菜单管理消费编排（REQ-2026-036 S-T5 / M00.F05.I01-I04, M04.F04.I01-I08）。
 *
 * tenantId 取会话 currentTenantId（缺则 fail-fast——ADR-0019）；clientId 是消费面
 * 主语、显式传参。错误统一归一 `code：message` 形。
 */
import type {
  CreateSysMenuRequest,
  ClientMenusMoveSysMenuBody,
  MeGetMyMenusParams,
  SysMenu,
  TenantApplication,
  TenantApplicationsListTenantApplications200,
  TenantApplicationsListTenantApplicationsParams,
  SubscribeTenantApplicationRequest,
  UpdateSysMenuRequest,
  UpdateTenantApplicationRequest,
} from '../../api/endpoints/model';
import {
  tenantApplicationsListTenantApplications,
  tenantApplicationsSubscribeTenantApplication,
  tenantApplicationsUpdateTenantApplication,
  tenantApplicationsRemoveTenantApplication,
} from '../../api/endpoints/tenant-applications/tenant-applications';
import {
  clientMenusListSysMenus,
  clientMenusCreateSysMenu,
  clientMenusGetSysMenu,
  clientMenusUpdateSysMenu,
  clientMenusDeleteSysMenu,
  clientMenusReorderSysMenus,
  clientMenusMoveSysMenu,
} from '../../api/endpoints/client-menus/client-menus';
import {meGetMyMenus} from '../../api/endpoints/me/me';
import type {Session} from '../../session/session';

export interface TenantAppMenuService {
  listApplications(
    params?: TenantApplicationsListTenantApplicationsParams,
  ): Promise<TenantApplicationsListTenantApplications200>;
  subscribeApplication(
    request: SubscribeTenantApplicationRequest,
  ): Promise<TenantApplication>;
  updateSubscription(
    clientId: string,
    request: UpdateTenantApplicationRequest,
  ): Promise<TenantApplication>;
  removeSubscription(clientId: string): Promise<void>;
  listMenus(clientId: string): Promise<SysMenu[]>;
  createMenu(clientId: string, request: CreateSysMenuRequest): Promise<SysMenu>;
  getMenu(clientId: string, menuId: string): Promise<SysMenu>;
  updateMenu(
    clientId: string,
    menuId: string,
    request: UpdateSysMenuRequest,
  ): Promise<SysMenu>;
  deleteMenu(clientId: string, menuId: string): Promise<void>;
  reorderMenus(
    clientId: string,
    menuId: string,
    orderedMenuIds: string[],
  ): Promise<SysMenu[]>;
  moveMenu(
    clientId: string,
    menuId: string,
    body: ClientMenusMoveSysMenuBody,
  ): Promise<SysMenu>;
  getMyMenus(
    params?: MeGetMyMenusParams,
  ): Promise<{[key: string]: import('../../api/endpoints/model').EffectiveMenuNode[]}>;
}

export function createTenantAppMenuService({
  session,
}: {
  session: Session;
}): TenantAppMenuService {
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
      throw new Error('currentTenantId 缺失——先登录并选定租户，再消费应用/菜单面');
    }
    return current;
  };

  const headers = (): RequestInit => ({headers: session.authHeaders()});

  return {
    async listApplications(params) {
      const response = await tenantApplicationsListTenantApplications(
        tenantId(),
        params,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `应用列表失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async subscribeApplication(request) {
      const response = await tenantApplicationsSubscribeTenantApplication(
        tenantId(),
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `订阅应用失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async updateSubscription(clientId, request) {
      const response = await tenantApplicationsUpdateTenantApplication(
        tenantId(),
        clientId,
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `更新订阅失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async removeSubscription(clientId) {
      const response = await tenantApplicationsRemoveTenantApplication(
        tenantId(),
        clientId,
        headers(),
      );
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `移除订阅失败（HTTP ${response.status}）`,
        );
      }
    },

    async listMenus(clientId) {
      const response = await clientMenusListSysMenus(clientId, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `菜单列表失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async createMenu(clientId, request) {
      const response = await clientMenusCreateSysMenu(clientId, request, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `创建菜单失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async getMenu(clientId, menuId) {
      const response = await clientMenusGetSysMenu(clientId, menuId, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `菜单详情失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async updateMenu(clientId, menuId, request) {
      const response = await clientMenusUpdateSysMenu(
        clientId,
        menuId,
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `更新菜单失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async deleteMenu(clientId, menuId) {
      const response = await clientMenusDeleteSysMenu(clientId, menuId, headers());
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `删除菜单失败（HTTP ${response.status}）`,
        );
      }
    },

    async reorderMenus(clientId, menuId, orderedMenuIds) {
      const response = await clientMenusReorderSysMenus(
        clientId,
        menuId,
        {orderedMenuIds},
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `同级排序失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async moveMenu(clientId, menuId, body) {
      const response = await clientMenusMoveSysMenu(clientId, menuId, body, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `切换父级失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async getMyMenus(params) {
      const response = await meGetMyMenus(params, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `我的菜单失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },
  };
}
