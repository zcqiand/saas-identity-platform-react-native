/**
 * 租户成员视图派生（REQ-2026-036 S-T3 / M00.F02）。
 *
 * 纯函数零依赖：行视图、创建/更新/邀请载荷装配（fail-fast 校验）、
 * 成员状态四态文案。约束来自契约（username 1-64 / password 8-256）。
 */
import type {
  CreateSysUserRequest,
  TenantMembersInviteTenantUserBody,
  TenantMembersListTenantUsers200,
  TenantMemberStatus,
  UpdateSysUserRequest,
} from '../../api/endpoints/model';

export interface MemberRowView {
  id: string;
  username: string;
  email?: string;
  status: TenantMemberStatus;
  roleCount: number;
}

export interface CreateMemberFormInput {
  username: string;
  password: string;
  email?: string;
  mobile?: string;
}

export interface UpdateMemberFormInput {
  email?: string;
  mobile?: string;
}

export interface InviteMemberFormInput {
  email?: string;
  mobile?: string;
}

export function buildMemberRows(page: TenantMembersListTenantUsers200): MemberRowView[] {
  return page.items.map(member => ({
    id: member.id,
    username: member.username,
    email: member.email,
    status: member.status,
    roleCount: member.roleIds.length,
  }));
}

export function assembleCreateMemberBody(
  input: CreateMemberFormInput,
): CreateSysUserRequest {
  const username = input.username.trim();
  const password = input.password;
  if (username.length < 1 || username.length > 64) {
    throw new Error(`username 需 1-64 字符（收到 ${username.length}）`);
  }
  if (password.length < 8 || password.length > 256) {
    throw new Error(`password 需 8-256 字符（收到 ${password.length}）`);
  }
  return {username, password, email: input.email, mobile: input.mobile};
}

export function assembleUpdateMemberBody(
  patch: UpdateMemberFormInput,
): UpdateSysUserRequest {
  const body: UpdateSysUserRequest = {};
  if (patch.email !== undefined) {
    body.email = patch.email.trim();
  }
  if (patch.mobile !== undefined) {
    body.mobile = patch.mobile.trim();
  }
  if (Object.keys(body).length === 0) {
    throw new Error('更新载荷为空——至少给出 email 或 mobile');
  }
  return body;
}

export function assembleInviteBody(
  patch: InviteMemberFormInput,
): TenantMembersInviteTenantUserBody {
  const email = patch.email?.trim();
  const mobile = patch.mobile?.trim();
  if (!email && !mobile) {
    throw new Error('邀请目标缺失——email 与 mobile 至少给一个');
  }
  return {email, mobile};
}

export function memberStatusLabel(status: TenantMemberStatus): string {
  if (status === 'active') return '启用中';
  if (status === 'invited') return '已邀请';
  if (status === 'suspended') return '已停用';
  if (status === 'disabled') return '已禁用';
  return status;
}
