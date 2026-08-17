---
"@supawatch/target-erd": minor
"supawatch": patch
"@supawatch/verify": patch
---

Large schemas produced a diagram Mermaid refuses to render. Mermaid caps
diagram source at `maxTextSize` (its own default is 50000 characters) and
substitutes a "Maximum text size in diagram exceeded" box; the check lives
in the render path, so an oversized diagram parses cleanly and still cannot
be displayed. The ERD target now keeps its output renderable: it emits every
column when that fits, otherwise key columns only, otherwise relationships
only, and states which it chose in a note above the diagram. New options
`attributes` (`"all" | "keys" | "none"`) and `maxTextSize` make the choice
explicit, with an honest warning when an explicit choice cannot render. The
suite now asserts emitted size against the limit as well as parsing, since
parsing alone never catches this.
