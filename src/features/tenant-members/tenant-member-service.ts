/**
 * 租户成员消费编排（REQ-2026-036 S-T3 / M00.F02.I01-I06,I08）。
 *
 * tenantId 取会话 currentTenantId（缺则 fail-fast，禁兜底字面量——ADR-0019）；
 * 错误统一归一 `code：message` 形。I07 接受邀请 BASE 侧规划中无生成端点，不在本片。
 */
import type {
  CreateSysUserRequest,
  TenantMemberUserView,
  TenantMemberView,
  TenantMembersChangeTenantUserStatusBody,
  TenantMembersInviteTenantUserBody,
  TenantMembersListTenantUsers200,
  TenantMembersListTenantUsersParams,
  TenantMemberStatus,
  UpdateSysUserRequest,
} from '../../api/endpoints/model';
import {
  tenantMembersListTenantUsers,
  tenantMembersCreateTenantUser,
  tenantMembersGetTenantUser,
  tenantMembersUpdateTenantUser,
  tenantMembersDeleteTenantUser,
  tenantMembersInviteTenantUser,
  tenantMembersChangeTenantUserStatus,
} from '../../api/endpoints/tenant-members/tenant-members';
import type {Session} from '../../session/session';

export interface TenantMemberService {
  listMembers(
    params?: TenantMembersListTenantUsersParams,
  ): Promise<TenantMembersListTenantUsers200>;
  createMember(request: CreateSysUserRequest): Promise<TenantMemberUserView>;
  getMember(userId: string): Promise<TenantMemberUserView>;
  updateMember(
    userId: string,
    request: UpdateSysUserRequest,
  ): Promise<TenantMemberUserView>;
  removeMember(userId: string): Promise<void>;
  inviteMember(body: TenantMembersInviteTenantUserBody): Promise<TenantMemberView>;
  changeMemberStatus(
    userId: string,
    status: TenantMemberStatus,
  ): Promise<TenantMemberUserView>;
}

export function createTenantMemberService({
  session,
}: {
  session: Session;
}): TenantMemberService {
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
      throw new Error('currentTenantId 缺失——先登录并选定租户，再消费成员面');
    }
    return current;
  };

  const headers = (): RequestInit => ({headers: session.authHeaders()});

  return {
    async listMembers(params) {
      const response = await tenantMembersListTenantUsers(tenantId(), params, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `成员列表失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async createMember(request) {
      const response = await tenantMembersCreateTenantUser(
        tenantId(),
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `创建成员失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async getMember(userId) {
      const response = await tenantMembersGetTenantUser(tenantId(), userId, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `成员详情失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async updateMember(userId, request) {
      const response = await tenantMembersUpdateTenantUser(
        tenantId(),
        userId,
        request,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `更新成员失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async removeMember(userId) {
      const response = await tenantMembersDeleteTenantUser(tenantId(), userId, headers());
      if (response.status !== 204) {
        throw fail(
          response.status,
          response.data,
          `删除成员失败（HTTP ${response.status}）`,
        );
      }
    },

    async inviteMember(body) {
      const response = await tenantMembersInviteTenantUser(tenantId(), body, headers());
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `邀请成员失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },

    async changeMemberStatus(userId, status) {
      const payload: TenantMembersChangeTenantUserStatusBody = {status};
      const response = await tenantMembersChangeTenantUserStatus(
        tenantId(),
        userId,
        payload,
        headers(),
      );
      if (response.status !== 200) {
        throw fail(
          response.status,
          response.data,
          `状态切换失败（HTTP ${response.status}）`,
        );
      }
      return response.data;
    },
  };
}
