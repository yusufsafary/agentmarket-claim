// Agent Market claim page: read-only chain reads raced across public BSC RPCs.
const RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
];
const STALL = "0xE3dE7fD0d12cFF4a46d8Bf702Ab593B6f921b308";
const PRESALE = "0xA6Ef01e926eFbD35661e7B1d3E1CBeE360750b16";
const PER_STALL = 25000n;

async function ethCall(to, data) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] });
  const tries = RPCS.map((url) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(6000) })
      .then((r) => r.json())
      .then((j) => {
        if (!j.result || j.result === "0x") throw new Error("empty");
        return j.result;
      })
  );
  return Promise.any(tries);
}
const padAddr = (a) => "000000000000000000000000" + a.replace(/^0x/, "").toLowerCase();
const asUint = (hex) => BigInt(hex);
const asBool = (hex) => BigInt(hex) !== 0n;
const fmt = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const fmtTok = (wei) => fmt(wei / 10n ** 18n);
const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

let endTimeSec = 0;
let started = false;
function tick() {
  if (!started) { set("cl-countdown", "Presale not started"); return; }
  const left = endTimeSec - Math.floor(Date.now() / 1000);
  if (left <= 0) { set("cl-status", "OPEN"); set("cl-countdown", "Claims are open"); return; }
  const dd = Math.floor(left / 86400), hh = Math.floor((left % 86400) / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
  set("cl-countdown", `${dd}d ${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`);
}

async function refreshStatus() {
  try {
    const [start, end] = await Promise.all([
      ethCall(PRESALE, "0x78e97925").then(asUint),
      ethCall(PRESALE, "0x3197cbb6").then(asUint),
    ]);
    if (start === 0n) {
      started = false;
      set("cl-status", "NOT OPEN YET");
      set("cl-countdown", "Presale not started");
    } else {
      started = true;
      endTimeSec = Number(end);
      if (Math.floor(Date.now() / 1000) < endTimeSec) set("cl-status", "OPENS AT PRESALE END");
      tick();
    }
  } catch (e) { /* retry on interval */ }
}

async function checkWallet() {
  const input = document.getElementById("wallet-input");
  const note = document.getElementById("check-note");
  const addr = (input.value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { note.textContent = "That does not look like a wallet address."; return; }
  note.textContent = "Reading the chain…";
  try {
    const a = padAddr(addr);
    const [stalls, bought, claimable, pc, hc] = await Promise.all([
      ethCall(STALL, "0x70a08231" + a).then(asUint),
      ethCall(PRESALE, "0x667022fd" + a).then(asUint),
      ethCall(PRESALE, "0x402914f5" + a).then(asUint),
      ethCall(PRESALE, "0xf9765bc1" + a).then(asBool),
      ethCall(PRESALE, "0xdd6f5c53" + a).then(asBool),
    ]);
    document.getElementById("check-rows").hidden = false;
    set("r-stalls", fmt(stalls));
    set("r-holder", fmtTok(stalls * PER_STALL * 10n ** 18n) + " AMKT");
    set("r-bought", fmtTok(bought) + " AMKT");
    set("r-claimable", fmtTok(claimable) + " AMKT");
    set("r-pc", pc ? "Yes" : "No");
    set("r-hc", hc ? "Yes" : "No");
    note.textContent = "";
  } catch (e) {
    note.textContent = "The chain did not answer. Try again in a moment.";
  }
}

document.getElementById("check-btn").addEventListener("click", checkWallet);
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const src = document.getElementById(btn.dataset.copy);
    if (!src) return;
    try { await navigator.clipboard.writeText(src.textContent.trim()); btn.textContent = "Copied"; }
    catch (e) { btn.textContent = "Select and copy"; }
    setTimeout(() => (btn.textContent = "Copy prompt"), 1800);
  });
});

refreshStatus();
setInterval(refreshStatus, 30000);
setInterval(tick, 1000);
