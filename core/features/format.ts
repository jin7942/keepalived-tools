/**
 * Formatter (순수) — 줄 단위 재들여쓰기.
 *
 * AST 재출력이 아니라 줄 기반 들여쓰기 정규화를 택한다:
 * 주석·빈 줄·정렬 의도를 보존하고, `{`/`}` 깊이만 맞춘다(안전 우선).
 *
 * 규칙:
 *  - `}` 로 시작하는 줄은 들여쓰기를 한 단계 줄인 뒤 출력.
 *  - 그 외 줄은 현재 깊이로 출력.
 *  - 줄에 순증가(`{` 개수 − `}` 개수)만큼 다음 줄부터 깊이 변경.
 *  - 문자열·주석 안의 중괄호는 깊이 계산에서 제외.
 *
 * 설계 근거: docs/01-architecture/00-overview.md §2(S11)
 */

export interface FormatOptions {
  /** 들여쓰기 단위. 기본 탭. */
  indent?: string;
}

export function format(text: string, options: FormatOptions = {}): string {
  const indent = options.indent ?? "\t";
  const lines = text.split("\n");
  const out: string[] = [];
  let depth = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      out.push("");
      continue;
    }

    const { open, close, leadingClose } = braceCounts(trimmed);

    // 줄이 닫는 중괄호로 시작하면 그만큼 먼저 깊이 감소.
    let lineDepth = depth - leadingClose;
    if (lineDepth < 0) lineDepth = 0;

    out.push(indent.repeat(lineDepth) + trimmed);

    // 다음 줄 깊이 = 현재 깊이 + (열림 − 닫힘).
    depth += open - close;
    if (depth < 0) depth = 0;
  }

  return out.join("\n");
}

/**
 * 줄의 중괄호 개수 계산 (문자열·주석 제외).
 * leadingClose: 줄 맨 앞(공백 무시)에 연속된 `}` 개수.
 */
function braceCounts(line: string): { open: number; close: number; leadingClose: number } {
  let open = 0;
  let close = 0;
  let leadingClose = 0;
  let countingLeading = true;
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      countingLeading = false;
      continue;
    }
    if (ch === "#" || ch === "!") break; // 줄 주석 시작 → 이후 무시.
    if (ch === "{") {
      open++;
      countingLeading = false;
    } else if (ch === "}") {
      close++;
      if (countingLeading) leadingClose++;
    } else if (ch !== " " && ch !== "\t") {
      countingLeading = false;
    }
  }
  return { open, close, leadingClose };
}
