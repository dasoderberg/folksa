const plans = {
  saflo: {
    keepName: "AMF traditionell",
    keepShort: "AMF",
    keepReturn: 4.5,
    keepFee: 0.10,
    keepManagement: 0.034,
    keepFixed: 40,
    keepCap: 400,
    switchReturn: 6,
    switchFee: 0.25,
    switchFeeMin: 0.19,
    switchFeeStartAge: 61,
    switchFeeEndAge: 72,
    switchFixed: 0,
    moveFee: 0,
    historicalKeep: [[35, 6.13], [55, 5.45], [75, 5.23]],
    historicalSwitch: [[60, 9.13], [72, 3.76]],
    sources: [
      ["Fora: AMF traditionell", "https://www.fora.se/privat/hantera-din-tjanstepension/valj-placering-for-dina-pengar/traditionell-forsakring/amf/"],
      ["Fora: Folksam LO fond", "https://www.fora.se/privat/hantera-din-tjanstepension/valj-placering-for-dina-pengar/fondforsakring/folksam-lo-pension/"],
      ["Folksam LO: SAF-LO", "https://www.folksamlopension.se/hur-fungerar-tjanstepension/privatanstalld"]
    ]
  },
  akap: {
    keepName: "KPA traditionell",
    keepShort: "KPA",
    keepReturn: 4.2,
    keepFee: 0.05,
    keepManagement: 0.04,
    keepFixed: 36,
    keepCap: 300,
    switchReturn: 6,
    switchFee: 0.30,
    switchFeeMin: 0.30,
    switchFixed: 65,
    moveFee: 800,
    historicalKeep: [[0, 6.71]],
    historicalSwitch: [[0, 9.15]],
    sources: [
      ["KPA: traditionell försäkring", "https://www.kpa.se/privatperson/forsta-din-pension/olika-sparformer/traditionell-pensionsforsakring/"],
      ["Valcentralen: KAP-KL", "https://www.valcentralen.se/Valcentralen/Page.aspx?page=502"],
      ["Valcentralen: flyttavgifter", "https://www.valcentralen.se/Valcentralen/Page.aspx?page=178"]
    ]
  }
};

const STORAGE_VERSION = 2;
const ids = ["capital", "age", "retirement-age", "monthly", "wage-growth", "keep-return", "keep-fee", "keep-management", "keep-fixed", "keep-cap", "switch-return", "switch-fee", "switch-fixed", "move-fee", "inflation"];
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
    wageGrowth: numberValue("wage-growth", 1.9) / 100,
    keepReturn: numberValue("keep-return") / 100,
    keepFee: Math.max(0, numberValue("keep-fee")) / 100,
    keepManagement: Math.max(0, numberValue("keep-management")) / 100,
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

function interpolate(points, age) {
  if (points.length === 1) return points[0][1];
  if (age <= points[0][0]) return points[0][1];
  if (age >= points.at(-1)[0]) return points.at(-1)[1];
  const upperIndex = points.findIndex(([pointAge]) => pointAge >= age);
  const [lowerAge, lowerValue] = points[upperIndex - 1];
  const [upperAge, upperValue] = points[upperIndex];
  return lowerValue + (upperValue - lowerValue) * ((age - lowerAge) / (upperAge - lowerAge));
}

function switchFeeAtAge(plan, startingFee, age) {
  if (!plan.switchFeeStartAge || age <= plan.switchFeeStartAge) return startingFee;
  const adjustedMinimum = Math.max(0, startingFee + (plan.switchFeeMin - plan.switchFee) / 100);
  if (age >= plan.switchFeeEndAge) return adjustedMinimum;
  const progress = (age - plan.switchFeeStartAge) / (plan.switchFeeEndAge - plan.switchFeeStartAge);
  return startingFee + (adjustedMinimum - startingFee) * progress;
}

function simulate({ capital, monthly, years, age, wageGrowth, annualReturn, cappedAnnualFee = 0, uncappedAnnualFee = 0, uncappedFeeResolver, fixedFee, feeCap = 0, initialFee = 0 }) {
  let balance = Math.max(0, capital - initialFee);
  let fees = initialFee;
  const points = [balance];
  const monthlyGrowth = Math.pow(1 + annualReturn, 1 / 12) - 1;
  for (let month = 1; month <= years * 12; month++) {
    const completedYears = Math.floor((month - 1) / 12);
    const monthlyContribution = monthly * Math.pow(1 + wageGrowth, completedYears);
    balance += monthlyContribution;
    balance *= (1 + monthlyGrowth);
    let cappedMonthlyFee = balance * cappedAnnualFee / 12 + fixedFee / 12;
    if (feeCap > 0) cappedMonthlyFee = Math.min(cappedMonthlyFee, feeCap / 12);
    const currentAge = age + (month - 1) / 12;
    const currentUncappedFee = uncappedFeeResolver ? uncappedFeeResolver(currentAge) : uncappedAnnualFee;
    let monthlyFee = cappedMonthlyFee + balance * currentUncappedFee / 12;
    monthlyFee = Math.min(balance, Math.max(0, monthlyFee));
    balance -= monthlyFee;
    fees += monthlyFee;
    if (month % 12 === 0) points.push(balance);
  }
  return { balance, fees, points };
}

function scenario(input, keepReturn, switchReturn) {
  const plan = plans[activePlan];
  const common = { capital: input.capital, monthly: input.monthly, years: input.years, age: input.age, wageGrowth: input.wageGrowth };
  const keep = simulate({ ...common, annualReturn: keepReturn, cappedAnnualFee: input.keepFee, uncappedAnnualFee: input.keepManagement, fixedFee: input.keepFixed, feeCap: input.keepCap });
  const switched = simulate({ ...common, annualReturn: switchReturn, uncappedFeeResolver: currentAge => switchFeeAtAge(plan, input.switchFee, currentAge), fixedFee: input.switchFixed, initialFee: input.moveFee });
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
  const plan = plans[activePlan];
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
  setText("before-name", plan.keepName);
  setText("before-capital", `${money(base.keep.balance)} kr`);
  setText("after-capital", `${money(base.switched.balance)} kr`);
  setText("visual-difference", differenceLabel(diff, " kr"));
  setText("before-history", `${interpolate(plan.historicalKeep, input.age).toFixed(2).replace(".", ",")} %/år`);
  setText("after-history", `${interpolate(plan.historicalSwitch, input.age).toFixed(2).replace(".", ",")} %/år`);
  const feePercent = value => (value * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
  setText("before-fee-fact", `${money(input.keepFixed)} kr + ${feePercent(input.keepFee)} % (tak ${money(input.keepCap)} kr) + ${feePercent(input.keepManagement)} %`);
  const endingSwitchFee = switchFeeAtAge(plan, input.switchFee, input.retirementAge);
  const switchFeeRange = Math.abs(endingSwitchFee - input.switchFee) > 0.000001
    ? `${feePercent(input.switchFee)}–${feePercent(endingSwitchFee)} %`
    : `${feePercent(input.switchFee)} %`;
  setText("after-fee-fact", `${input.switchFixed ? `${money(input.switchFixed)} kr + ` : ""}${switchFeeRange}`);
  const finalMonthly = input.monthly * Math.pow(1 + input.wageGrowth, Math.max(0, input.years - 1));
  setText("premium-growth-note", `Premien ökar från ${money(input.monthly)} till cirka ${money(finalMonthly)} kr/mån med ${(input.wageGrowth * 100).toFixed(1).replace(".", ",")} % löneökning.`);
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
  el["keep-fee"].value = plan.keepFee.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  el["keep-management"].value = plan.keepManagement.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
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
  setText("switch-fee-note", plan.switchFeeStartAge
    ? `Trappas ned till ${plan.switchFeeMin.toFixed(2).replace(".", ",")} % mellan ${plan.switchFeeStartAge} och ${plan.switchFeeEndAge} års ålder.`
    : "Total avgift för entrélösningen.");
  document.querySelectorAll(".comparison-tab").forEach(tab => {
    const selected = tab.dataset.plan === planKey;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  document.getElementById("source-links").innerHTML = plan.sources.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join("");
  update();
}

function saveState() {
  const state = { version: STORAGE_VERSION, activePlan, real: realValues.checked };
  ids.forEach(id => state[id] = el[id].value);
  try { localStorage.setItem("pensionsbytet-state", JSON.stringify(state)); } catch (_) {}
}

function loadState() {
  let state;
  try { state = JSON.parse(localStorage.getItem("pensionsbytet-state")); } catch (_) { return false; }
  if (!state || state.version !== STORAGE_VERSION || !plans[state.activePlan]) {
    try { localStorage.removeItem("pensionsbytet-state"); } catch (_) {}
    return false;
  }
  activePlan = state.activePlan;
  const plan = plans[activePlan];
  setText("keep-name", plan.keepName);
  setText("keep-legend", `Behåll ${plan.keepShort}`);
  setText("keep-total-label", `Behåll ${plan.keepName}`);
  setText("scenario-keep-head", `Behåll ${plan.keepShort}`);
  setText("switch-fee-note", plan.switchFeeStartAge
    ? `Trappas ned till ${plan.switchFeeMin.toFixed(2).replace(".", ",")} % mellan ${plan.switchFeeStartAge} och ${plan.switchFeeEndAge} års ålder.`
    : "Total avgift för entrélösningen.");
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
  [el.capital.value, el.age.value, el["retirement-age"].value, el.monthly.value, el["wage-growth"].value, el.inflation.value] = [500000, 45, 67, 2500, 1.9, 2];
  realValues.checked = true;
  applyPlan(activePlan, false);
});
document.querySelectorAll("[data-dialog-open]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.dialogOpen).showModal()));
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
});

if (!loadState()) applyPlan("saflo"); else update();
