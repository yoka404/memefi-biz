import { padGroup } from "./pads.js";
import { tokenOwner } from "./rpc.js";

const PRO = "https://api.blockscout.com/4663";
const AIRLOCK = "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862";
const LONG_FACTORY = "0x22e99278308b393ea1260859b181ad7e78f5eeed";
const DOPPLER_FACTORY = "0x1b37d3a72082029c44b35b604ea473617580b69a";
const DOPPLER_ERC20 = "0x3be8b97fd0e713b5abe0649fa830223b6b4bc599";
const PONS_V1 = "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb";
const PONS_V1_LEGACY = "0x0c37a24f5d23a486fa692d1500881d698b1f77a4";
const PONS_V1_LOCKER = "0x736d76699c26d0d966744cae304c000d471f7f35";
const PONS_V1_LOCKER_OLD = "0x31ca5e101941a93a7dd6d0497928700625cf54b5";
const PONS_V2 = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_V2_ROUTER = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const PONS_V2_DEPLOYER = "0x3711cea4feade896c913c68f01eda97cb06d1a42";
const PONS_V2_HOOK = "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044";
const PONS_V2_LOCKER = "0x267444d099b10fb5ed7c3cc7b7c767adca574952";
const PONS_V2_EXEC = "0xc7819b64a1daecd7ec19856d026cb14efbd89046";
const PONS_V2_ESCROW = "0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e";
const PONS_V2_VAULT = "0x42df2a798f82289e177311362e8f5ccc45c1219c";
const PONS_V2_GUARD = "0xf5695117b99b6f6401e67d4195bd653628176c6c";
const PONS_V2_EARLY = "0xdd89f26bea3916233d002d1189f973b78d38aa70";
const PONS_V2_ROUTER_ALT = "0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc";
const PONS_V3 = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
const FLAP_PORTAL = "0x26605f322f7ff986f381bb9a6e3f5dab0beaeb09";
const FLAP_STD = "0x88882688a067fe97e11c2185b996286e53132222";
const FLAP_TAX = "0x7777c8743c88b3aff3cf262135bef2c8b2e83333";
const O1_FACTORY = "0xce9c48cfa068947f77738c81be406b53338e5b0d";
const O1_HOOK = "0x0310cfebe1d7a69f2414f6595bbe9d17c5342acc";
const O1_DEPLOYER = "0xf86dfdb678d8e5d932100ef479a59fa65a82a5eb";
const O1_ESCROW = "0xc5444b417a04a7e1b9c1e327c7d499803c14e5ef";

const PONS_V1_SET = new Set([PONS_V1, PONS_V1_LEGACY, PONS_V1_LOCKER, PONS_V1_LOCKER_OLD]);
const PONS_V2_SET = new Set([PONS_V2, PONS_V2_ROUTER, PONS_V2_DEPLOYER, PONS_V2_HOOK, PONS_V2_LOCKER, PONS_V2_EXEC, PONS_V2_ESCROW, PONS_V2_VAULT, PONS_V2_GUARD, PONS_V2_EARLY, PONS_V2_ROUTER_ALT]);

const KNOWN = {
  "0x2e8c31162b855a2ffa90f6f8634643ad6f111e18": "long",
  "0x385f4f8ae47651ce5f58f5265395a669f8281e18": "long",
  "0x98096d17e191b3da1d5f99a6d7b3584351b11e18": "long",
  "0xcacb0e9caccee63ec4d82952e561a291c68bcb68": "pons-v2"
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
  if (PONS_V1_SET.has(c)) return "pons-v1";
  if (c === PONS_V3) return "pons-v3";
  if (PONS_V2_SET.has(c)) return "pons-v2";
  if (c === FLAP_PORTAL || c === FLAP_STD || c === FLAP_TAX) return "flap";
  if (c === O1_FACTORY || c === O1_HOOK || c === O1_DEPLOYER || c === O1_ESCROW) return "o1";
  return null;
}
function padFromImpl(impls) {
  for (const impl of impls || []) {
    const addr = norm(impl.address_hash || impl.address);
    const name = String(impl.name || "").toLowerCase();
    const mapped = padFromAddr(addr);
    if (mapped) return mapped;
    if (name.includes("doppler") || name.includes("airlock")) return "long";
    if (name.includes("ponsv3") || name.includes("pons v3")) return "pons-v3";
    if (name.includes("ponsv2") || name.includes("pons v2")) return "pons-v2";
    if (name.includes("pons")) return "pons-v1";
    if (name.includes("flap")) return "flap";
    if (name.includes("o1") || name.includes("launchpad-v4")) return "o1";
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
