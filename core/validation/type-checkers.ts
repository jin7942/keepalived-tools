/**
 * 값 타입별 검사기.
 *
 * 스키마 어휘(schema §3.1)와 1:1. 각 검사기는 "정상이면 null, 오류면 메시지+코드" 반환.
 * inet_pton/check_true_false 등 keepalived 동작을 모방한다.
 *
 * 설계 근거: docs/01-architecture/03-validation.md §4
 */

import type { DirectiveSpec, ValueType } from "../schema/types.js";

export interface TypeError {
  code: string;
  message: string;
}

const BOOL_TOKENS = new Set(["on", "off", "true", "false", "yes", "no"]);

/** IPv4 점10진수 + 각 옥텟 0-255. */
function isIpv4(s: string): boolean {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255);
}

/** 느슨한 IPv6 (inet_pton 완전 모방은 아님; 흔한 형태 허용). */
function isIpv6(s: string): boolean {
  if (!s.includes(":")) return false;
  if (!/^[0-9a-fA-F:]+$/.test(s)) return false;
  // "::" 는 최대 1회.
  const doubleColon = (s.match(/::/g) ?? []).length;
  if (doubleColon > 1) return false;
  const groups = s.split(":").filter((g) => g.length > 0);
  return groups.every((g) => g.length <= 4) && groups.length <= 8;
}

function isIp(s: string): boolean {
  return isIpv4(s) || isIpv6(s);
}

function checkInt(text: string, spec: DirectiveSpec): TypeError | null {
  if (!/^[+-]?\d+$/.test(text)) {
    return { code: "TYPE_MISMATCH", message: `Expected integer, got '${text}'` };
  }
  const n = Number(text);
  return rangeError(n, spec, "TYPE_OUT_OF_RANGE");
}

function checkTimer(text: string, spec: DirectiveSpec): TypeError | null {
  // TIMER 는 소수 초 허용.
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
    return { code: "TYPE_MISMATCH", message: `Expected number (seconds), got '${text}'` };
  }
  const n = Number(text);
  if (n < 0 && (spec.min === undefined || spec.min >= 0)) {
    return { code: "TYPE_OUT_OF_RANGE", message: `Timer must be non-negative, got ${text}` };
  }
  return rangeError(n, spec, "TYPE_OUT_OF_RANGE");
}

function checkPort(text: string, spec: DirectiveSpec): TypeError | null {
  if (!/^\d+$/.test(text)) {
    return { code: "TYPE_MISMATCH", message: `Expected port number, got '${text}'` };
  }
  const n = Number(text);
  const min = spec.min ?? 1;
  const max = spec.max ?? 65535;
  if (n < min || n > max) {
    return { code: "TYPE_INVALID_PORT", message: `Port out of range (${min}-${max}), got ${n}` };
  }
  return null;
}

function checkBool(text: string): TypeError | null {
  if (!BOOL_TOKENS.has(text.toLowerCase())) {
    return {
      code: "TYPE_INVALID_BOOL",
      message: `Expected boolean (on/off/true/false/yes/no), got '${text}'`,
    };
  }
  return null;
}

function checkIp(text: string): TypeError | null {
  if (!isIp(text)) {
    return { code: "TYPE_INVALID_IP", message: `Invalid IP address '${text}'` };
  }
  return null;
}

function checkCidr(text: string): TypeError | null {
  const [addr, prefixStr, ...rest] = text.split("/");
  if (rest.length > 0 || prefixStr === undefined) {
    return { code: "TYPE_INVALID_CIDR", message: `Invalid CIDR '${text}' (expected addr/prefix)` };
  }
  if (!isIp(addr)) {
    return { code: "TYPE_INVALID_CIDR", message: `Invalid CIDR address '${addr}'` };
  }
  if (!/^\d+$/.test(prefixStr)) {
    return { code: "TYPE_INVALID_CIDR", message: `Invalid CIDR prefix '${prefixStr}'` };
  }
  const prefix = Number(prefixStr);
  const max = isIpv4(addr) ? 32 : 128;
  if (prefix > max) {
    return { code: "TYPE_INVALID_CIDR", message: `CIDR prefix out of range (0-${max}), got ${prefix}` };
  }
  return null;
}

function checkEnum(text: string, spec: DirectiveSpec): TypeError | null {
  const values = spec.values ?? [];
  if (values.length === 0) return null; // 허용값 미정 → 검사 불가.
  const match = spec.caseInsensitive
    ? values.some((v) => v.toLowerCase() === text.toLowerCase())
    : values.includes(text);
  if (!match) {
    return {
      code: "TYPE_INVALID_ENUM",
      message: `Invalid value '${text}', expected one of: ${values.join(", ")}`,
    };
  }
  return null;
}

function rangeError(n: number, spec: DirectiveSpec, code: string): TypeError | null {
  if (spec.min !== undefined && n < spec.min) {
    return { code, message: `Value ${n} below minimum ${spec.min}` };
  }
  if (spec.max !== undefined && n > spec.max) {
    return { code, message: `Value ${n} above maximum ${spec.max}` };
  }
  return null;
}

/** 타입별 검사 디스패치. string/ref 는 타입층에서 검사 안 함(null). */
export function checkValue(type: ValueType, text: string, spec: DirectiveSpec): TypeError | null {
  switch (type) {
    case "int":
      return checkInt(text, spec);
    case "timer":
      return checkTimer(text, spec);
    case "port":
      return checkPort(text, spec);
    case "bool":
      return checkBool(text);
    case "ip":
      return checkIp(text);
    case "cidr":
      return checkCidr(text);
    case "enum":
      return checkEnum(text, spec);
    case "string":
    case "ref":
      return null;
    default:
      return null;
  }
}
