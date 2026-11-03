/**
 * 租户应用订阅 + 菜单管理消费面（REQ-2026-036 S-T5；锚点见各 fnTest）。
 *
 * stub 配方照 tenant-role：假 Response 字面量 + calls 转写；tenantId 取会话
 * currentTenantId（缺则 fail-fast），clientId 是消费面主语、显式传参。
 * 菜单 list/reorder 返回 SysMenu[]（非分页）；me/menus 返回按 clientId 键的记录。
 */
import {fnTest} from './fn';

import {createTenantAppMenuService} from '../src/features/app-menu/app-menu-service';
import {
  buildApplicationRows,
  assembleSubscribeBody,
  buildMenuRows,
  assembleCreateMenuBody,
  assembleUpdateMenuBody,
  buildEffectiveMenuTitles,
} from '../src/features/app-menu/app-menu-view';
import {createSession} from '../src/session/session';
import type {SysMenu, TenantApplication} from '../src/api/endpoints/model';

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

const APPS: TenantApplication[] = [
  {
    id: 'ta-1',
    tenantId: 't-acme',
    clientId: 'saas-console',
    status: 1,
    expireTime: '2027-01-01T00:00:00Z',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'ta-2',
    tenantId: 't-acme',
    clientId: 'lab-management',
    status: 0,
    createdAt: '2026-01-06T00:00:00Z',
  },
];

const MENUS: SysMenu[] = [
  {
    id: 'm-1',
    clientId: 'saas-console',
    parentId: '',
    title: '租户管理',
    type: 'directory',
    sortOrder: 1,
    status: 1,
    createdAt: '2026-01-07T00:00:00Z',
  },
  {
    id: 'm-2',
    clientId: 'saas-console',
    parentId: 'm-1',
    title: '租户维护',
    type: 'menu',
    path: '/tenants',
    sortOrder: 1,
    status: 1,
    createdAt: '2026-01-07T00:00:00Z',
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

function booted(): ReturnType<typeof createTenantAppMenuService> {
  const session = createSession();
  session.applyLogin(LOGIN_RESPONSE);
  return createTenantAppMenuService({session});
}

fnTest(['M00.F05.I01'], '租户应用列表分页消费（0 基首页），行视图派生', async () => {
  const svc = booted();
  stubFetch(() => ({
    status: 200,
    body: {items: APPS, page: 0, pageSize: 20, total: 3},
  }));

  const page = await svc.listApplications({page: 0, pageSize: 20});
  const last = calls.at(-1);
  expect(last?.url).toContain('/tenants/t-acme/applications');
  expect(last?.url).toContain('page=0');
  expect(page.total).toBe(3);

  const rows = buildApplicationRows(page);
  expect(rows[0]).toMatchObject({
    clientId: 'saas-console',
    expireTime: '2027-01-01T00:00:00Z',
  });
  expect(rows[1].clientId).toBe('lab-management');

  const bare = createTenantAppMenuService({session: createSession()});
  await expect(bare.listApplications()).rejects.toThrow(/currentTenantId/);
});

fnTest(['M00.F05.I02'], '订阅应用装配 fail-fast + POST；409 分流', async () => {
  expect(() => assembleSubscribeBody({clientId: ''})).toThrow(/clientId/);

  const body = assembleSubscribeBody({clientId: 'lab-management'});
  expect(body).toEqual({clientId: 'lab-management'});

  const svc = booted();
  stubFetch(() => ({status: 200, body: APPS[1]}));

  const sub = await svc.subscribeApplication(body);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/tenants/t-acme/applications');
  expect(JSON.parse(String(last?.init?.body))).toEqual(body);
  expect(sub.clientId).toBe('lab-management');

  stubFetch(() => ({status: 409, body: {code: 'ALREADY_SUBSCRIBED', message: ''}}));
  await expect(svc.subscribeApplication(body)).rejects.toThrow('ALREADY_SUBSCRIBED');
});

fnTest(['M00.F05.I03'], '更新应用订阅（状态必填 number）200 回读', async () => {
  const svc = booted();
  stubFetch(() => ({status: 200, body: {...APPS[1], status: 1}}));

  const updated = await svc.updateSubscription('lab-management', {status: 1});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/tenants/t-acme/applications/lab-management');
  expect(JSON.parse(String(last?.init?.body))).toEqual({status: 1});
  expect(updated.status).toBe(1);

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '未订阅'}}));
  await expect(svc.updateSubscription('nope', {status: 1})).rejects.toThrow('未订阅');
});

fnTest(['M00.F05.I04'], '移除应用订阅 DELETE 204；404 分流', async () => {
  const svc = booted();
  stubFetch(() => ({status: 204}));

  await expect(svc.removeSubscription('lab-management')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/tenants/t-acme/applications/lab-management');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '未订阅'}}));
  await expect(svc.removeSubscription('nope')).rejects.toThrow('未订阅');
});

fnTest(['M04.F04.I01'], '菜单列表消费（数组非分页），行视图派生', async () => {
  const svc = booted();
  stubFetch(() => ({status: 200, body: MENUS}));

  const menus = await svc.listMenus('saas-console');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/clients/saas-console/menus');
  expect(menus).toHaveLength(2);

  const rows = buildMenuRows(menus);
  expect(rows[0]).toMatchObject({id: 'm-1', title: '租户管理', parent: ''});
  expect(rows[1]).toMatchObject({id: 'm-2', parent: 'm-1'});
});

fnTest(['M04.F04.I02'], '创建菜单装配 fail-fast + POST；409 分流', async () => {
  expect(() => assembleCreateMenuBody({title: '', type: 'menu'})).toThrow(/title/);

  const body = assembleCreateMenuBody({
    title: '角色管理',
    type: 'menu',
    parentId: 'm-1',
    path: '/roles',
  });
  expect(body).toEqual({
    title: '角色管理',
    type: 'menu',
    parentId: 'm-1',
    path: '/roles',
  });

  const svc = booted();
  stubFetch(() => ({status: 200, body: {...MENUS[1], id: 'm-3', title: '角色管理'}}));

  const created = await svc.createMenu('saas-console', body);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/clients/saas-console/menus');
  expect(JSON.parse(String(last?.init?.body))).toEqual(body);
  expect(created.id).toBe('m-3');

  stubFetch(() => ({status: 409, body: {code: 'MENU_EXISTS', message: ''}}));
  await expect(svc.createMenu('saas-console', body)).rejects.toThrow('MENU_EXISTS');
});

fnTest(['M04.F04.I03'], '菜单详情 GET 200；404 分流', async () => {
  const svc = booted();
  stubFetch(() => ({status: 200, body: MENUS[1]}));

  const detail = await svc.getMenu('saas-console', 'm-2');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/clients/saas-console/menus/m-2');
  expect(detail.title).toBe('租户维护');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此菜单'}}));
  await expect(svc.getMenu('saas-console', 'm-404')).rejects.toThrow('无此菜单');
});

fnTest(['M04.F04.I04'], '更新菜单装配为部分载荷 + PATCH', async () => {
  expect(() => assembleUpdateMenuBody({})).toThrow();
  expect(assembleUpdateMenuBody({title: '新名'})).toEqual({title: '新名'});
  expect(assembleUpdateMenuBody({icon: 'gear'})).toEqual({icon: 'gear'});

  const svc = booted();
  stubFetch(() => ({status: 200, body: {...MENUS[1], title: '新名'}}));

  const updated = await svc.updateMenu('saas-console', 'm-2', {title: '新名'});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/clients/saas-console/menus/m-2');
  expect(updated.title).toBe('新名');
});

fnTest(['M04.F04.I05'], '删除菜单 DELETE 204；409 分流', async () => {
  const svc = booted();
  stubFetch(() => ({status: 204}));

  await expect(svc.deleteMenu('saas-console', 'm-2')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/clients/saas-console/menus/m-2');

  stubFetch(() => ({status: 409, body: {code: 'MENU_HAS_CHILDREN', message: ''}}));
  await expect(svc.deleteMenu('saas-console', 'm-2')).rejects.toThrow(
    'MENU_HAS_CHILDREN',
  );
});

fnTest(['M04.F04.I06'], '同级排序 PUT orderedMenuIds；回读全列表', async () => {
  const svc = booted();
  stubFetch(() => ({status: 200, body: [MENUS[1], MENUS[0]]}));

  const ordered = await svc.reorderMenus('saas-console', 'm-1', ['m-2', 'm-1']);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PUT');
  expect(last?.url).toContain('/clients/saas-console/menus/m-1/reorder');
  expect(JSON.parse(String(last?.init?.body))).toEqual({orderedMenuIds: ['m-2', 'm-1']});
  expect(ordered[0].id).toBe('m-2');
});

fnTest(['M04.F04.I07'], '切换父级 PATCH parent；回读菜单', async () => {
  const svc = booted();
  stubFetch(() => ({status: 200, body: {...MENUS[1], parentId: 'm-9'}}));

  const moved = await svc.moveMenu('saas-console', 'm-2', {parentId: 'm-9'});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/clients/saas-console/menus/m-2/parent');
  expect(JSON.parse(String(last?.init?.body))).toEqual({parentId: 'm-9'});
  expect(moved.parentId).toBe('m-9');
});

fnTest(['M04.F04.I08'], '当前用户有效菜单（按 clientId 键记录）标题拍平', async () => {
  const svc = booted();
  stubFetch(() => ({
    status: 200,
    body: {
      'saas-console': [
        {
          id: 'm-1',
          clientId: 'saas-console',
          parentId: null,
          title: '租户管理',
          type: 'directory',
        },
        {
          id: 'm-2',
          clientId: 'saas-console',
          parentId: 'm-1',
          title: '租户维护',
          type: 'menu',
        },
      ],
    },
  }));

  const record = await svc.getMyMenus({clientId: 'saas-console'});
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/me/menus');
  expect(last?.url).toContain('clientId=saas-console');

  const titles = buildEffectiveMenuTitles(record, 'saas-console');
  expect(titles).toEqual(['租户管理', '租户维护']);
});
