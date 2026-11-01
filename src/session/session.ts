/**
 * 会话状态（REQ-2026-032 / M01.F01.I01, M01.F03.I01/I02, M01.F04.I01/I06）。
 *
 * SessionState + 可注入 TokenStore（harmonyos SessionState/MemoryTokenStore 同构）：
 * store 只定契约，内存版是骨架期缺省；持久化（AsyncStorage 等）Phase 1+ 接真机时
 * 另立实现注入，本文件不改契约。
 */
import type {
  CurrentUser,
  LoginResponse,
  SwitchTenantResponse,
  TenantMembership,
} from '../api/endpoints/model';

export interface SessionSnapshot {
  accessToken?: string;
  refreshToken?: string;
  user?: CurrentUser;
  currentTenantId?: string;
  availableTenants: TenantMembership[];
}

export interface TokenStore {
  load(): SessionSnapshot | null;
  save(snapshot: SessionSnapshot): void;
  clear(): void;
}

export class MemoryTokenStore implements TokenStore {
  private snapshot: SessionSnapshot | null = null;

  load(): SessionSnapshot | null {
    return this.snapshot;
  }

  save(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;
  }

  clear(): void {
    this.snapshot = null;
  }
}

export interface Session {
  snapshot(): SessionSnapshot | null;
  applyLogin(response: LoginResponse): void;
  setIdentity(user: CurrentUser): void;
  applyTenantSwitch(tenantId: string, response: SwitchTenantResponse): void;
  clear(): void;
  authHeaders(): Record<string, string>;
}

export function createSession(store: TokenStore = new MemoryTokenStore()): Session {
  const persist = (patch: Partial<SessionSnapshot> | null): void => {
    if (patch === null) {
      store.clear();
      return;
    }
    const current = store.load();
    store.save({...current, ...patch} as SessionSnapshot);
  };

  return {
    snapshot: () => store.load(),

    applyLogin(response: LoginResponse): void {
      persist({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        currentTenantId: response.currentTenantId,
        availableTenants: response.availableTenants,
      });
    },

    setIdentity(user: CurrentUser): void {
      persist({user, currentTenantId: user.currentTenantId});
    },

    applyTenantSwitch(tenantId: string, response: SwitchTenantResponse): void {
      persist({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        currentTenantId: response.tenantId ?? tenantId,
      });
    },

    clear(): void {
      persist(null);
    },

    authHeaders(): Record<string, string> {
      const token = store.load()?.accessToken;
      if (!token) {
        throw new Error(
          '未登录：无 token 不得发鉴权请求（fail-fast，suite-hard-rules §1）',
        );
      }
      return {Authorization: `Bearer ${token}`};
    },
  };
}
