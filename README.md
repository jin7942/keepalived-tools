# keepalived-tools

A VSCode extension for `keepalived.conf` — syntax highlighting, validation, completion, hover, go-to-definition, quick-fix, snippets, and formatting.

Works on every platform without a keepalived install (self-contained validation engine).

## Features

| Feature | Description |
|---------|-------------|
| **Syntax highlighting** | Blocks, directives, strings, variables, comments (both `#` and `!`) |
| **Validation** | 4 layers: syntax (braces / unknown directives / nesting) / type (range · enum · IP · port) / semantic (reference integrity · duplicates) / multi-file `include` |
| **Completion** | Directives, child blocks, and enum values for the current block |
| **Hover** | Directive description, type, range, allowed values, default, source, build option, man link |
| **Go to Definition** | Jump from a reference (`track_script chk`) to its definition (`vrrp_script chk`) — F12 |
| **Outline** | Navigate block structure via breadcrumbs, outline, and Ctrl+Shift+O |
| **Include navigation** | Click an `include` path to jump to the target file (DocumentLink) |
| **Quick-fix** | "Did you mean …?" corrections for enum typos and unknown directives |
| **Commands** | Show Schema Version / Validate Active File / Format Document (Command Palette) |
| **Snippets** | Skeletons for `vrrp_instance`, `virtual_server`, `vrrp_script`, and more |
| **Formatter** | Brace-depth reindentation (preserves comments and blank lines). Format-on-save supported |

## Reliability first

False positives erode trust. Only certain problems are flagged as errors; anything
uncertain is a warning/info, and the unknown stays silent (`$VAR`, `@conditional`,
and `~SEQ` values are exempt from validation). Checks prone to false positives while
editing — missing-required and unused-symbol — are off by default (enable them via
settings below).

Quick-fix follows the same principle: it only suggests close, typo-level candidates
and never pushes distant guesses.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `keepalived.validation.enable` | `true` | Toggle all diagnostics on/off |
| `keepalived.validation.reportMissingRequired` | `false` | Report missing required directives (off by default to avoid mid-edit false positives) |
| `keepalived.validation.reportUnused` | `false` | Report defined-but-unreferenced symbols (off by default — unreferenced is legal) |
| `keepalived.validation.maxFileSize` | `1048576` | Skip validation for files larger than this many bytes (editor responsiveness). `0` means unlimited |

## How it works

- Keywords, types, and ranges are extracted from the keepalived 2.3.4 source and
  frozen into a single schema (`schema/keepalived-spec.merged.json`).
- The validation logic lives in a pure `core` module with no VSCode dependency, so
  it can be reused behind an LSP adapter later.

See `docs/` (planning / architecture / ADR) for the detailed design.

## Known limitations

- The schema is a hand-seeded snapshot of keepalived **2.3.4**. Common blocks are
  fully validated (`complete`); rarer blocks silently accept unknown directives to
  avoid false positives (expanding gradually — ADR-0009).
- Conditional-compilation directives (`_WITH_SNMP_`, `_WITH_BFD_`, etc.) exist or not
  depending on the build — they are not diagnosed.
- Go-to-definition is currently single-file. Cross-file jumps via `include` are future work.

## Development

```bash
npm install
npm run build      # schema merge → grammar gen → typecheck → bundle
npm test           # core unit tests (node:test + tsx)
npm run package    # .vsix packaging
```

## License

GPL-2.0-or-later. keepalived source is used for fact extraction and logic reference,
so the same license applies. See [`NOTICE`](NOTICE) for copyright attribution.
