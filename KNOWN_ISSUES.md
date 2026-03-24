# KNOWN ISSUES

## V1 Known Limitations

- Trend momentum sparkline can render as visually flat/empty for some datasets even when trend buckets exist, because net-win values can normalize to near-zero bar heights.
- Ingestion and heuristics rely on PGN text parsing; malformed or heavily annotated PGN can reduce castling/queen-timing signal quality.
- Weakness tags are deterministic heuristics, not engine evaluations; they are intended for practical coaching direction, not move-level accuracy claims.
- Chess.com API rate limiting or intermittent upstream failures can still produce partial/empty dashboard results for certain usernames or time windows.
- AI insights are grounded to deterministic metrics, but when `OPENAI_API_KEY` is missing or provider calls fail, deterministic fallback coaching is used.
