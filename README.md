# MEMEFI

**The tape after the punchline.**

Desk for memecoins quoted in official Robinhood Chain stock tokens and metal ETFs. Live prices. Cash-session premium. Permanent pair files.

Site: [www.memefi.biz](https://www.memefi.biz)  
Desk account: [@memefibiz](https://x.com/memefibiz)

---

## TL;DR

On Robinhood Chain, a memecoin can be the base asset and a tokenized equity or metal (NVDA, AMC, GLD, SLV) the quote. The dollar print of the meme is a ratio against that wrapper. When NYSE is closed the wrapper can trade at a premium to the last cash print; every pair that uses it reprices. MEMEFI is the newsroom and the board for that tape.

This is not a brokerage. Holding the meme does not confer the cash stock.

---

## What ships

- **Desk** — session stamp, lead brief, live focus print
- **Wire** — sourced notes on stock-paired and metal-paired markets
- **Board** — ranked pairs with price, volume, market cap, asset locked, cash premium
- **Metals** — GLD and SLV wrappers only (no official copper token on this chain)
- **Files** — `/p/<address>` with DexScreener chart, socials, contracts
- **Premium** — `on-chain wrapper / last NYSE cash print − 1`

## Stack

| Layer | Source |
|---|---|
| Board universe | memefimarketcap listed dump (interim) |
| Live ticks | DexScreener |
| Cash closes | Yahoo Finance last regular print |
| Charts / logos | DexScreener embed + token CDN |
| Host | Vercel · apex + www on Namecheap |

## Repo

```
index.html      desk
pair.html       permanent file
app.js          board + 1s tick
pair.js         file + chart
api/board.js    ranked slice + quotes
api/coin.js     pair file payload
api/pairs.js    DexScreener multi-pair
styles.css      Gecko-dark + violet
```

## Next on the tape

1. Own Airlock / Uniswap v4 indexer — stop leasing the reference dump
2. Live wire ingest
3. Full-universe search

## License and posture

Not financial advice. Names on the board are not issued or endorsed by the listed companies. Tokenized wrappers are exposure instruments, not title to the cash share.
