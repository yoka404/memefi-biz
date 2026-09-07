import { padGroup } from "./pads.js";
import { tokenOwner } from "./rpc.js";

const PRO = "https://api.blockscout.com/4663";
const AIRLOCK = "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862";
const LONG_FACTORY = "0x22e99278308b393ea1260859b181ad7e78f5eeed";
const DOPPLER_FACTORY = "0x1b37d3a72082029c44b35b604ea473617580b69a";
const DOPPLER_ERC20 = "0x3be8b97fd0e713b5abe0649fa830223b6b4bc599";
const PONS_V2 = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_ROUTER = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const FLAP_PORTAL = "0x26605f322f7ff986f381bb9a6e3f5dab0beaeb09";
const FLAP_STD = "0x88882688a067fe97e11c2185b996286e53132222";
const FLAP_TAX = "0x7777c8743c88b3aff3cf262135bef2c8b2e83333";

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
  if (c === PONS_V2 || c === PONS_ROUTER) return "pons";
  if (c === FLAP_PORTAL || c === FLAP_STD || c === FLAP_TAX) return "flap";
  return null;
}
function padFromImpl(impls) {
  for (const impl of impls || []) {
    const addr = norm(impl.address_hash || impl.address);
    const name = String(impl.name || "").toLowerCase();
    if (addr === DOPPLER_ERC20 || addr === DOPPLER_FACTORY || name.includes("doppler")) return "long";
    if (name.includes("pons") || addr === PONS_V2) return "pons";
    if (name.includes("flap") || addr === FLAP_PORTAL) return "flap";
  }
  return null;
}
function mergePad(current, onchain) {
  if (!onchain) return current;
  const cur = padGroup(current);
  if (onchain === "long" && (cur === "bankr" || cur === "feel" || cur === "long")) return current;
  return onchain;
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
  const need = coins.filter((c) => c && c.address).slice(0, limit || 16);
  await Promise.all(need.map(async (c) => {
    const owner = await tokenOwner(c.address);
    let onchain = padFromAddr(owner);
    let creator = owner || null;
    if (!onchain) {
      const extra = await inspect(c.address);
      creator = extra.creator || creator;
      onchain = padFromAddr(extra.creator) || extra.pad;
    }
    c.padCreator = creator || null;
    c.padOwner = owner || null;
    c.padOnchain = Boolean(onchain);
    if (onchain) c.launchpad = mergePad(c.launchpad, onchain);
  }));
  return coins;
}
