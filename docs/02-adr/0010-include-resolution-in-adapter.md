# ADR-0010: include glob resolve 는 어댑터, 순환 감지는 core

- 상태: Accepted
- 날짜: 2026-06-29

## Context

`include /etc/keepalived/conf.d/*.conf` 는 여러 파일을 한 설정으로 합친다.
크로스파일 참조 검증·순환 감지가 필요하다. 그러나 core 는 fs 비의존(ADR-0002).

## Decision

- **glob 해석·파일 읽기 = vscode 어댑터.** 어댑터가 `SourceFile{path,text,resolvedIncludes}`
  배열을 core 에 넘긴다. `resolvedIncludes` 는 그 파일 include 들이 가리키는 실제 경로 목록.
- **순환 감지·심볼 병합·크로스파일 참조 = core.** 텍스트와 resolve 결과만으로 수행.
- `resolvedIncludes` 미제공(단일 파일 등) 시 순환 감지·NOT_FOUND 생략.

## Consequences

- (+) core 순수성 유지 → 테스트·LSP 이식 용이.
- (+) 순환 감지 로직(가치 있는 부분)은 core 에 → 어댑터 무관하게 재사용.
- (−) 어댑터가 glob→경로 resolve 책임을 짐(중복 include·심볼릭링크 등 엣지 처리).
- core 인터페이스: `validateFiles(files: SourceFile[], entryPath): Map<path, Diagnostic[]>`.

## Alternatives

- core 가 fs 로 glob 해석: 순수성 깨짐, ADR-0002 위반. 기각.
