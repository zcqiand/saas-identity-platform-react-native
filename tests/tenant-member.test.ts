/**
 * 租户成员消费面（REQ-2026-036 S-T3；七个 op 锚点见各 fnTest）。
 *
 * stub 配方照 tenant-admin：假 Response 字面量 + calls 转写，不触真实网络
 * 与原生模块；tenantId 取自会话 currentTenantId（缺则 fail-fast，禁兜底）。
 * I07 接受邀请 BASE 侧规划中无生成端点，不在本片（REQ 注记）。
 */
import {fnTest} from './fn';

import {createTenantMemberService} from '../src/features/tenant-members/tenant-member-service';
import {
  buildMemberRows,
  assembleCreateMemberBody,
  assembleUpdateMemberBody,
  assembleInviteBody,
  memberStatusLabel,
} from '../src/features/tenant-members/tenant-member-view';
import {createSession} from '../src/session/session';
import type {TenantMemberUserView} from '../src/api/endpoints/model';

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

const MEMBERS: TenantMemberUserView[] = [
  {
    id: 'u-2',
    tenantId: 't-acme',
    username: 'bob',
    email: 'bob@acme.local',
    status: 'active',
    roleIds: ['r-1'],
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'u-3',
    tenantId: 't-acme',
    username: 'carol',
    status: 'invited',
    roleIds: [],
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
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

function booted(): ReturnType<typeof createTenantMemberService> {
  const session = createSession();
  session.applyLogin(LOGIN_RESPONSE);
  return createTenantMemberService({session});
}

fnTest(['M00.F02.I01'], '成员列表分页消费（0 基首页），行视图派生', async () => {
  const members = booted();
  stubFetch(() => ({
    status: 200,
    body: {items: MEMBERS, page: 0, pageSize: 20, total: 5},
  }));

  const page = await members.listMembers({page: 0, pageSize: 20});
  const last = calls.at(-1);
  expect(last?.url).toContain('/tenants/t-acme/members');
  expect(last?.url).toContain('page=0');
  expect(last?.url).toContain('pageSize=20');
  expect(page.total).toBe(5);

  const rows = buildMemberRows(page);
  expect(rows[0]).toMatchObject({username: 'bob', roleCount: 1});
  expect(rows[1]).toMatchObject({username: 'carol'});
  expect(memberStatusLabel(rows[1].status)).toBe('已邀请');

  // 无会话租户上下文 → fail-fast（禁兜底字面量）
  const bare = createTenantMemberService({session: createSession()});
  await expect(bare.listMembers()).rejects.toThrow(/currentTenantId/);
});

fnTest(['M00.F02.I02'], '创建成员装配 fail-fast + POST；409 分流', async () => {
  expect(() => assembleCreateMemberBody({username: '', password: 'x12345678'})).toThrow(
    /username/,
  );
  expect(() => assembleCreateMemberBody({username: 'bob', password: 'short'})).toThrow(
    /password/,
  );

  const body = assembleCreateMemberBody({
    username: 'bob',
    password: 'bob12345678',
    email: 'bob@acme.local',
  });
  expect(body).toEqual({
    username: 'bob',
    password: 'bob12345678',
    email: 'bob@acme.local',
  });

  const members = booted();
  stubFetch(() => ({status: 200, body: MEMBERS[0]}));

  const created = await members.createMember(body);
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/tenants/t-acme/members');
  expect(JSON.parse(String(last?.init?.body))).toEqual(body);
  expect(created.username).toBe('bob');
  expect(created.roleIds).toEqual(['r-1']);

  stubFetch(() => ({status: 409, body: {code: 'MEMBER_EXISTS', message: ''}}));
  await expect(members.createMember(body)).rejects.toThrow('MEMBER_EXISTS');
});

fnTest(['M00.F02.I03'], '成员详情 GET 200；404 分流', async () => {
  const members = booted();
  stubFetch(() => ({status: 200, body: MEMBERS[1]}));

  const detail = await members.getMember('u-3');
  const last = calls.at(-1);
  expect(last?.init?.method ?? 'GET').toBe('GET');
  expect(last?.url).toContain('/tenants/t-acme/members/u-3');
  expect(detail.username).toBe('carol');
  expect(detail.status).toBe('invited');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此成员'}}));
  await expect(members.getMember('u-404')).rejects.toThrow('无此成员');
});

fnTest(['M00.F02.I04'], '更新成员装配为部分载荷 + PATCH', async () => {
  expect(() => assembleUpdateMemberBody({})).toThrow();
  expect(assembleUpdateMemberBody({email: 'new@acme.local'})).toEqual({
    email: 'new@acme.local',
  });
  expect(assembleUpdateMemberBody({mobile: '13800000000'})).toEqual({
    mobile: '13800000000',
  });

  const members = booted();
  stubFetch(() => ({status: 200, body: {...MEMBERS[0], email: 'new@acme.local'}}));

  const updated = await members.updateMember('u-2', {email: 'new@acme.local'});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/tenants/t-acme/members/u-2');
  expect(updated.email).toBe('new@acme.local');
});

fnTest(['M00.F02.I05'], '删除成员 DELETE 204；404 分流', async () => {
  const members = booted();
  stubFetch(() => ({status: 204}));

  await expect(members.removeMember('u-2')).resolves.toBeUndefined();
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('DELETE');
  expect(last?.url).toContain('/tenants/t-acme/members/u-2');

  stubFetch(() => ({status: 404, body: {code: 'NOT_FOUND', message: '无此成员'}}));
  await expect(members.removeMember('u-404')).rejects.toThrow('无此成员');
});

fnTest(['M00.F02.I06'], '邀请成员装配 + POST invitations；409 分流', async () => {
  expect(() => assembleInviteBody({})).toThrow(/email/);
  expect(assembleInviteBody({email: 'dave@acme.local'})).toEqual({
    email: 'dave@acme.local',
  });

  const members = booted();
  stubFetch(() => ({
    status: 200,
    body: {
      member: {id: 'm-2', tenantId: 't-acme', userId: 'u-4', status: 'invited'},
      user: {...LOGIN_RESPONSE.user, id: 'u-4', username: 'dave'},
      roles: [],
    },
  }));

  const invited = await members.inviteMember({email: 'dave@acme.local'});
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('POST');
  expect(last?.url).toContain('/tenants/t-acme/members/invitations');
  expect(JSON.parse(String(last?.init?.body))).toEqual({email: 'dave@acme.local'});
  expect(invited.member.status).toBe('invited');

  stubFetch(() => ({status: 409, body: {code: 'ALREADY_MEMBER', message: ''}}));
  await expect(members.inviteMember({email: 'dave@acme.local'})).rejects.toThrow(
    'ALREADY_MEMBER',
  );
});

fnTest(['M00.F02.I08'], '状态切换 PATCH status + 文案四态', async () => {
  expect(memberStatusLabel('active')).toBe('启用中');
  expect(memberStatusLabel('invited')).toBe('已邀请');
  expect(memberStatusLabel('suspended')).toBe('已停用');
  expect(memberStatusLabel('disabled')).toBe('已禁用');

  const members = booted();
  stubFetch(() => ({status: 200, body: {...MEMBERS[0], status: 'suspended'}}));

  const updated = await members.changeMemberStatus('u-2', 'suspended');
  const last = calls.at(-1);
  expect(last?.init?.method).toBe('PATCH');
  expect(last?.url).toContain('/tenants/t-acme/members/u-2/status');
  expect(JSON.parse(String(last?.init?.body))).toEqual({status: 'suspended'});
  expect(updated.status).toBe('suspended');
});
