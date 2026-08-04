# 高度な検索 (P52)

ブラウザ Lunr.js 全文検索（Elasticsearch サーバー不要）。

| 構文 | 例 |
|------|-----|
| AND / OR / NOT | `deploy AND API` |
| フレーズ | `"API design"` |
| フィールド | `title:guide` · `tag:release` |
| ワイルドカード | `API*` |
| 正規表現 | `/WIP/i` |

UI: ヘッダー **高度な検索** · プリセット · debounce 150ms · CSV/JSON
