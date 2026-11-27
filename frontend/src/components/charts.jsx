/* SVG 차트 — 트리맵 · 육각형 레이더 · 등급 누적 바 · 가로 바 · 히트맵 · 분포 바
   마크 규격: 바 ≤24px·4px 둥근 끝(기준선 쪽 직각)·2px 표면 간격, 선 2px, 마커 r4 + 2px 표면 링, 그리드는 1px 실선.
   모든 차트에 hover 툴팁, 주요 차트는 ChartCard 의 '표로 보기' 제공. */
import { useLayoutEffect, useRef, useState } from "react";
import { GRADE_IDS, gradeClass, gradeVar } from "../lib.js";

// ---------- 공통 훅 ----------
export function useSize() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    setW(Math.floor(ref.current.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useTooltip() {
  const [tip, setTip] = useState(null);
  const place = (x, y, content) => setTip({ x, y, content });
  const show = (e, content) => place(e.clientX, e.clientY, content);
  const showAt = (el, content) => {
    const r = el.getBoundingClientRect();
    place(r.left + r.width / 2, r.top, content);
  };
  const hide = () => setTip(null);
  const node = tip ? <TooltipBox {...tip} /> : null;
  return { show, showAt, hide, node };
}

function TooltipBox({ x, y, content }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = x + 14;
    let top = y + 14;
    if (left + width > window.innerWidth - 8) left = x - width - 14;
    if (top + height > window.innerHeight - 8) top = y - height - 14;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y]);
  return <div ref={ref} className="tooltip" style={pos}>{content}</div>;
}

export const TT = ({ title, rows = [] }) => (
  <>
    {title && <div className="tt-title">{title}</div>}
    {rows.map(([k, v], i) => <div key={i} className="tt-row"><span>{k}</span><b>{v}</b></div>)}
  </>
);

/* 바 경로 — 기준선(왼쪽) 직각, 데이터 끝(오른쪽) 4px 라운드 */
function barPath(x, y, w, h, r = 4, roundEnd = true) {
  if (w <= 0) return "";
  const rr = roundEnd ? Math.min(r, w, h / 2) : 0;
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

// ---------- 차트 카드 (제목 · 범례 · 표 보기) ----------
export function ChartCard({ title, hint, legend, table, right, children, className = "" }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h3>{title}</h3>
        {hint && <span className="hint">{hint}</span>}
        <div className="right row">
          {right}
          {table && (
            <button className="btn ghost sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? "차트로 보기" : "표로 보기"}
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        {legend && !asTable && <div className="legend mb-16">{legend}</div>}
        {asTable ? <DataTable {...table} /> : children}
      </div>
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table className="table-view">
        <thead><tr>{columns.map((c, i) => <th key={i} className={i ? "num" : ""}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? "num" : ""}>{v ?? "-"}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const GradeLegend = ({ withNone = true }) => (
  <>
    {GRADE_IDS.map((g) => <span key={g}><i style={{ background: gradeVar(g) }} />{g}</span>)}
    {withNone && <span><i style={{ background: "var(--g-none)" }} />미평가</span>}
  </>
);

// ---------- 트리맵 (squarified) ----------
function worst(row, side) {
  const sum = row.reduce((s, r) => s + r.area, 0);
  const max = Math.max(...row.map((r) => r.area));
  const min = Math.min(...row.map((r) => r.area));
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function squarify(items, x, y, w, h) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return [];
  const scale = (w * h) / total;
  let rest = [...items].sort((a, b) => b.value - a.value).map((i) => ({ ...i, area: i.value * scale }));
  const out = [];
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row.push(rest[i++]);
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (const r of row) { const rh = r.area / cw; out.push({ ...r, x, y: cy, w: cw, h: rh }); cy += rh; }
      x += cw; w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const r of row) { const rw = r.area / rh; out.push({ ...r, x: cx, y, w: rw, h: rh }); cx += rw; }
      y += rh; h -= rh;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

/* items: [{ key, label, value, grade, tooltip, sub }] — 면적 = value(딜 수), 색 = 합의 등급 */
export function Treemap({ items, height = 300, onSelect }) {
  const [ref, w] = useSize();
  const tt = useTooltip();
  const tiles = w ? squarify(items.filter((i) => i.value > 0), 0, 0, w, height) : [];
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="chart" width={w} height={height} role="list" aria-label="분류별 딜 트리맵">
          <defs>
            {/* 미평가 타일 — 회색 덩어리 대신 빗금으로 '아직 값 없음'을 구분 */}
            <pattern id="tm-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="12" height="12" fill="var(--g-none)" />
              <rect width="6" height="12" fill="var(--g-none-2)" />
            </pattern>
          </defs>
          {tiles.map((t) => {
            const gx = 2.5, gw = Math.max(0, t.w - 5), gh = Math.max(0, t.h - 5);
            const ink = `var(--g-ink-${gradeClass(t.grade).slice(2)})`;
            const fitsName = gw > 64 && gh > 34;
            const fitsSub = gw > 64 && gh > 54;
            const fitsCount = gw > 44 && gh > 92; // 딜 수를 큰 숫자로 — 들어가면 보조 문구에서는 건수를 뺀다
            return (
              <g
                key={t.key}
                className="treemap-tile"
                role="listitem"
                tabIndex={0}
                aria-label={`${t.label} ${t.value}건, 합의 등급 ${t.grade || "미평가"}`}
                onClick={() => onSelect?.(t)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(t); } }}
                onMouseMove={(e) => tt.show(e, t.tooltip)}
                onMouseLeave={tt.hide}
                onFocus={(e) => tt.showAt(e.currentTarget, t.tooltip)}
                onBlur={tt.hide}
              >
                <rect x={t.x + gx} y={t.y + gx} width={gw} height={gh} rx={10} fill={t.grade ? gradeVar(t.grade) : "url(#tm-hatch)"} />
                {fitsName && (
                  <text x={t.x + 15} y={t.y + 27} style={{ fill: ink, fontWeight: 700, fontSize: 13.5 }}>
                    {clip(t.label, gw - 26, 13.5)}
                  </text>
                )}
                {fitsSub && (
                  <text x={t.x + 15} y={t.y + 45} style={{ fill: ink, opacity: 0.8, fontSize: 11.5 }}>
                    {clip((fitsCount && t.subShort) || (t.sub ?? `${t.value}건`), gw - 26, 11.5)}
                  </text>
                )}
                {fitsCount && (
                  <text x={t.x + 15} y={t.y + gx + gh - 14} style={{ fill: ink, fontWeight: 800, fontSize: 26, letterSpacing: "-0.04em" }}>
                    {t.value}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {tt.node}
    </div>
  );
}

/* 대략적인 글자 폭으로 라벨을 잘라 타일 밖으로 넘치지 않게 */
function clip(text, maxW, fs) {
  const s = String(text);
  const est = (str) => [...str].reduce((a, ch) => a + (/[ㄱ-힣]/.test(ch) ? fs * 0.98 : fs * 0.58), 0);
  if (est(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && est(out + "…") > maxW) out = out.slice(0, -1);
  return out.length > 1 ? out + "…" : "";
}

// ---------- 육각형 레이더 ----------
/* series: [{ name, values: {metricId: 1~5}, color }]  metrics: [{id, name}] */
export function Radar({ metrics, series, size = 300, mini = false, max = 5 }) {
  const tt = useTooltip();
  const pad = mini ? 6 : 58;
  const R = size / 2 - pad;
  const cx = size / 2, cy = size / 2;
  const n = metrics.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * (R * v) / max, cy + Math.sin(ang(i)) * (R * v) / max];
  const ring = (v) => metrics.map((_, i) => pt(i, v).join(",")).join(" ");

  return (
    <div style={{ width: "100%", maxWidth: size, margin: mini ? 0 : "0 auto" }}>
      <svg className="chart" viewBox={`0 0 ${size} ${size}`} width="100%" role="img"
        aria-label={series.map((s) => `${s.name}: ${metrics.map((m) => `${m.name} ${s.values?.[m.id] ?? "-"}`).join(", ")}`).join(" / ")}>
        {Array.from({ length: max }, (_, k) => (
          <polygon key={k} points={ring(k + 1)} fill="none" className="gridline" />
        ))}
        {metrics.map((m, i) => {
          const [x, y] = pt(i, max);
          return <line key={m.id} x1={cx} y1={cy} x2={x} y2={y} className="gridline" />;
        })}
        {series.map((s, si) => {
          const pts = metrics.map((m, i) => pt(i, s.values?.[m.id] ?? 0));
          return (
            <g key={si}>
              <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={s.color} fillOpacity={0.1}
                stroke={s.color} strokeWidth={mini ? 1.5 : 2} strokeLinejoin="round" />
              {!mini && pts.map(([x, y], i) => (
                <g key={i}
                  onMouseMove={(e) => tt.show(e, <TT title={metrics[i].name} rows={series.map((x) => [x.name, x.values?.[metrics[i].id] != null ? `${(+x.values[metrics[i].id]).toFixed(1).replace(/\.0$/, "")} / ${max}` : "-"])} />)}
                  onMouseLeave={tt.hide}>
                  <circle cx={x} cy={y} r={12} fill="transparent" />
                  <circle cx={x} cy={y} r={4} fill={s.color} stroke="var(--panel)" strokeWidth={2} />
                </g>
              ))}
            </g>
          );
        })}
        {!mini && metrics.map((m, i) => {
          const [x, y] = pt(i, max + 0.55);
          const anchor = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end";
          const v = series[0]?.values?.[m.id];
          return (
            <g key={m.id}>
              <text x={x} y={y - 2} textAnchor={anchor} className="t-strong">{m.name}</text>
              <text x={x} y={y + 13} textAnchor={anchor}>{v != null ? `${(+v).toFixed(1).replace(/\.0$/, "")}점` : "-"}</text>
            </g>
          );
        })}
      </svg>
      {tt.node}
    </div>
  );
}

// ---------- 등급 누적 가로 바 (분류별 등급 분포) ----------
/* rows: [{ key, label, counts: {A,'B+',B,C,none} }] */
export function GradeStackBars({ rows, onSelect, labelW = 132 }) {
  const [ref, w] = useSize();
  const tt = useTooltip();
  const barH = 18, gap = 14, valueW = 36;
  const keys = [...GRADE_IDS, "none"];
  const maxTotal = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + (r.counts[k] || 0), 0)));
  const plotW = Math.max(40, w - labelW - valueW);
  const h = rows.length * (barH + gap);
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="chart" width={w} height={h}>
          {rows.map((r, ri) => {
            const y = ri * (barH + gap);
            const total = keys.reduce((s, k) => s + (r.counts[k] || 0), 0);
            let x = labelW;
            const parts = keys.filter((k) => r.counts[k] > 0);
            return (
              <g key={r.key} style={{ cursor: onSelect ? "pointer" : "default" }} onClick={() => onSelect?.(r)}
                onMouseMove={(e) => tt.show(e, <TT title={`${r.label} · ${total}건`} rows={keys.filter((k) => r.counts[k]).map((k) => [k === "none" ? "미평가" : k, `${r.counts[k]}건`])} />)}
                onMouseLeave={tt.hide}>
                <rect x={0} y={y - 4} width={w} height={barH + 8} fill="transparent" />
                <text x={0} y={y + barH / 2 + 4} className="t-strong">{clip(r.label, labelW - 10, 12)}</text>
                {parts.map((k, pi) => {
                  const segW = (r.counts[k] / maxTotal) * plotW;
                  const last = pi === parts.length - 1;
                  const d = barPath(x, y, Math.max(0, segW - (last ? 0 : 2)), barH, 4, last);
                  x += segW;
                  return <path key={k} d={d} fill={k === "none" ? "var(--g-none)" : gradeVar(k)} />;
                })}
                <text x={x + 8} y={y + barH / 2 + 4}>{total}</text>
              </g>
            );
          })}
        </svg>
      )}
      {tt.node}
    </div>
  );
}

// ---------- 단일 시리즈 가로 바 ----------
export function HBars({ rows, labelW = 92, unit = "건", onSelect }) {
  const [ref, w] = useSize();
  const tt = useTooltip();
  const barH = 16, gap = 12, valueW = 36;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const plotW = Math.max(40, w - labelW - valueW);
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="chart" width={w} height={rows.length * (barH + gap)}>
          {rows.map((r, i) => {
            const y = i * (barH + gap);
            const bw = (r.value / max) * plotW;
            return (
              <g key={r.key} style={{ cursor: onSelect ? "pointer" : "default" }} onClick={() => onSelect?.(r)}
                onMouseMove={(e) => tt.show(e, <TT title={r.label} rows={[["딜 수", `${r.value}${unit}`], ...(r.extra || [])]} />)}
                onMouseLeave={tt.hide}>
                <rect x={0} y={y - 3} width={w} height={barH + 6} fill="transparent" />
                <text x={0} y={y + barH / 2 + 4} className="t-strong">{clip(r.label, labelW - 8, 12)}</text>
                <path d={barPath(labelW, y, bw, barH)} fill="var(--s1)" />
                <text x={labelW + bw + 8} y={y + barH / 2 + 4}>{r.value}</text>
              </g>
            );
          })}
        </svg>
      )}
      {tt.node}
    </div>
  );
}

// ---------- 히트맵 (분류 × 6대 지표 평균) ----------
export function Heatmap({ rows, cols, labelW = 132, onSelect }) {
  const [ref, w] = useSize();
  const tt = useTooltip();
  const cellH = 28, headH = 26;
  const cellW = Math.max(28, (w - labelW) / cols.length);
  const bucket = (v) => Math.min(7, Math.max(1, Math.round(((v - 1) / 4) * 6) + 1));
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg className="chart" width={w} height={headH + rows.length * cellH}>
          {cols.map((c, ci) => (
            <text key={c.id} x={labelW + ci * cellW + cellW / 2} y={16} textAnchor="middle">{clip(c.name, cellW - 4, 11.5)}</text>
          ))}
          {rows.map((r, ri) => (
            <g key={r.key} style={{ cursor: onSelect ? "pointer" : "default" }} onClick={() => onSelect?.(r)}>
              <text x={0} y={headH + ri * cellH + cellH / 2 + 4} className="t-strong">{clip(r.label, labelW - 10, 12)}</text>
              {cols.map((c, ci) => {
                const v = r.values[c.id];
                return (
                  <rect key={c.id} className="hm-cell"
                    x={labelW + ci * cellW + 1} y={headH + ri * cellH + 1} width={cellW - 2} height={cellH - 2} rx={4}
                    fill={v == null ? "var(--g-none)" : `var(--seq-${bucket(v)})`}
                    onMouseMove={(e) => tt.show(e, <TT title={`${r.label} · ${c.name}`} rows={[["평균", v == null ? "-" : `${v.toFixed(1)} / 5`], ["딜 수", `${r.n}건`]]} />)}
                    onMouseLeave={tt.hide} />
                );
              })}
            </g>
          ))}
        </svg>
      )}
      {tt.node}
    </div>
  );
}

export const SeqLegend = () => (
  <span className="row" style={{ gap: 6 }}>
    낮음
    {[1, 2, 3, 4, 5, 6, 7].map((k) => <i key={k} style={{ background: `var(--seq-${k})`, width: 16 }} />)}
    높음
  </span>
);

// ---------- 투표 분포 (한 덩어리 분할 바, 28px) ----------
export function GradeSplitBar({ dist }) {
  const tt = useTooltip();
  const total = GRADE_IDS.reduce((s, g) => s + (dist[g] || 0), 0);
  if (!total) return <div className="muted">아직 투표가 없습니다</div>;
  return (
    <>
      <div style={{ display: "flex", gap: 2, height: 28 }} role="img"
        aria-label={GRADE_IDS.map((g) => `${g} ${dist[g] || 0}표`).join(", ")}>
        {GRADE_IDS.filter((g) => dist[g]).map((g) => {
          const pct = (dist[g] / total) * 100;
          const ink = `var(--g-ink-${gradeClass(g).slice(2)})`;
          return (
            <div key={g} style={{ flex: `${dist[g]} 1 0`, background: gradeVar(g), borderRadius: 4, color: ink, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", paddingLeft: 8, minWidth: 0, overflow: "visible" }}
              onMouseMove={(e) => tt.show(e, <TT title={`${g} 등급`} rows={[["투표", `${dist[g]}표`], ["비중", `${Math.round(pct)}%`]]} />)}
              onMouseLeave={tt.hide}>
              {pct >= 14 ? `${dist[g]}표` : ""}
            </div>
          );
        })}
      </div>
      <div className="legend mt-8"><GradeLegend withNone={false} /></div>
      {tt.node}
    </>
  );
}
