import { padGroup } from "./pads.js";

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
function padFromCreator(creator) {
  const c = norm(creator);
  if (!c) return null;
  if (c === AIRLOCK || c === LONG_FACTORY || c === DOPPLER_FACTORY || c === DOPPLER_ERC20) return "long";
  if (c === PONS_V2 || c === PONS_ROUTER) return "pons";
  if (c === FLAP_PORTAL || c === FLAP_STD || c === FLAP_TAX) return "flap";
  return null;
}
function mergePad(current, onchain) {
  if (!onchain) return current;
  const cur = padGroup(current);
  if (onchain === "long" && (cur === "bankr" || cur === "feel" || cur === "long")) return current;
  return onchain;
}

async function creatorsBatch(addresses) {
  const k = key();
  const out = {};
  if (!addresses.length) return out;
  const qs = addresses.map((a) => encodeURIComponent(a)).join(",");
  const url = PRO + "/api?module=contract&action=getcontractcreation&contractaddresses=" + qs + (k ? "&apikey=" + encodeURIComponent(k) : "");
  try {
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) return out;
    const data = await r.json();
    const rows = Array.isArray(data.result) ? data.result : [];
    for (const row of rows) {
      const addr = norm(row.contractAddress || row.contractaddress);
      const creator = norm(row.contractCreator || row.contractcreator || row.creatorAddress);
      if (addr && creator) out[addr] = creator;
    }
  } catch (e) {}
  return out;
}

async function creatorFallback(address) {
  try {
    const url = PRO + "/api/v2/addresses/" + encodeURIComponent(address);
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) return null;
    const data = await r.json();
    const creator = norm(data.creator_address_hash || data.creator);
    if (creator) return creator;
    const impls = data.implementations || [];
    for (const impl of impls) {
      const name = String(impl.name || "").toLowerCase();
      if (name.includes("doppler")) return DOPPLER_FACTORY;
      if (name.includes("pons")) return PONS_V2;
      if (name.includes("flap")) return FLAP_PORTAL;
    }
  } catch (e) {}
  return null;
}

export async function fillPads(coins, limit) {
  if (!coins || !coins.length) return coins;
  const need = coins.filter((c) => c && c.address).slice(0, limit || 16);
  const addrs = need.map((c) => norm(c.address));
  const mapped = await creatorsBatch(addrs);
  await Promise.all(need.map(async (c) => {
    let creator = mapped[norm(c.address)] || null;
    if (!creator) creator = await creatorFallback(c.address);
    const onchain = padFromCreator(creator);
    c.padCreator = creator || null;
    c.padOnchain = Boolean(onchain);
    if (onchain) c.launchpad = mergePad(c.launchpad, onchain);
  }));
  return coins;
}
