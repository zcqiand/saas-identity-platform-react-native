/**
 * 租户角色视图派生（REQ-2026-036 S-T4 / M00.F03）。
 *
 * 纯函数零依赖：行视图、创建/更新载荷装配（fail-fast 校验）。
 * 约束来自契约（roleCode/roleName 1-64）。
 */
import type {
  CreateSysRoleRequest,
  TenantRolesListSysRoles200,
  UpdateSysRoleRequest,
} from '../../api/endpoints/model';

export interface RoleRowView {
  id: string;
  code: string;
  name: string;
  preset: boolean;
}

export interface CreateRoleFormInput {
  clientId: string;
  roleCode: string;
  roleName: string;
  description?: string;
}

export interface UpdateRoleFormInput {
  roleName?: string;
  description?: string;
}

export function buildRoleRows(page: TenantRolesListSysRoles200): RoleRowView[] {
  return page.items.map(role => ({
    id: role.id,
    code: role.roleCode,
    name: role.roleName,
    preset: role.isPreset,
  }));
}

export function assembleCreateRoleBody(input: CreateRoleFormInput): CreateSysRoleRequest {
  const roleCode = input.roleCode.trim();
  const roleName = input.roleName.trim();
  if (roleCode.length < 1 || roleCode.length > 64) {
    throw new Error(`roleCode 需 1-64 字符（收到 ${roleCode.length}）`);
  }
  if (roleName.length < 1 || roleName.length > 64) {
    throw new Error(`roleName 需 1-64 字符（收到 ${roleName.length}）`);
  }
  if (!input.clientId.trim()) {
    throw new Error('clientId 缺失——角色必须落在租户×client 作用域');
  }
  return {
    clientId: input.clientId.trim(),
    roleCode,
    roleName,
    description: input.description,
  };
}

export function assembleUpdateRoleBody(patch: UpdateRoleFormInput): UpdateSysRoleRequest {
  const body: UpdateSysRoleRequest = {};
  if (patch.roleName !== undefined) {
    const roleName = patch.roleName.trim();
    if (roleName.length < 1 || roleName.length > 64) {
      throw new Error(`roleName 需 1-64 字符（收到 ${roleName.length}）`);
    }
    body.roleName = roleName;
  }
  if (patch.description !== undefined) {
    body.description = patch.description;
  }
  if (Object.keys(body).length === 0) {
    throw new Error('更新载荷为空——至少给出 roleName 或 description');
  }
  return body;
}
