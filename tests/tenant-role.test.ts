/**
 * 租户角色 + 角色权限消费面（REQ-2026-036 S-T4；锚点见各 fnTest）。
 *
 * stub 配方照 tenant-member：假 Response 字面量 + calls 转写；tenantId 取会话
 * currentTenantId（缺则 fail-fast）。M00.F04.I01 权限矩阵绑定已废弃（deprecated
 * §1），不消费；本片 F04 面只含菜单授权 I02/I03/I04。
 */
import {fnTest} from './fn';

import {createTenantRoleService} from '../src/features/tenant-roles/tenant-role-service';
import {
  buildRoleRows,
  assembleCreateRoleBody,
  assembleUpdateRoleBody,
} from '../src/features/tenant-roles/tenant-role-view';
import {createSession} from '../src/session/session';
import type {SysRole} from '../src/api/endpoints/model';

if (!process.env.RN_API_BASE_URL) {
  process.env.RN_API_BASE_URL = 'http://127.0.0.1:5104';
}

const LOGIN_RESPONSE = {
  user: {
    id: 'u-1',
    username: 'admin',
    email: 'admin@saas.local',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as const,
  availableTenants: [],
  userId: 'u-1',
  currentTenantId: 't-acme',
  accessToken: 'tok-admin',
  refreshToken: 'r-1',
  tokenType: 'Bearer',
  expiresIn: 3600,
  clientId: 'saas-console',
};

const ROLES: SysRole[] = [
  {
    id: 'r-1',
    tenantId: 't-acme',
    clientId: 'saas-console',
    roleCode: 'editor',
    roleName: '编辑',
    description: '内容编辑',
    isPreset: false,
    status: 1,
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  {
    id: 'r-2',
    tenantId: 't-acme',
    clientId: 'saas-console',
    roleCode: 'viewer',
    roleName: '只读',
    isPreset: true,
    status: 1,
    createdAt: '2026-01-04T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z',
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

function booted(): ReturnType<typeof createTenantRoleService> {
  const session = createSession();
  session.applyLogin(LOGIN_RESPONSE);
  return createTenantRoleService({session});
}

fnTest(['M00.F03.I01'], '角色列表分页消费（0 基首页），行视图派生', async () => {
  const roles = booted();
  stubFetch(() => ({
    status: 200,
    body: {items: ROLES, page: 0, pageSize: 20, total: 9},
  }));

  const page = await roles.listRoles({page: 0, pageSize: 20});
  const last = calls.at(-1);
  expect(last?.url).toContain('/tenants/t-acme/roles');
  expect(last?.url).toContain('page=0');
  expect(last?.url).toContain('pageSize=20');
  expect(page.total).toBe(9);

  const rows = buildRoleRows(page);
  expect(rows[0]).toMatchObject({code: 'editor', name: '编辑', preset: false});
  expect(rows[1].preset).toBe(true);

  const bare = createTenantRoleService({session: createSession()});
  await expect(bare.listRoles()).rejects.toThrow(/currentTenantId/);
});

fnTest(['M00.F03.I02'], '创建角色装配 fail-fast + POST；409 分流', async () => {
  expect(() =>
    assembleCreateRoleBody({clientId: 'saas-console', roleCode: '', roleName: '编辑'}),
  ).toThrow(/roleCode/);
  expect(() =>
    assembleCreateRoleBody({clientId: 'saas-console', roleCode: 'editor', roleName: ''}),
  ).toThrow(/roleName/);

  const body = assembleCreateRoleBody({
    clientId: 'saas-console',
    roleCode: 'editor',
    roleName: '编辑',
    description: '内容编辑',
  });
  expect(body).toEqual({
    clientId: 'saas-console',
    roleCode: 'editor',
    roleName: '编辑',
    description: '内容编辑',
  });

  const roles = booted();
  stubFetch(() => ({status: 200, body: ROLES[0]}));

  const created = await roles.createRole(body);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/tenants/t-acme/roles');
  expect(JSON.parse(String(last?.init?.body))).toEqual(body);
  expect(created.roleCode).toBe('editor');

  stubFetch(() => ({status: 409, body: {code: 'ROLE_EXISTS', message: ''}}));
  await expect(roles.createRole(body)).rejects.toThrow('ROLE_EXISTS');
});

fnTest(['M00.F03.I03'], '角色详情 GET 200；404 分流', async () => {
  const roles = booted();
  stubFetch(() => ({status: 200, body: ROLES[1]}));

  const detail = await roles.getRole('r-2');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-2');
  expect(detail.roleCode).toBe('viewer');
  expect(detail.isPreset).toBe(true);

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此角色'}}));
  await expect(roles.getRole('r-404')).rejects.toThrow('无此角色');
});

fnTest(['M00.F03.I04'], '更新角色装配为部分载荷 + PATCH', async () => {
  expect(() => assembleUpdateRoleBody({})).toThrow();
  expect(assembleUpdateRoleBody({roleName: '编辑者'})).toEqual({roleName: '编辑者'});
  expect(assembleUpdateRoleBody({description: '新描述'})).toEqual({
    description: '新描述',
  });

  const roles = booted();
  stubFetch(() => ({status: 200, body: {...ROLES[0], roleName: '编辑者'}}));

  const updated = await roles.updateRole('r-1', {roleName: '编辑者'});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-1');
  expect(updated.roleName).toBe('编辑者');
});

fnTest(['M00.F03.I05'], '删除角色 DELETE 204；409 分流', async () => {
  const roles = booted();
  stubFetch(() => ({status: 204}));

  await expect(roles.removeRole('r-1')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-1');

  stubFetch(() => ({status: 409, body: {code: 'ROLE_IN_USE', message: '先清绑定'}}));
  await expect(roles.removeRole('r-1')).rejects.toThrow('ROLE_IN_USE');
});

fnTest(['M00.F04.I02'], '角色已授权菜单查询（UI 勾选回显形状）', async () => {
  const roles = booted();
  stubFetch(() => ({
    status: 200,
    body: {
      roleId: 'r-1',
      tenantId: 't-acme',
      menuIds: ['m-1', 'm-3'],
      updatedAt: '2026-02-01T00:00:00Z',
    },
  }));

  const grant = await roles.getRoleMenus('r-1');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-1/menus');
  expect(grant.menuIds).toEqual(['m-1', 'm-3']);
});

fnTest(['M00.F04.I03'], '整批设置角色菜单 PUT 全量替换；回读 grant', async () => {
  const roles = booted();
  stubFetch(() => ({
    status: 200,
    body: {
      roleId: 'r-1',
      tenantId: 't-acme',
      menuIds: ['m-2', 'm-4'],
      updatedAt: '2026-02-02T00:00:00Z',
    },
  }));

  const grant = await roles.setRoleMenus('r-1', ['m-2', 'm-4']);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PUT');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-1/menus');
  expect(JSON.parse(String(last?.init?.body))).toEqual({menuIds: ['m-2', 'm-4']});
  expect(grant.menuIds).toEqual(['m-2', 'm-4']);
});

fnTest(['M00.F04.I04'], '清空角色菜单 DELETE 204；404 分流', async () => {
  const roles = booted();
  stubFetch(() => ({status: 204}));

  await expect(roles.clearRoleMenus('r-1')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/tenants/t-acme/roles/r-1/menus');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此角色'}}));
  await expect(roles.clearRoleMenus('r-404')).rejects.toThrow('无此角色');
});
