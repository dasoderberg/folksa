const plans = {
  saflo: {
    keepName: "AMF traditionell",
    keepShort: "AMF",
    keepReturn: 4.5,
    keepFee: 0.10,
    keepFixed: 40,
    keepCap: 400,
    switchReturn: 6,
    switchFee: 0.25,
    switchFixed: 0,
    moveFee: 0,
    sources: [
      ["Fora: AMF traditionell", "https://www.fora.se/privat/hantera-din-tjanstepension/valj-placering-for-dina-pengar/traditionell-forsakring/"],
      ["Fora: Folksam LO fond", "https://www.fora.se/privat/hantera-din-tjanstepension/valj-placering-for-dina-pengar/fondforsakring/folksam-lo-pension/"],
      ["Folksam LO: SAF-LO", "https://www.folksamlopension.se/hur-fungerar-tjanstepension/privatanstalld"]
    ]
  },
  akap: {
    keepName: "KPA traditionell",
    keepShort: "KPA",
    keepReturn: 4.2,
    keepFee: 0.09,
    keepFixed: 36,
    keepCap: 300,
    switchReturn: 6,
    switchFee: 0.30,
    switchFixed: 65,
    moveFee: 0,
    sources: [
      ["KPA: traditionell försäkring", "https://www.kpa.se/privatperson/forsta-din-pension/olika-sparformer/traditionell-pensionsforsakring/"],
      ["Valcentralen: KAP-KL", "https://www.valcentralen.se/Valcentralen/Page.aspx?page=502"],
      ["Folksam LO: villkor och avgifter", "https://www.folksamlopension.se/hur-fungerar-tjanstepension/privatanstalld"]
    ]
  }
};

const ids = ["capital", "age", "retirement-age", "monthly", "keep-return", "keep-fee", "keep-fixed", "keep-cap", "switch-return", "switch-fee", "switch-fixed", "move-fee", "inflation"];
const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const realValues = document.getElementById("real-values");
let activePlan = "saflo";

const money = value => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Math.round(value));
const compactMoney = value => new Intl.NumberFormat("sv-SE", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(value));
const numberValue = (id, fallback = 0) => {
  const value = Number.parseFloat(el[id].value.replace?.(",", ".") ?? el[id].value);
  return Number.isFinite(value) ? value : fallback;
};
const setText = (id, value) => { document.getElementById(id).textContent = value; };

function getInputs() {
  const age = Math.max(18, numberValue("age", 45));
  const retirementAge = Math.max(age + 1, numberValue("retirement-age", 67));
  return {
    capital: Math.max(0, numberValue("capital")),
    age,
    retirementAge,
    years: Math.max(1, Math.round(retirementAge - age)),
    monthly: Math.max(0, numberValue("monthly")),
    keepReturn: numberValue("keep-return") / 100,
    keepFee: Math.max(0, numberValue("keep-fee")) / 100,
    keepFixed: Math.max(0, numberValue("keep-fixed")),
    keepCap: Math.max(0, numberValue("keep-cap")),
    switchReturn: numberValue("switch-return") / 100,
    switchFee: Math.max(0, numberValue("switch-fee")) / 100,
    switchFixed: Math.max(0, numberValue("switch-fixed")),
    moveFee: Math.max(0, numberValue("move-fee")),
    inflation: Math.max(0, numberValue("inflation")) / 100,
    real: realValues.checked
  };
}

function simulate({ capital, monthly, years, annualReturn, annualFee, fixedFee, feeCap = 0, initialFee = 0 }) {
  let balance = Math.max(0, capital - initialFee);
  let fees = initialFee;
  const points = [balance];
  const monthlyGrowth = Math.pow(1 + annualReturn, 1 / 12) - 1;
  for (let month = 1; month <= years * 12; month++) {
    balance += monthly;
    balance *= (1 + monthlyGrowth);
    let monthlyFee = balance * annualFee / 12 + fixedFee / 12;
    if (feeCap > 0) monthlyFee = Math.min(monthlyFee, feeCap / 12);
    monthlyFee = Math.min(balance, Math.max(0, monthlyFee));
    balance -= monthlyFee;
    fees += monthlyFee;
    if (month % 12 === 0) points.push(balance);
  }
  return { balance, fees, points };
}

function scenario(input, keepReturn, switchReturn) {
  const keep = simulate({ capital: input.capital, monthly: input.monthly, years: input.years, annualReturn: keepReturn, annualFee: input.keepFee, fixedFee: input.keepFixed, feeCap: input.keepCap });
  const switched = simulate({ capital: input.capital, monthly: input.monthly, years: input.years, annualReturn: switchReturn, annualFee: input.switchFee, fixedFee: input.switchFixed, initialFee: input.moveFee });
  const divisor = input.real ? Math.pow(1 + input.inflation, input.years) : 1;
  return {
    keep: { balance: keep.balance / divisor, fees: keep.fees / divisor, points: keep.points.map(v => v / divisor) },
    switched: { balance: switched.balance / divisor, fees: switched.fees / divisor, points: switched.points.map(v => v / divisor) }
  };
}

function differenceLabel(value, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${money(Math.abs(value))}${suffix}`;
}

function renderChart(keepPoints, switchPoints, years, age) {
  const svgWidth = 700, svgHeight = 280;
  const pad = { left: 12, right: 12, top: 20, bottom: 32 };
  const all = [...keepPoints, ...switchPoints];
  const max = Math.max(...all, 1) * 1.08;
  const x = i => pad.left + (i / Math.max(1, keepPoints.length - 1)) * (svgWidth - pad.left - pad.right);
  const y = v => pad.top + (1 - v / max) * (svgHeight - pad.top - pad.bottom);
  const path = pts => pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const switchPath = path(switchPoints);
  document.getElementById("keep-path").setAttribute("d", path(keepPoints));
  document.getElementById("switch-path").setAttribute("d", switchPath);
  document.getElementById("switch-area").setAttribute("d", `${switchPath} L${x(switchPoints.length - 1)},${svgHeight - pad.bottom} L${x(0)},${svgHeight - pad.bottom} Z`);

  const grid = document.getElementById("grid-lines");
  grid.innerHTML = "";
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const lineY = y(max * f);
    grid.insertAdjacentHTML("beforeend", `<line x1="${pad.left}" y1="${lineY}" x2="${svgWidth - pad.right}" y2="${lineY}" stroke="#dfe7e3" stroke-width="1" stroke-dasharray="4 6"/>`);
  });
  const labels = document.getElementById("chart-labels");
  const mid = Math.round(years / 2);
  labels.innerHTML = `<text x="${x(0)}" y="${svgHeight - 8}" text-anchor="start">${age} år</text><text x="${x(mid)}" y="${svgHeight - 8}" text-anchor="middle">${age + mid} år</text><text x="${x(years)}" y="${svgHeight - 8}" text-anchor="end">${age + years} år</text><text x="${svgWidth - 12}" y="16" text-anchor="end">${compactMoney(max)} kr</text>`;
}

function update() {
  const input = getInputs();
  const base = scenario(input, input.keepReturn, input.switchReturn);
  const low = scenario(input, input.keepReturn - 0.02, input.switchReturn - 0.04);
  const high = scenario(input, input.keepReturn + 0.015, input.switchReturn + 0.03);
  const diff = base.switched.balance - base.keep.balance;
  const positive = diff >= 0;

  setText("years-label", `${input.years} år`);
  setText("value-mode", input.real ? "Dagens penningvärde" : "Nominella kronor");
  setText("result-prefix", positive ? "I grundscenariot kan ett byte ge" : "I grundscenariot kan ett byte ge");
  setText("difference", differenceLabel(diff));
  setText("difference-caption", `${positive ? "mer" : "mindre"} i pensionskapital vid ${input.retirementAge} års ålder`);
  document.getElementById("result-heading").classList.toggle("negative", !positive);
  setText("keep-total", `${money(base.keep.balance)} kr`);
  setText("switch-total", `${money(base.switched.balance)} kr`);
  setText("keep-fees-total", `Beräknade avgifter: ${money(base.keep.fees)} kr`);
  setText("switch-fees-total", `Beräknade avgifter: ${money(base.switched.fees)} kr`);
  setText("monthly-difference", `cirka ${differenceLabel(diff / 240, " kr/mån")}`);

  [["low", low], ["base", base], ["high", high]].forEach(([name, data]) => {
    const d = data.switched.balance - data.keep.balance;
    setText(`${name}-keep`, `${compactMoney(data.keep.balance)} kr`);
    setText(`${name}-switch`, `${compactMoney(data.switched.balance)} kr`);
    setText(`${name}-diff`, differenceLabel(d, " kr"));
    const node = document.getElementById(`${name}-diff`);
    node.classList.toggle("positive", d >= 0);
    node.classList.toggle("negative", d < 0);
  });
  renderChart(base.keep.points, base.switched.points, input.years, input.age);
  saveState();
}

function applyPlan(planKey, preservePersonal = true) {
  activePlan = planKey;
  const plan = plans[planKey];
  el["keep-return"].value = plan.keepReturn;
  el["keep-fee"].value = plan.keepFee.toFixed(2);
  el["keep-fixed"].value = plan.keepFixed;
  el["keep-cap"].value = plan.keepCap;
  el["switch-return"].value = plan.switchReturn;
  el["switch-fee"].value = plan.switchFee.toFixed(2);
  el["switch-fixed"].value = plan.switchFixed;
  el["move-fee"].value = plan.moveFee;
  setText("keep-name", plan.keepName);
  setText("keep-legend", `Behåll ${plan.keepShort}`);
  setText("keep-total-label", `Behåll ${plan.keepName}`);
  setText("scenario-keep-head", `Behåll ${plan.keepShort}`);
  document.querySelectorAll(".comparison-tab").forEach(tab => {
    const selected = tab.dataset.plan === planKey;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("source-links").innerHTML = plan.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join("");
  update();
}

function saveState() {
  const state = { activePlan, real: realValues.checked };
  ids.forEach(id => state[id] = el[id].value);
  try { localStorage.setItem("pensionsbytet-state", JSON.stringify(state)); } catch (_) {}
}

function loadState() {
  let state;
  try { state = JSON.parse(localStorage.getItem("pensionsbytet-state")); } catch (_) { return false; }
  if (!state || !plans[state.activePlan]) return false;
  activePlan = state.activePlan;
  const plan = plans[activePlan];
  setText("keep-name", plan.keepName);
  setText("keep-legend", `Behåll ${plan.keepShort}`);
  setText("keep-total-label", `Behåll ${plan.keepName}`);
  setText("scenario-keep-head", `Behåll ${plan.keepShort}`);
  ids.forEach(id => { if (state[id] !== undefined) el[id].value = state[id]; });
  realValues.checked = state.real !== false;
  document.querySelectorAll(".comparison-tab").forEach(tab => {
    const selected = tab.dataset.plan === activePlan;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("source-links").innerHTML = plan.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join("");
  return true;
}

ids.forEach(id => el[id].addEventListener("input", update));
realValues.addEventListener("change", update);
document.querySelectorAll(".comparison-tab").forEach(tab => tab.addEventListener("click", () => applyPlan(tab.dataset.plan)));
document.getElementById("reset-button").addEventListener("click", () => {
  [el.capital.value, el.age.value, el["retirement-age"].value, el.monthly.value, el.inflation.value] = [500000, 45, 67, 2500, 2];
  realValues.checked = true;
  applyPlan(activePlan, false);
});
document.querySelectorAll("[data-dialog-open]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.dialogOpen).showModal()));
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
});

if (!loadState()) applyPlan("saflo"); else update();
