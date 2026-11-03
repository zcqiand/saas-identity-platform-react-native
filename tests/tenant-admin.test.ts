/**
 * 租户维护消费面（REQ-2026-036 S-T2；五个 op 锚点见各 fnTest）。
 *
 * stub 配方照 auth-chain 首片：假 Response 字面量 + calls 转写，不触真实网络
 * 与原生模块；断言 URL/方法/载荷/错误分流/视图派生。saas 分页 0 基（家族指纹）。
 */
import {fnTest} from './fn';

import {createTenantAdminService} from '../src/features/admin-tenants/tenant-admin-service';
import {
  buildTenantRows,
  buildTenantDetail,
  assembleCreateTenantBody,
  assembleUpdateTenantBody,
  tenantStatusLabel,
} from '../src/features/admin-tenants/tenant-admin-view';
import {createSession} from '../src/session/session';
import type {Tenant} from '../src/api/endpoints/model';

if (!process.env.RN_API_BASE_URL) {
  process.env.RN_API_BASE_URL = 'http://127.0.0.1:5104';
}

const USER = {
  id: 'u-1',
  username: 'admin',
  email: 'admin@saas.local',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as const;

const LOGIN_RESPONSE = {
  user: USER,
  availableTenants: [],
  userId: 'u-1',
  currentTenantId: 't-acme',
  accessToken: 'tok-admin',
  refreshToken: 'r-1',
  tokenType: 'Bearer',
  expiresIn: 3600,
  clientId: 'saas-console',
};

const TENANTS: Tenant[] = [
  {
    id: 't-1',
    tenantKey: 'acme',
    name: 'Acme 有限公司',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 't-2',
    tenantKey: 'globex',
    name: 'Globex 集团',
    status: 'suspended',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-02T00:00:00Z',
  },
];

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

function booted(): ReturnType<typeof createTenantAdminService> {
  const session = createSession();
  session.applyLogin(LOGIN_RESPONSE);
  return createTenantAdminService({session});
}

fnTest(['M00.F01.I01'], '租户列表分页消费（0 基首页），行视图派生', async () => {
  const admin = booted();
  stubFetch(() => ({
    status: 200,
    body: {items: TENANTS, page: 0, pageSize: 20, total: 27},
  }));

  const page = await admin.listTenants({page: 0, pageSize: 20});
  const last = calls.at(-1);
  expect(last?.url).toContain('/admin/tenants');
  expect(last?.url).toContain('page=0');
  expect(last?.url).toContain('pageSize=20');
  expect(page.total).toBe(27);

  const rows = buildTenantRows(page);
  expect(rows[0]).toMatchObject({key: 'acme', name: 'Acme 有限公司'});
  expect(rows[1]).toMatchObject({status: 'suspended'});
  expect(tenantStatusLabel(rows[1].status)).toBe('已停用');

  // 非 200 → 抛 Error（code 优先、message 兜底）
  stubFetch(() => ({
    status: 403,
    body: {code: 'FORBIDDEN', message: '需要平台管理员'},
  }));
  await expect(admin.listTenants({page: 0})).rejects.toThrow('FORBIDDEN');
});

fnTest(['M00.F01.I02'], '创建租户装配 fail-fast + POST 200；409 分流', async () => {
  expect(() => assembleCreateTenantBody({tenantKey: 'a', name: 'Acme 有限公司'})).toThrow(
    /tenantKey/,
  );
  expect(() => assembleCreateTenantBody({tenantKey: 'acme', name: '简'})).toThrow(/name/);

  const body = assembleCreateTenantBody({tenantKey: 'acme', name: 'Acme 有限公司'});
  expect(body).toEqual({tenantKey: 'acme', name: 'Acme 有限公司'});

  const admin = booted();
  stubFetch(() => ({status: 200, body: TENANTS[0]}));

  const created = await admin.createTenant(body);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/admin/tenants');
  expect(JSON.parse(String(last?.init?.body))).toEqual(body);
  expect(created.id).toBe('t-1');

  stubFetch(() => ({status: 409, body: {code: 'TENANT_EXISTS', message: ''}}));
  await expect(admin.createTenant(body)).rejects.toThrow('TENANT_EXISTS');
});

fnTest(['M00.F01.I03'], '租户详情 GET 200；404 分流', async () => {
  const admin = booted();
  stubFetch(() => ({status: 200, body: TENANTS[1]}));

  const detail = await admin.getTenant('t-2');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/admin/tenants/t-2');

  const view = buildTenantDetail(detail);
  expect(view).toMatchObject({key: 'globex', name: 'Globex 集团'});
  expect(view.updatedAt).toBe('2026-02-02T00:00:00Z');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此租户'}}));
  await expect(admin.getTenant('t-404')).rejects.toThrow('无此租户');
});

fnTest(['M00.F01.I04'], '更新租户装配为部分载荷 + PATCH；状态翻转', async () => {
  // 空载荷禁发（fail-fast）
  expect(() => assembleUpdateTenantBody({})).toThrow();
  const patch = assembleUpdateTenantBody({name: 'Globex 新名'});
  expect(patch).toEqual({name: 'Globex 新名'});
  const flipped = assembleUpdateTenantBody({status: 'active'});
  expect(flipped).toEqual({status: 'active'});

  const admin = booted();
  stubFetch(() => ({
    status: 200,
    body: {...TENANTS[1], name: 'Globex 新名', status: 'active'},
  }));

  const updated = await admin.updateTenant('t-2', patch);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/admin/tenants/t-2');
  expect(updated.status).toBe('active');
  expect(tenantStatusLabel(updated.status)).toBe('启用中');
});

fnTest(['M00.F01.I05'], '删除租户 DELETE 204；409 业务拒绝分流', async () => {
  const admin = booted();
  stubFetch(() => ({status: 204}));

  await expect(admin.removeTenant('t-2')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/admin/tenants/t-2');

  stubFetch(() => ({
    status: 409,
    body: {code: 'TENANT_HAS_MEMBERS', message: '先清成员'},
  }));
  await expect(admin.removeTenant('t-2')).rejects.toThrow('TENANT_HAS_MEMBERS');
});
