/**
 * 登录链流程（REQ-2026-032 / 五 ID 消费面）。
 *
 * 只做编排：装配（login-form）→ orval 生成 client → 会话状态迁移（session）。
 * token 注入经 orval client 的 options.headers 通道（生成物不动的接线位），
 * mutator 手写传输层不碰业务——REQ §6 纪律。
 */
import type {CurrentUser, TenantMembership} from '../../api/endpoints/model';
import {sessionsLogin, sessionsLogout} from '../../api/endpoints/auth/auth';
import {meListMyTenants, meSwitchTenant, meWhoami} from '../../api/endpoints/me/me';
import {assembleLoginRequest, type LoginInput} from './login-form';
import type {Session} from '../../session/session';

export interface AuthService {
  login(input: Omit<LoginInput, 'clientId'>): Promise<SysUserLike>;
  whoami(): Promise<CurrentUser>;
  listMyTenants(): Promise<TenantMembership[]>;
  switchTenant(tenantId: string): Promise<void>;
  logout(): Promise<void>;
}

/** login 200 时的用户面（LoginResponse.user 是 SysUser，这里只取身份字段）。 */
interface SysUserLike {
  id: string;
  username: string;
}

export function createAuthService({
  session,
  clientId,
}: {
  session: Session;
  clientId: string;
}): AuthService {
  const fail = (status: number, body: unknown, fallback: string): Error => {
    const code =
      typeof body === 'object' && body !== null && 'code' in body
        ? String((body as {code: unknown}).code)
        : '';
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as {message: unknown}).message)
        : '';
    return new Error(message || code || `${fallback}（HTTP ${status}）`);
  };

  return {
    async login(input) {
      const request = assembleLoginRequest({...input, clientId});
      const response = await sessionsLogin(request);

      if (response.status === 200) {
        session.applyLogin(response.data);
        return {id: response.data.userId, username: response.data.user.username};
      }

      session.clear(); // 423 Locked 等失败路径清本地会话残留
      throw fail(response.status, response.data, '登录失败');
    },

    async whoami() {
      const response = await meWhoami({headers: session.authHeaders()});
      if (response.status !== 200) {
        throw fail(response.status, response.data, 'whoami 失败');
      }
      session.setIdentity(response.data);
      return response.data;
    },

    async listMyTenants() {
      const response = await meListMyTenants(undefined, {headers: session.authHeaders()});
      if (response.status !== 200) {
        throw fail(response.status, response.data, '列租户失败');
      }
      return response.data;
    },

    async switchTenant(tenantId: string) {
      const response = await meSwitchTenant(tenantId, undefined, {
        headers: session.authHeaders(),
      });
      if (response.status !== 200) {
        throw fail(response.status, response.data, '切租户失败');
      }
      session.applyTenantSwitch(tenantId, response.data);
    },

    async logout() {
      try {
        await sessionsLogout({headers: session.authHeaders()});
      } finally {
        session.clear(); // 网络失败也要清本地——本地会话不得残留
      }
    },
  };
}
