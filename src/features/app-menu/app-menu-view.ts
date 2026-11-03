/**
 * 租户应用订阅 + 菜单管理视图派生（REQ-2026-036 S-T5 / M00.F05, M04.F04）。
 *
 * 纯函数零依赖：应用/菜单行视图、订阅/创建/更新载荷装配（fail-fast 校验）、
 * 有效菜单树标题拍平。约束来自契约（title 1-64 等）。
 */
import type {
  EffectiveMenuNode,
  CreateSysMenuRequest,
  SubscribeTenantApplicationRequest,
  SysMenu,
  SysMenuType,
  TenantApplicationsListTenantApplications200,
  UpdateSysMenuRequest,
} from '../../api/endpoints/model';

export interface ApplicationRowView {
  id: string;
  clientId: string;
  status: number;
  expireTime?: string;
}

export interface MenuRowView {
  id: string;
  title: string;
  type: SysMenuType;
  parent: string;
}

export interface SubscribeFormInput {
  clientId: string;
  expireTime?: string;
}

export interface CreateMenuFormInput {
  title: string;
  type: SysMenuType;
  parentId?: string;
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateMenuFormInput {
  title?: string;
  type?: SysMenuType;
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder?: number;
  status?: number;
}

export function buildApplicationRows(
  page: TenantApplicationsListTenantApplications200,
): ApplicationRowView[] {
  return page.items.map(app => ({
    id: app.id,
    clientId: app.clientId,
    status: app.status,
    expireTime: app.expireTime,
  }));
}

export function assembleSubscribeBody(
  input: SubscribeFormInput,
): SubscribeTenantApplicationRequest {
  const clientId = input.clientId.trim();
  if (!clientId) {
    throw new Error('clientId 缺失——订阅必须绑定应用');
  }
  return {clientId, expireTime: input.expireTime};
}

export function buildMenuRows(menus: SysMenu[]): MenuRowView[] {
  return menus.map(menu => ({
    id: menu.id,
    title: menu.title,
    type: menu.type,
    parent: menu.parentId,
  }));
}

export function assembleCreateMenuBody(input: CreateMenuFormInput): CreateSysMenuRequest {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 64) {
    throw new Error(`title 需 1-64 字符（收到 ${title.length}）`);
  }
  if (!input.type) {
    throw new Error('type 缺失——菜单必须是 directory/menu/button 之一');
  }
  return {
    title,
    type: input.type,
    parentId: input.parentId,
    path: input.path,
    component: input.component,
    perms: input.perms,
    icon: input.icon,
    sortOrder: input.sortOrder,
  };
}

export function assembleUpdateMenuBody(patch: UpdateMenuFormInput): UpdateSysMenuRequest {
  const body: UpdateSysMenuRequest = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title.length < 1 || title.length > 64) {
      throw new Error(`title 需 1-64 字符（收到 ${title.length}）`);
    }
    body.title = title;
  }
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.path !== undefined) body.path = patch.path;
  if (patch.component !== undefined) body.component = patch.component;
  if (patch.perms !== undefined) body.perms = patch.perms;
  if (patch.icon !== undefined) body.icon = patch.icon;
  if (patch.sortOrder !== undefined) body.sortOrder = patch.sortOrder;
  if (patch.status !== undefined) body.status = patch.status;
  if (Object.keys(body).length === 0) {
    throw new Error('更新载荷为空——至少给出一个可更新字段');
  }
  return body;
}

export function buildEffectiveMenuTitles(
  record: {[key: string]: EffectiveMenuNode[]},
  clientId: string,
): string[] {
  return (record[clientId] ?? []).map(node => node.title);
}
