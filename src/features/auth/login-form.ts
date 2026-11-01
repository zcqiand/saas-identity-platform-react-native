/**
 * 登录入参装配（REQ-2026-032 / M01.F04.I01）。
 *
 * 纯函数 + fail-fast：三要素缺一（或空白）即抛，不发请求。
 * 与 harmonyos RoleForms 同构纪律：装配归装配，网络归 auth-service。
 */
import type {LoginRequest} from '../../api/endpoints/model';

export interface LoginInput {
  username: string;
  password: string;
  clientId: string;
}

const requireNonEmpty = (value: string, field: string): string => {
  if (value.trim().length === 0) {
    throw new Error(`登录入参缺失：${field} 不能为空（fail-fast，suite-hard-rules §1）`);
  }
  return value;
};

export function assembleLoginRequest(input: LoginInput): LoginRequest {
  return {
    username: requireNonEmpty(input.username, 'username'),
    password: requireNonEmpty(input.password, 'password'),
    clientId: requireNonEmpty(input.clientId, 'clientId'),
  };
}
