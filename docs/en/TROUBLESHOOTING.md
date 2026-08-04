# Troubleshooting

## App won't start

```bash
npm ci
npm run lint && npm run typecheck
npm run dev
```

## Data not saving

1. Check storage mode (local / cloud / Beacon)
2. Confirm Supabase env if using cloud
3. Look at the health badge in the sidebar

## Search returns nothing

- Try Advanced search presets
- Field queries: `title:`, `tag:`, `content:`
- Clear filters and use a short keyword

## Language stuck

- Header: cycle **ko / en / ja**
- Clear `folio_locale` in localStorage if needed
- Guide docs load from `docs/{locale}/`

## More

[Getting started](./GETTING-STARTED.md) · [Onboarding](./ONBOARDING.md)
