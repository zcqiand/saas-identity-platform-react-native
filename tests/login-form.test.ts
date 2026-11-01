/**
 * 登录入参装配（REQ-2026-032 T-2 / M01.F04.I01）。
 *
 * 纯函数装配 + fail-fast 校验，不发请求——网络面归 auth-chain.test.ts。
 * 照 harmonyos RoleForms 同构纪律：只测纯函数，不触原生模块。
 */
import {fnTest} from './fn';

import {assembleLoginRequest} from '../src/features/auth/login-form';

fnTest(['M01.F04.I01'], '登录入参装配：三要素齐全产出契约形状 LoginRequest', () => {
  const req = assembleLoginRequest({
    username: 'alice',
    password: 'dev123456',
    clientId: 'saas-console',
  });

  expect(req).toEqual({
    username: 'alice',
    password: 'dev123456',
    clientId: 'saas-console',
  });
});

fnTest(
  ['M01.F04.I01'],
  '登录入参装配：username/password/clientId 缺失或空白即抛（fail-fast）',
  () => {
    expect(() =>
      assembleLoginRequest({
        username: '',
        password: 'dev123456',
        clientId: 'saas-console',
      }),
    ).toThrow();
    expect(() =>
      assembleLoginRequest({username: 'alice', password: '', clientId: 'saas-console'}),
    ).toThrow();
    expect(() =>
      assembleLoginRequest({username: 'alice', password: 'dev123456', clientId: ''}),
    ).toThrow();
    expect(() =>
      assembleLoginRequest({
        username: '   ',
        password: 'dev123456',
        clientId: 'saas-console',
      }),
    ).toThrow();
  },
);
