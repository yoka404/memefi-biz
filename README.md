# MEMEFI

**Who controls the memes controls the tape.**

Desk for memecoins quoted in official Robinhood Chain stock tokens and metal ETFs. Live prices. Cash-session premium. Permanent pair files.

Site: [www.memefi.biz](https://www.memefi.biz)  
Desk account: [@memefibiz](https://x.com/memefibiz)

---

## TL;DR

Who controls the memes controls the tape.

On Robinhood Chain, a memecoin can be the base asset and a tokenized equity or metal (NVDA, AMC, GLD, SLV) the quote. The dollar print of the meme is a ratio against that wrapper. When NYSE is closed the wrapper can trade at a premium to the last cash print; every pair that uses it reprices. MEMEFI is the newsroom and the board for that tape.

This is not a brokerage. Holding the meme does not confer the cash stock.

---

## What ships

- **Desk** — session stamp, lead brief, live focus print
- **Wire** — live briefs from the open web
- **Board** — ranked pairs with price, volume, market cap, asset locked, cash premium
- **Metals** — GLD and SLV wrappers only
- **Files** — `/p/<address>` with DexScreener chart, socials, contracts
- **Premium** — `on-chain wrapper / last NYSE cash print − 1`
- **Indexer v1** — official wrappers from StockKit + GeckoTerminal pools on chain 4663. memefimarketcap dump is overlay only (holders / locked).

## Stack

| Layer | Source |
|---|---|
| Wrapper registry | StockKit (`api.stockkit.dev`) |
| Pool discovery | GeckoTerminal Robinhood network |
| Live ticks | DexScreener |
| Cash closes | Yahoo Finance last regular print |
| Charts / logos | DexScreener embed + token CDN |
| Host | Vercel · apex + www on Namecheap |

RPC for the next pass: `https://rpc.mainnet.chain.robinhood.com` · Airlock `0xeb7C034704eF8Dcd2D32324c1545f62fB4aD0862` · V4 PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`.

## Repo

```
lib/indexer.js  universe builder
api/index.js    raw universe
api/board.js    ranked desk payload
api/coin.js     pair file
api/wire.js     live briefs
```

## Next on the tape

1. Airlock / Uniswap v4 log indexer on the public RPC — full launch universe
2. X bot from the Wire
3. Full-universe search

## License and posture

Not financial advice. Names on the board are not issued or endorsed by the listed companies. Tokenized wrappers are exposure instruments, not title to the cash share.
