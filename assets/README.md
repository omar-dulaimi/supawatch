# Brand assets

The mark is the bracket pair supawatch prints on every log line, with the
two halves set at different levels. That offset is the argument the tool
makes: what Postgres declares is not what your driver hands back. The left
bracket is the declared type, the right is what your code actually
receives, and it carries the accent because it is the side supawatch
generates.

## Files

| File | Size | Use |
| --- | --- | --- |
| `banner-dark.svg` / `banner-light.svg` | 1280x340 | README header, paired in a `<picture>` so it follows the reader's theme |
| `banner-dark.png` / `banner-light.png` | 2560x680 | Same banner where SVG is not accepted |
| `social-preview.png` | 1280x640 | GitHub social preview. Needs a manual upload, see below |
| `social-preview.svg` | 1280x640 | Source for the above |
| `logomark.svg` | 48x48 | The mark, two colour, for dark grounds |
| `logomark-light.svg` | 48x48 | The mark, two colour, for light grounds |
| `logomark-mono-dark.svg` / `logomark-mono-light.svg` | 48x48 | Single colour, for stamps and anywhere the accent cannot go |
| `wordmark-dark.svg` / `wordmark-light.svg` | auto | Lockup on its own, with padding |
| `icon-16` through `icon-512.png` | square | App and listing icons, each rendered at its true size |
| `favicon.ico` | 16 to 256 | Seven sizes, each drawn rather than resampled |

## Palette

| Token | Ink | Paper | Meaning |
| --- | --- | --- | --- |
| ground | `#0B1114` | `#F1F4F5` | page |
| raised | `#121A1F` | `#FFFFFF` | surface above the page |
| hairline | `#1F2C33` | `#D6DEE1` | rules |
| strong rule | `#2E3F48` | `#B4C2C7` | table and header rules |
| tertiary | `#5A6E78` | `#7C8E99` | labels |
| secondary | `#8095A0` | `#56686F` | supporting text |
| primary | `#E3EAED` | `#0F171B` | body text |
| signal | `#E39338` | `#A9631A` | something generated, or a change caught |
| trace | `#46B2C4` | `#1F7C8C` | something proven against real rows |

The two accents sit at matched chroma and lightness and differ only in
hue. Neither is decoration. If a colour is not carrying one of those two
meanings, it is grey.

## Type

IBM Plex Mono for the wordmark, labels, CLI output and every type name.
IBM Plex Sans for running prose. Text inside the shipped SVGs is outlined,
not referenced by family, because a README image on GitHub loads no
webfonts and a `<text>` element would silently fall back.

## Rules

Keep clear space around the mark equal to one bracket arm, a quarter of
the mark's width. Never set it below 16px, never stretch it, never fill
the counters, and never put the accent on the left bracket: only one side
is generated, and the colour is what says so.

## The one manual step

GitHub's social preview cannot be set through the API. Upload
`social-preview.png` at
`https://github.com/omar-dulaimi/supawatch/settings` under Social preview.

## Regenerating

Every file here is generated, so the geometry, the palette and the target
list cannot drift apart:

```bash
python3 scripts/brand/build.py
```

It needs `rsvg-convert`, plus `fonttools` and `Pillow` from pip. The
typefaces are not vendored; `scripts/brand/fonts.py` fetches IBM Plex on
first run and caches it under `scripts/brand/.fonts/`, which is ignored.

The target list is parsed straight out of `packages/cli/src/config.ts`
rather than retyped, and the build fails if it parses none, so the count
on the social preview stays honest when a target is added. Rebuilding with
no source change reproduces all 19 files byte for byte.
