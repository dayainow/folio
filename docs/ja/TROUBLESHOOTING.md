# トラブルシューティング

## 起動しない

```bash
npm ci
npm run lint && npm run typecheck
npm run dev
```

## 保存されない

1. 保存モードを確認
2. クラウド利用時は Supabase env
3. サイドバーのヘルスバッジ

## 検索ヒットなし

- 高度な検索のプリセットを試す
- `title:` / `tag:` / `content:`
- フィルターをクリア

## 言語が変わらない

- ヘッダーで **ko / en / ja** を切替
- 必要なら `folio_locale` を削除
- ガイドは `docs/{locale}/` から読込

[はじめに](./GETTING-STARTED.md) · [オンボーディング](./ONBOARDING.md)
