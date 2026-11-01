/**
 * 登录链流程（REQ-2026-032 T-2 / M01.F01.I01, M01.F03.I01/I02, M01.F04.I01/I06）。
 *
 * fetch 注入 stub（不触真实网络与原生模块，harmonyos 纪律同构）：
 * 断言五条流程的 URL/方法/鉴权头/会话状态迁移。
 */
import {fnTest} from './fn';

import {createAuthService} from '../src/features/auth/auth-service';
import {createSession} from '../src/session/session';
import type {LoginResponse} from '../src/api/endpoints/model';

if (!process.env.RN_API_BASE_URL) {
  process.env.RN_API_BASE_URL = 'http://127.0.0.1:5104';
}

const USER = {
  id: 'u-1',
  username: 'alice',
  email: 'alice@saas.local',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as const;

const LOGIN_RESPONSE: LoginResponse = {
  user: USER,
  availableTenants: [
    {
      id: 'm-1',
      userId: 'u-1',
      tenantId: 't-acme',
      roleIds: ['r-admin'],
      status: 'active',
      joinedAt: '2026-01-01T00:00:00Z',
    },
  ],
  userId: 'u-1',
  currentTenantId: 't-acme',
  accessToken: 'tok-1',
  refreshToken: 'r-1',
  tokenType: 'Bearer',
  expiresIn: 3600,
  clientId: 'saas-console',
};

const CURRENT_USER = {
  id: 'u-1',
  email: 'alice@saas.local',
  memberships: LOGIN_RESPONSE.availableTenants,
  currentTenantId: 't-acme',
};

interface StubReply {
  status: number;
  body?: unknown;
}

const calls: Array<{url: string; init?: RequestInit}> = [];

function stubFetch(replies: (url: string, init?: RequestInit) => StubReply): void {
  (global as {fetch: unknown}).fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    calls.push({url, init});
    const {status, body} = replies(url, init);
    return {
      ok: status < 400,
      status,
      headers: new Headers(),
      json: async () => (body === undefined ? null : body),
    } as Response;
  };
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

fnTest(['M01.F04.I01'], '登录：200 会话落地（token/用户/租户入 store）', async () => {
  stubFetch(() => ({status: 200, body: LOGIN_RESPONSE}));
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});

  const user = await auth.login({username: 'alice', password: 'dev123456'});

  expect(user.username).toBe('alice');
  const snap = session.snapshot();
  expect(snap?.accessToken).toBe('tok-1');
  expect(snap?.currentTenantId).toBe('t-acme');
  expect(snap?.availableTenants).toHaveLength(1);

  const last = calls.at(-1);
  expect(last?.url).toBe('http://127.0.0.1:5104/api/v1/auth/login');
  expect(last?.init?.method).toBe('POST');
  expect(JSON.parse(String(last?.init?.body))).toEqual({
    username: 'alice',
    password: 'dev123456',
    clientId: 'saas-console',
  });
});

fnTest(['M01.F04.I01'], '登录：423 Locked 抛错并清空本地会话残留', async () => {
  stubFetch(() => ({
    status: 423,
    body: {
      code: 'ACCOUNT_LOCKED',
      message: 'locked',
      lockedUntil: '2026-11-01T20:00:00Z',
    },
  }));
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});
  session.applyLogin(LOGIN_RESPONSE); // 预置旧会话，验证 423 清残留

  await expect(auth.login({username: 'alice', password: 'bad'})).rejects.toThrow();
  expect(session.snapshot()).toBeNull();
});

fnTest(['M01.F01.I01'], 'whoami：带 token 调 /me 并回填身份', async () => {
  stubFetch(url =>
    url.endsWith('/api/v1/me') ? {status: 200, body: CURRENT_USER} : {status: 404},
  );
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});
  session.applyLogin(LOGIN_RESPONSE);

  const me = await auth.whoami();

  expect(me.id).toBe('u-1');
  const last = calls.at(-1);
  expect(last?.url).toBe('http://127.0.0.1:5104/api/v1/me');
  expect((last?.init?.headers as Record<string, string>).Authorization).toBe(
    'Bearer tok-1',
  );
  expect(session.snapshot()?.user?.id).toBe('u-1');
});

fnTest(['M01.F01.I01'], 'whoami：无会话发鉴权请求即抛（fail-fast）', async () => {
  stubFetch(() => ({status: 401, body: {code: 'UNAUTHORIZED', message: 'no'}}));
  const auth = createAuthService({session: createSession(), clientId: 'saas-console'});

  await expect(auth.whoami()).rejects.toThrow();
  expect(calls).toHaveLength(0);
});

fnTest(['M01.F03.I01'], '列我的租户：带 token 调 /me/tenants', async () => {
  stubFetch(url =>
    url.endsWith('/api/v1/me/tenants')
      ? {status: 200, body: LOGIN_RESPONSE.availableTenants}
      : {status: 404},
  );
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});
  session.applyLogin(LOGIN_RESPONSE);

  const tenants = await auth.listMyTenants();

  expect(tenants).toHaveLength(1);
  expect(tenants[0]?.tenantId).toBe('t-acme');
  const last = calls.at(-1);
  expect(last?.url).toBe('http://127.0.0.1:5104/api/v1/me/tenants');
  expect((last?.init?.headers as Record<string, string>).Authorization).toBe(
    'Bearer tok-1',
  );
});

fnTest(['M01.F03.I02'], '切租户：更新会话租户上下文并轮换 token', async () => {
  stubFetch(url =>
    url.endsWith('/api/v1/me/tenants/t-city-lab/switch')
      ? {
          status: 200,
          body: {
            accessToken: 'tok-2',
            refreshToken: 'r-2',
            expiresAt: '2026-11-02T00:00:00Z',
            tenantId: 't-city-lab',
          },
        }
      : {status: 404},
  );
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});
  session.applyLogin(LOGIN_RESPONSE);

  await auth.switchTenant('t-city-lab');

  const snap = session.snapshot();
  expect(snap?.currentTenantId).toBe('t-city-lab');
  expect(snap?.accessToken).toBe('tok-2');
  const last = calls.at(-1);
  expect(last?.url).toBe('http://127.0.0.1:5104/api/v1/me/tenants/t-city-lab/switch');
  expect(last?.init?.method).toBe('POST');
  expect((last?.init?.headers as Record<string, string>).Authorization).toBe(
    'Bearer tok-1',
  );
});

fnTest(['M01.F04.I06'], '登出：调 /auth/logout 后本地 token/用户/租户全清', async () => {
  stubFetch(() => ({status: 204}));
  const session = createSession();
  const auth = createAuthService({session, clientId: 'saas-console'});
  session.applyLogin(LOGIN_RESPONSE);

  await auth.logout();

  expect(session.snapshot()).toBeNull();
  const last = calls.at(-1);
  expect(last?.url).toBe('http://127.0.0.1:5104/api/v1/auth/logout');
  expect(last?.init?.method).toBe('POST');
  expect((last?.init?.headers as Record<string, string>).Authorization).toBe(
    'Bearer tok-1',
  );
});
