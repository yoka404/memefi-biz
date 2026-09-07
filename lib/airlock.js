import { padGroup } from "./pads.js";
import { tokenOwner } from "./rpc.js";

const PRO = "https://api.blockscout.com/4663";
const AIRLOCK = "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862";
const LONG_FACTORY = "0x22e99278308b393ea1260859b181ad7e78f5eeed";
const DOPPLER_FACTORY = "0x1b37d3a72082029c44b35b604ea473617580b69a";
const DOPPLER_ERC20 = "0x3be8b97fd0e713b5abe0649fa830223b6b4bc599";
const PONS_V2 = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_V1 = "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb";
const PONS_ROUTER = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const PONS_DEPLOYER = "0x3711cea4feade896c913c68f01eda97cb06d1a42";
const PONS_HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";
const PONS_LOCKER = "0x267444d099b10fb5ed7c3cc7b7c767adca574952";
const PONS_EXEC = "0xc7819b64a1daecd7ec19856d026cb14efbd89046";
const FLAP_PORTAL = "0x26605f322f7ff986f381bb9a6e3f5dab0beaeb09";
const FLAP_STD = "0x88882688a067fe97e11c2185b996286e53132222";
const FLAP_TAX = "0x7777c8743c88b3aff3cf262135bef2c8b2e83333";

const KNOWN = {
  "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18": "long",
  "0x385f4f8ae47651ce5f58f5265395a669f8281e18": "long",
  "0x98096d17e191b3da1d5f99a6d7b3584351b11e18": "long",
  "0xcacb0e9caccee63ec4d82952e561a291c68bcb68": "pons"
};

function key() {
  return process.env.BLOCKSCOUT_API_KEY || "";
}
function norm(a) {
  return String(a || "").toLowerCase();
}
function headers() {
  const k = key();
  const h = { Accept: "application/json" };
  if (k) h.Authorization = "Bearer " + k;
  return h;
}
function padFromAddr(addr) {
  const c = norm(addr);
  if (!c) return null;
  if (c === AIRLOCK || c === LONG_FACTORY || c === DOPPLER_FACTORY || c === DOPPLER_ERC20) return "long";
  if (c === PONS_V2 || c === PONS_V1 || c === PONS_ROUTER || c === PONS_DEPLOYER || c === PONS_HOOK || c === PONS_LOCKER || c === PONS_EXEC) return "pons";
  if (c === FLAP_PORTAL || c === FLAP_STD || c === FLAP_TAX) return "flap";
  return null;
}
function padFromImpl(impls) {
  for (const impl of impls || []) {
    const addr = norm(impl.address_hash || impl.address);
    const name = String(impl.name || "").toLowerCase();
    if (addr === DOPPLER_ERC20 || addr === DOPPLER_FACTORY || name.includes("doppler") || name.includes("airlock")) return "long";
    if (name.includes("pons") || padFromAddr(addr) === "pons") return "pons";
    if (name.includes("flap") || padFromAddr(addr) === "flap") return "flap";
  }
  return null;
}

async function inspect(address) {
  try {
    const url = PRO + "/api/v2/addresses/" + encodeURIComponent(address);
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) return { creator: null, pad: null };
    const data = await r.json();
    return {
      creator: norm(data.creator_address_hash || data.creator) || null,
      pad: padFromImpl(data.implementations)
    };
  } catch (e) {
    return { creator: null, pad: null };
  }
}

export async function fillPads(coins, limit) {
  if (!coins || !coins.length) return coins;
  const need = coins.filter((c) => c && c.address).slice(0, limit || 40);
  await Promise.all(need.map(async (c) => {
    const addr = norm(c.address);
    if (KNOWN[addr]) {
      c.launchpad = KNOWN[addr];
      c.padOnchain = true;
      return;
    }
    const owner = await tokenOwner(addr);
    let onchain = padFromAddr(owner);
    let creator = owner || null;
    if (!onchain) {
      const extra = await inspect(addr);
      creator = extra.creator || creator;
      onchain = padFromAddr(extra.creator) || extra.pad;
    }
    c.padCreator = creator || null;
    c.padOwner = owner || null;
    c.padOnchain = Boolean(onchain);
    if (onchain) c.launchpad = onchain;
    else if (padGroup(c.launchpad) === "uniswap" || padGroup(c.launchpad) === "other") c.launchpad = "unknown";
  }));
  return coins;
}
