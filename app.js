const DATA_URL = "data/fig3.json";
const MODEL_ORDER = ["circle", "ellipse", "multicircle3", "multicircle6", "polygon"];

const CONTROLLERS = [
  { key: "circle", label: "circle", file: "circle" },
  { key: "ellipse", label: "ellipse", file: "ellipse" },
  { key: "3disc", label: "3-disc", file: "3disc" },
  { key: "6disc", label: "6-disc", file: "6disc" },
  { key: "polygon-dc", label: "poly. DC", file: "polygon-dc" },
  { key: "polygon-cbf", label: "proposed", file: "polygon-cbf" },
];

const SCENARIOS = [
  {
    id: "S1-fairway-g1.0",
    short: "S1",
    blurb: "S1: fairway turn-in at r_gap = 1.0, start (−2, 2) m, surge 0.5 m/s.",
  },
  {
    id: "S2-aligned-g1.0",
    short: "S2",
    blurb: "S2: aligned approach at r_gap = 1.0, start (−2.4, 0.80) m from rest.",
  },
  {
    id: "S3-aligned-g0.5",
    short: "S3",
    blurb: "S3: aligned entry at r_gap = 0.5.",
  },
  {
    id: "S4-aligned-g0.25",
    short: "S4",
    blurb: "S4: near-bound aligned entry at r_gap = 0.25.",
  },
  {
    id: "S5-hard-g0.35",
    short: "S5",
    blurb: "S5: hard entry drawn from the sweep at r_gap = 0.35.",
  },
];

const OUTCOMES = {
  "S1-fairway-g1.0": {
    circle: "deadlock", ellipse: "dock 13.5 s", "3disc": "dock 12.5 s",
    "6disc": "dock 10.5 s", "polygon-dc": "dock 16.5 s", "polygon-cbf": "dock 10.5 s",
  },
  "S2-aligned-g1.0": {
    circle: "deadlock", ellipse: "dock 10.5 s", "3disc": "deadlock",
    "6disc": "dock 15.0 s", "polygon-dc": "dock 10.5 s", "polygon-cbf": "dock 11.0 s",
  },
  "S3-aligned-g0.5": {
    circle: "deadlock", ellipse: "dock 16.0 s", "3disc": "deadlock",
    "6disc": "dock 15.0 s", "polygon-dc": "dock 11.0 s", "polygon-cbf": "dock 12.5 s",
  },
  "S4-aligned-g0.25": {
    circle: "deadlock", ellipse: "deadlock", "3disc": "deadlock",
    "6disc": "deadlock", "polygon-dc": "dock 17.0 s", "polygon-cbf": "dock 18.5 s",
  },
  "S5-hard-g0.35": {
    circle: "deadlock", ellipse: "deadlock", "3disc": "deadlock",
    "6disc": "deadlock", "polygon-dc": "dock 9.0 s", "polygon-cbf": "dock 10.0 s",
  },
};

const state = {
  data: null,
  thetaDeg: 0,
  enabled: Object.fromEntries(MODEL_ORDER.map((m) => [m, true])),
  scenarioId: SCENARIOS[0].id,
  dragging: false,
};

const boatCanvas = document.getElementById("boat-canvas");
const mapCanvas = document.getElementById("map-canvas");
const boatCtx = boatCanvas.getContext("2d");
const mapCtx = mapCanvas.getContext("2d");
const thetaDegEl = document.getElementById("theta-deg");
const thetaSlider = document.getElementById("theta-slider");
const legendEl = document.getElementById("model-legend");
const slipLabel = document.getElementById("slip-label");

function nearestContourKey(deg) {
  const step = state.data.meta.deg_step || 3;
  const snapped = Math.round(deg / step) * step % 360;
  const key = String(snapped);
  if (state.data.contours[key]) return key;
  // fallback nearest
  let best = "0";
  let bestDist = 1e9;
  for (const k of Object.keys(state.data.contours)) {
    const d = Math.min(Math.abs(+k - deg), 360 - Math.abs(+k - deg));
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

function rotatePoints(points, psi) {
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return points.map(([x, y]) => [c * x - s * y, s * x + c * y]);
}

function worldToBoat(x, y, scale, cx, cy) {
  return [cx + x * scale, cy - y * scale];
}

function drawPolygon(ctx, points, scale, cx, cy, { fill, stroke, width = 1.5, dash = null } = {}) {
  if (!points?.length) return;
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const [px, py] = worldToBoat(x, y, scale, cx, cy);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawBoatPanel() {
  const { data, thetaDeg, enabled } = state;
  const w = boatCanvas.width;
  const h = boatCanvas.height;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const scale = Math.min(w, h) * 0.28;
  const psi = (thetaDeg * Math.PI) / 180;

  boatCtx.clearRect(0, 0, w, h);
  const grd = boatCtx.createRadialGradient(cx, cy, 20, cx, cy, scale * 2.5);
  grd.addColorStop(0, "#f4f6f8");
  grd.addColorStop(1, "#e8ecf0");
  boatCtx.fillStyle = grd;
  boatCtx.fillRect(0, 0, w, h);

  boatCtx.strokeStyle = "rgba(0,0,0,0.08)";
  boatCtx.lineWidth = 1;
  boatCtx.beginPath();
  boatCtx.arc(cx, cy, scale * 1.85, 0, Math.PI * 2);
  boatCtx.stroke();
  boatCtx.fillStyle = "#6e6e73";
  boatCtx.font = "500 12px -apple-system, BlinkMacSystemFont, sans-serif";
  boatCtx.textAlign = "center";
  boatCtx.fillText("bow →", cx + Math.cos(psi) * scale * 2.05, cy - Math.sin(psi) * scale * 2.05);

  for (const model of MODEL_ORDER) {
    if (!enabled[model]) continue;
    const color = data.models[model].color;
    const body = data.footprints_body[model];
    if (model.startsWith("multicircle")) {
      for (const disc of body) {
        drawPolygon(boatCtx, rotatePoints(disc, psi), scale, cx, cy, {
          stroke: color, width: 1.4, dash: [5, 4],
        });
      }
    } else {
      drawPolygon(boatCtx, rotatePoints(body, psi), scale, cx, cy, {
        stroke: color, width: model === "polygon" ? 2 : 1.4,
        dash: model === "polygon" ? null : [6, 4],
      });
    }
  }

  drawPolygon(boatCtx, rotatePoints(data.hull, psi), scale, cx, cy, {
    fill: "#1d1d1f",
    stroke: "#1d1d1f",
    width: 1.2,
  });

  const hx = cx + Math.cos(psi) * scale * 1.55;
  const hy = cy - Math.sin(psi) * scale * 1.55;
  boatCtx.fillStyle = "#0071e3";
  boatCtx.beginPath();
  boatCtx.arc(hx, hy, 7, 0, Math.PI * 2);
  boatCtx.fill();
}

function mapTransform() {
  const { bounds } = state.data;
  const pad = 18;
  const w = mapCanvas.width - pad * 2;
  const h = mapCanvas.height - pad * 2;
  const x0 = bounds.x[0];
  const x1 = bounds.x[1];
  const y0 = bounds.y[0];
  const y1 = bounds.y[1];
  const sx = w / (x1 - x0);
  const sy = h / (y1 - y0);
  const scale = Math.min(sx, sy);
  const ox = pad + (w - scale * (x1 - x0)) * 0.5;
  const oy = pad + (h - scale * (y1 - y0)) * 0.5;
  return {
    toPix(x, y) {
      return [ox + (x - x0) * scale, oy + (y1 - y) * scale];
    },
  };
}

function drawMapPanel() {
  const { data, thetaDeg, enabled } = state;
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const { toPix } = mapTransform();
  const key = nearestContourKey(thetaDeg);

  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = "#eef1f4";
  mapCtx.fillRect(0, 0, w, h);

  for (const obs of data.obstacles) {
    mapCtx.beginPath();
    obs.forEach(([x, y], i) => {
      const [px, py] = toPix(x, y);
      if (i === 0) mapCtx.moveTo(px, py);
      else mapCtx.lineTo(px, py);
    });
    mapCtx.closePath();
    mapCtx.fillStyle = "#d2d2d7";
    mapCtx.fill();
    mapCtx.strokeStyle = "#86868b";
    mapCtx.lineWidth = 1;
    mapCtx.stroke();
  }

  // admissible-centre boundaries at the current heading (Fig. 3)
  const contours = data.contours[key];
  for (const model of MODEL_ORDER) {
    if (!enabled[model] || !contours[model]) continue;
    const color = data.models[model].color;
    for (const path of contours[model]) {
      if (path.length < 2) continue;
      mapCtx.beginPath();
      path.forEach(([x, y], i) => {
        const [px, py] = toPix(x, y);
        if (i === 0) mapCtx.moveTo(px, py);
        else mapCtx.lineTo(px, py);
      });
      const closed = path.length > 3 &&
        Math.hypot(path[0][0] - path.at(-1)[0], path[0][1] - path.at(-1)[1]) < 0.08;
      if (model === "polygon" && closed) {
        mapCtx.fillStyle = hexAlpha(color, 0.14);
        mapCtx.fill();
      }
      mapCtx.strokeStyle = color;
      mapCtx.lineWidth = model === "polygon" ? 2.2 : 1.4;
      mapCtx.setLineDash(model === "polygon" ? [] : [6, 4]);
      mapCtx.stroke();
      mapCtx.setLineDash([]);
    }
  }

  mapCtx.fillStyle = "#6e6e73";
  mapCtx.font = "500 12px -apple-system, BlinkMacSystemFont, sans-serif";
  mapCtx.fillText(`θ = ${Math.round(thetaDeg)}°`, 16, h - 16);
  const [ax, ay] = toPix(2.55, -1.95);
  mapCtx.fillText("x → slip", ax - 52, ay);
}

function hexAlpha(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function setTheta(deg) {
  let d = ((deg % 360) + 360) % 360;
  state.thetaDeg = d;
  thetaDegEl.textContent = String(Math.round(d));
  thetaSlider.value = String(Math.round(d));
  drawBoatPanel();
  drawMapPanel();
}

function buildLegend() {
  legendEl.innerHTML = "";
  for (const model of MODEL_ORDER) {
    const label = document.createElement("label");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.color = state.data.models[model].color;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.enabled[model];
    cb.addEventListener("change", () => {
      state.enabled[model] = cb.checked;
      drawBoatPanel();
      drawMapPanel();
    });
    label.append(sw, cb, document.createTextNode(state.data.models[model].label));
    legendEl.append(label);
  }
}

function pointerAngle(evt, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((evt.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((evt.clientY - rect.top) / rect.height) * canvas.height;
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.52;
  // canvas y down; world yaw from +x
  const ang = Math.atan2(-(y - cy), x - cx); // rad
  return ((ang * 180) / Math.PI + 360) % 360;
}

function wireBoatDrag() {
  const start = (evt) => {
    state.dragging = true;
    boatCanvas.setPointerCapture?.(evt.pointerId);
    setTheta(pointerAngle(evt, boatCanvas));
  };
  const move = (evt) => {
    if (!state.dragging) return;
    setTheta(pointerAngle(evt, boatCanvas));
  };
  const end = () => { state.dragging = false; };
  boatCanvas.addEventListener("pointerdown", start);
  boatCanvas.addEventListener("pointermove", move);
  boatCanvas.addEventListener("pointerup", end);
  boatCanvas.addEventListener("pointercancel", end);
  thetaSlider.addEventListener("input", () => setTheta(+thetaSlider.value));
}

function videoSrc(scenarioId, controllerFile) {
  return `videos/${scenarioId}__${controllerFile}.mp4?v=20260814c`;
}

function buildScenarioUI() {
  const tabs = document.getElementById("scenario-tabs");
  const grid = document.getElementById("video-grid");
  const blurb = document.getElementById("scenario-blurb");

  for (const scen of SCENARIOS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = scen.short;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", scen.id === state.scenarioId ? "true" : "false");
    btn.addEventListener("click", () => {
      state.scenarioId = scen.id;
      for (const b of tabs.querySelectorAll("button")) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      }
      renderVideos();
    });
    tabs.append(btn);
  }

  function renderVideos() {
    const scen = SCENARIOS.find((s) => s.id === state.scenarioId);
    blurb.textContent = scen.blurb;
    grid.innerHTML = "";
    const outcomes = OUTCOMES[scen.id];
    for (const ctrl of CONTROLLERS) {
      const card = document.createElement("article");
      card.className = "video-card";
      const head = document.createElement("header");
      const title = document.createElement("strong");
      title.textContent = ctrl.label;
      const meta = document.createElement("span");
      const outcome = outcomes[ctrl.key] || "";
      meta.textContent = outcome;
      meta.className = outcome.startsWith("dock") ? "badge-ok" : "badge-fail";
      head.append(title, meta);
      const video = document.createElement("video");
      video.src = videoSrc(scen.id, ctrl.file);
      video.controls = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      card.append(head, video);
      grid.append(card);
    }
  }

  document.getElementById("btn-play").addEventListener("click", () => {
    for (const v of grid.querySelectorAll("video")) v.play();
  });
  document.getElementById("btn-pause").addEventListener("click", () => {
    for (const v of grid.querySelectorAll("video")) v.pause();
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    for (const v of grid.querySelectorAll("video")) {
      v.currentTime = 0;
      v.play();
    }
  });

  renderVideos();
}

async function loadSweep() {
  const res = await fetch("data/sweep.json");
  if (!res.ok) return;
  const data = await res.json();
  const canvas = document.getElementById("sweep-canvas");
  const legend = document.getElementById("sweep-legend");
  if (!canvas || !legend) return;
  legend.innerHTML = "";
  for (const curve of data.curves) {
    const item = document.createElement("span");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.color = curve.color;
    item.append(sw, document.createTextNode(curve.label));
    legend.append(item);
  }
  const draw = () => drawSweep(canvas, data);
  draw();
  window.addEventListener("resize", draw);
}

function drawSweep(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 920;
  const cssH = Math.max(280, Math.round(cssW * 0.42));
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = { l: 52, r: 18, t: 18, b: 42 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;
  const xMin = Math.min(...data.widths);
  const xMax = Math.max(...data.widths);
  const xOf = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * w;
  const yOf = (pct) => pad.t + (1 - pct / 100) * h;

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#6e6e73";
  for (const tick of [0, 25, 50, 75, 100]) {
    const y = yOf(tick);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + w, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(`${tick}`, pad.l - 8, y + 4);
  }
  ctx.textAlign = "center";
  for (const width of data.widths) {
    ctx.fillText(width.toFixed(2), xOf(width), cssH - 16);
  }
  ctx.fillText("slip width [m]", pad.l + w * 0.5, cssH - 2);
  ctx.save();
  ctx.translate(14, pad.t + h * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("success [%]", 0, 0);
  ctx.restore();

  for (const bound of data.bounds) {
    const x = xOf(bound.width);
    ctx.strokeStyle = bound.color;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  for (const curve of data.curves) {
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = curve.label === "proposed" ? 2.4 : 1.6;
    ctx.beginPath();
    curve.rates.forEach((rate, i) => {
      const x = xOf(data.widths[i]);
      const y = yOf(rate);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = curve.color;
    curve.rates.forEach((rate, i) => {
      ctx.beginPath();
      ctx.arc(xOf(data.widths[i]), yOf(rate), 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

async function main() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
  state.data = await res.json();
  slipLabel.textContent = `${state.data.meta.slip_width.toFixed(2)} m slip`;
  buildLegend();
  wireBoatDrag();
  setTheta(0);
  buildScenarioUI();
  loadSweep();

  // gentle auto-spin hint once
  let t0 = performance.now();
  function intro(now) {
    const u = Math.min(1, (now - t0) / 2400);
    if (u < 1 && !state.dragging) {
      setTheta(25 * Math.sin(u * Math.PI));
      requestAnimationFrame(intro);
    } else if (!state.dragging) {
      setTheta(0);
    }
  }
  requestAnimationFrame(intro);
}

main().catch((err) => {
  console.error(err);
  document.getElementById("feasible").insertAdjacentHTML(
    "beforeend",
    `<p style="color:#d70015">Could not load the admissible-region data. Run <code>python scripts/export_project_page_fig3.py</code>.</p>`
  );
});
