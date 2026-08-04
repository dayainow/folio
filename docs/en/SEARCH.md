# Advanced search (P52)

Browser Lunr.js full-text search (no Elasticsearch server).

| Syntax | Example |
|--------|---------|
| AND / OR / NOT | `deploy AND API` |
| Phrase | `"API design"` |
| Fields | `title:guide` · `tag:release` |
| Wildcard | `API*` |
| Regex | `/WIP/i` |

UI: header **Advanced** · presets · 150ms debounce · CSV/JSON export.
