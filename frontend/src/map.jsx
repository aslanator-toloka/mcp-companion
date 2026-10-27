import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { map as s, battle as b } from "./stores/index.js";
import { PeerHeader } from "./peer.jsx";
const edgeNames = {
  north: "Сверху",
  south: "Снизу",
  west: "Слева",
  east: "Справа",
};
const pixels = (p) => ({ x: 40 + p.x * 10, y: 40 + p.y * 10 });
function Zone({ edge, side }) {
  const z = s.geometry.zone(edge),
    x = 40 + z.x * 10,
    y = 40 + z.y * 10;
  return (
    <g className="map-zone">
      <rect
        x={x}
        y={y}
        width={z.w * 10}
        height={z.h * 10}
        fill={s.geometry.palette[side]}
        fillOpacity=".09"
        stroke={s.geometry.palette[side]}
        strokeWidth="1.8"
        strokeDasharray={side === "mine" ? "" : "5 4"}
      />
      <text
        x={x + z.w * 5}
        y={y + z.h * 5}
        fill={s.geometry.palette[side]}
        textAnchor="middle"
        className="map-zone-label"
        transform={
          ["east", "west"].includes(edge)
            ? `rotate(-90 ${x + z.w * 5} ${y + z.h * 5})`
            : undefined
        }
      >
        {s.zoneLabel(side)} · 6″
      </text>
    </g>
  );
}
const References = observer(function References({ origin }) {
  if (!origin || !s.lines || s.distanceMode !== "boundaries") return null;
  const op = pixels(origin),
    arrows = { north: "↑", south: "↓", west: "←", east: "→" };
  return s.geometry.references(origin, s.state.edge, s.mode).map((ref, i) => {
    const color =
        ref.kind === "zone" ? s.geometry.palette[ref.side] : "#64748b",
      ends = s.geometry.segment(origin, { ...ref.target, radius: 0 }, s.mode),
      a = pixels(ends.a),
      bb = pixels(ends.b),
      target = pixels(ref.target),
      text =
        ref.kind === "edge"
          ? arrows[ref.edge] + " " + s.text(ref.distance)
          : s.zoneLabel(ref.side) + " · " + s.text(ref.distance),
      width = Math.max(45, text.length * 5.5 + 12);
    let x = target.x,
      y = target.y;
    if (ref.kind === "edge") {
      if (ref.edge === "north") y = 49;
      else if (ref.edge === "south") y = 391;
      else if (ref.edge === "west") x = 40 + width / 2;
      else x = 400 - width / 2;
    } else if (["north", "south"].includes(ref.edge)) {
      x = op.x + width / 2 + 8;
      y = target.y + (ref.edge === "north" ? 10 : -10);
    } else {
      x = target.x + (ref.edge === "west" ? width / 2 + 8 : -width / 2 - 8);
      y = op.y + 25;
    }
    x = Math.max(41 + width / 2, Math.min(399 - width / 2, x));
    y = Math.max(49, Math.min(391, y));
    return (
      <g key={i} className="map-reference-line">
        <path
          d={`M${a.x} ${a.y}L${bb.x} ${bb.y}`}
          stroke={color}
          strokeWidth={ref.kind === "zone" ? 1.8 : 1}
          strokeDasharray={ref.kind === "zone" ? "5 3" : "2 4"}
        />
        <rect
          x={x - width / 2}
          y={y - 9}
          width={width}
          height="18"
          rx="4"
          fill="white"
          fillOpacity=".97"
          stroke={color}
          strokeWidth=".7"
        />
        <text
          x={x}
          y={y + 3}
          textAnchor="middle"
          fill={color}
          className="map-reference-label"
        >
          {text}
        </text>
      </g>
    );
  });
});
const MapCanvas = observer(function MapCanvas() {
  const ref = useRef(null),
    points = s.displayPoints,
    selected = s.displayOrigin,
    groups = [];
  for (const p of points) {
    const group = groups.find(
      (g) => Math.abs(g[0].x - p.x) < 0.01 && Math.abs(g[0].y - p.y) < 0.01,
    );
    if (group && p.kind === "objective" && group[0].kind === "objective")
      group.push(p);
    else groups.push([p]);
  }
  const seen = new Set();
  return (
    <svg
      id="battle-map-svg"
      ref={ref}
      viewBox="0 0 440 440"
      style={{
        width: 100 * s.zoom + "%",
        maxWidth: s.zoom === 1 ? "min(100%,65dvh)" : "none",
      }}
      role="img"
      tabIndex={0}
      aria-label="Карта боя 36 на 36 дюймов, точки миссий и стартовые зоны"
      onPointerMove={(e) => s.pointerMove(e, ref.current)}
      onPointerUp={s.pointerUp}
      onPointerCancel={s.cancelDrag}
    >
      <rect x="40" y="40" width="360" height="360" rx="2" fill="#fff" />
      {Array.from({ length: 37 }, (_, n) => (
        <React.Fragment key={n}>
          <path
            d={`M${40 + n * 10} 40V400 M40 ${40 + n * 10}H400`}
            stroke={n % 6 ? "#e7edf4" : "#cbd5e1"}
            strokeWidth={n % 6 ? ".6" : "1.1"}
          />
          {n % 6 === 0 && (
            <>
              <text
                x={40 + n * 10}
                y="28"
                textAnchor="middle"
                className="map-axis"
              >
                {n}″
              </text>
              <text
                x="27"
                y={44 + n * 10}
                textAnchor="end"
                className="map-axis"
              >
                {n}″
              </text>
            </>
          )}
        </React.Fragment>
      ))}
      <Zone edge={s.state.edge} side="mine" />
      <Zone edge={s.geometry.opposite[s.state.edge]} side="opponent" />
      {s.lines &&
        selected &&
        s.distanceMode === "objects" &&
        points
          .filter((p) => p.id !== selected.id)
          .map((p) => {
            const d = s.geometry.distance(selected, p, s.mode),
              signature = p.x + ":" + p.y;
            if (!d || seen.has(signature)) return null;
            seen.add(signature);
            const ends = s.geometry.segment(selected, p, s.mode),
              a = pixels(ends.a),
              bb = pixels(ends.b),
              x = (a.x + bb.x) / 2,
              y = (a.y + bb.y) / 2;
            return (
              <g key={p.id} className="map-distance-line">
                <path
                  d={`M${a.x} ${a.y}L${bb.x} ${bb.y}`}
                  stroke="#0284c7"
                  strokeWidth="1.1"
                  strokeDasharray="4 3"
                />
                <rect
                  x={x - 22}
                  y={y - 8}
                  width="44"
                  height="16"
                  rx="4"
                  fill="white"
                  fillOpacity=".94"
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  className="map-distance-label"
                >
                  {s.text(d)}
                </text>
              </g>
            );
          })}
      <References origin={selected} />
      <rect
        x="40"
        y="40"
        width="360"
        height="360"
        fill="none"
        stroke="#475569"
        strokeWidth="2"
      />
      {groups.map((group) => {
        const p = group.find((p) => p.id === selected?.id) || group[0],
          v = pixels(p),
          chosen = group.some((p) => p.id === selected?.id),
          radius = Math.max(4, (p.radius || 0) * 10),
          gr = Math.min(3, radius);
        return (
          <g
            key={p.id}
            transform={`translate(${v.x} ${v.y})`}
            data-map-key={p.id}
            role="button"
            tabIndex={0}
            aria-label={"Точка " + group.map(s.pointName).join(" / ")}
            className={"map-point" + (chosen ? " map-point-selected" : "")}
            onPointerDown={(e) => s.pointerDown(e, ref.current, p.id)}
            onClick={() => {
              if (!s.drag) s.setField("selected", p.id);
            }}
            onKeyDown={(e) => {
              if (["Enter", " "].includes(e.key)) {
                e.preventDefault();
                s.setField("selected", p.id);
              }
            }}
          >
            <title>{group.map(s.pointName).join(" / ")}</title>
            <circle r="23" fill="transparent" />
            {chosen && (
              <circle
                r="17"
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.6"
                strokeDasharray="3 2"
              />
            )}
            {p.radius > 0 && (
              <circle
                r={radius}
                fill={p.color}
                fillOpacity=".12"
                stroke={p.color}
                strokeWidth="1.3"
              />
            )}
            {group.map((item, i) => {
              const r = gr - i * 0.5;
              return item.role === "extract" ||
                ["herb", "evac"].includes(item.role) ? (
                <path
                  key={item.id}
                  d={`M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`}
                  fill={item.color}
                  fillOpacity=".14"
                  stroke={item.color}
                  strokeWidth="2.5"
                />
              ) : (
                <circle
                  key={item.id}
                  r={r}
                  fill={item.color}
                  fillOpacity=".14"
                  stroke={item.color}
                  strokeWidth="2.5"
                />
              );
            })}
            <text y="25" textAnchor="middle" className="map-point-label">
              {group
                .map((p) => (p.kind === "objective" ? p.code : p.name))
                .join(" / ")}
            </text>
          </g>
        );
      })}
      <text x="220" y="428" textAnchor="middle" className="map-axis">
        36″ × 36″ · 91,44 × 91,44 см
      </text>
    </svg>
  );
});
const DistancePanel = observer(function DistancePanel() {
  const p = s.origin,
    readonly = s.match.status === "finished",
    G = s.geometry;
  useEffect(() => s.updateCoordinates(), [p?.id, p?.x, p?.y, s.unit]);
  if (!p)
    return (
      <div className="empty">
        <h3>Выберите точку на карте</h3>
        <p>Выберите объект или добавьте дополнительную точку на карте.</p>
      </div>
    );
  return (
    <>
      <div className="map-origin-heading">
        <span className="eyebrow">От выбранной точки</span>
        <h2>{s.pointName(p)}</h2>
      </div>
      <p className="map-size-note">Диаметр точки · 1″</p>
      {s.distanceMode === "boundaries" ? (
        <section className="map-reference-summary">
          <h3>До краёв поля</h3>
          <div className="map-edge-cards">
            {["west", "east", "north", "south"].map((key) => (
              <div key={key}>
                <span>{edgeNames[key]}</span>
                <b>{s.text(G.edgeDistance(p, key, s.mode))}</b>
              </div>
            ))}
          </div>
          <h3>До стартовых зон</h3>
          <div className="map-zone-cards">
            {["mine", "opponent"].map((side) => (
              <div key={side} className={side}>
                <span>{s.zoneLabel(side)}</span>
                <b>
                  {s.text(
                    G.zoneDistance(
                      p,
                      side === "mine" ? s.state.edge : G.opposite[s.state.edge],
                      s.mode,
                    ),
                  )}
                </b>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <h3>До объектов</h3>
          <div className="map-distance-table">
            {s.points
              .filter((other) => other.id !== p.id)
              .map((other) => (
                <button
                  key={other.id}
                  data-ma="select"
                  data-key={other.id}
                  onClick={() => s.setField("selected", other.id)}
                >
                  <span>
                    <i
                      className="map-dot"
                      style={{ background: other.color }}
                    />
                    {s.pointName(other)}
                  </span>
                  <b>{s.text(G.distance(p, other, s.mode))}</b>
                </button>
              ))}
          </div>
        </>
      )}
      <details data-ui-disclosure className="map-coordinate-editor">
        <summary>Задать координаты точки</summary>
        <div className="map-coordinates">
          {[
            ["x", "X от левого края"],
            ["y", "Y от верхнего края"],
          ].map(([key, label]) => (
            <label key={key} className="field">
              {label}
              <input
                id={"map-" + key}
                type="number"
                min="0"
                max={36 * (s.unit === "cm" ? 2.54 : 1)}
                step=".01"
                value={s[key]}
                disabled={readonly}
                onChange={(e) => s.setField(key, e.target.value)}
              />
            </label>
          ))}
          <small>
            Координаты в {s.unit === "cm" ? "сантиметрах" : "дюймах"}
          </small>
          {!readonly && (
            <button
              className="primary"
              data-ma="apply-coords"
              onClick={s.applyCoordinates}
            >
              Применить координаты
            </button>
          )}
        </div>
      </details>
      {!readonly && (
        <div className="actions map-point-actions">
          {p.kind === "objective" ? (
            <button data-ma="reset-point" onClick={s.resetPoint}>
              Вернуть цель на старт
            </button>
          ) : (
            <>
              <button data-ma="rename-pin" onClick={s.rename}>
                Название точки
              </button>
              <button data-ma="remove-pin" onClick={() => s.remove(p.id)}>
                Убрать точку
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
});
const RenameDialog = observer(function RenameDialog() {
  const ref = useRef(null);
  useEffect(() => {
    if (s.renaming && !ref.current.open) ref.current.showModal();
    else if (!s.renaming && ref.current.open) ref.current.close();
  }, [s.renaming]);
  return (
    <dialog
      ref={ref}
      className="small-dialog"
      onClose={(event) => {
        if (!event.currentTarget.open) s.setField("renaming", false);
      }}
    >
      <form
        id="map-pin-form"
        onSubmit={(e) => {
          e.preventDefault();
          s.saveName();
        }}
      >
        <label className="field">
          Название
          <input
            name="name"
            value={s.name}
            required
            maxLength={50}
            onChange={(e) => s.setField("name", e.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Сохранить название
        </button>
      </form>
    </dialog>
  );
});
export const BattleMapView = observer(function BattleMapView() {
  const m = s.match,
    readonly = m.status === "finished",
    G = s.geometry,
    roles = [...new Set(s.points.map((p) => p.role))];
  useEffect(() => {
    const key = (e) => {
      if (
        e.key !== "Backspace" ||
        e.target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      e.preventDefault();
      s.remove();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <PeerHeader />
      <div className="heading">
        <div>
          <span className="eyebrow">12 / Карта боя</span>
          <h1>Карта и расстояния</h1>
          <p>{m.name} · объекты и расстояния.</p>
        </div>
        <div className="actions">
          <button
            data-bt="undo"
            disabled={readonly || !b.canUndo}
            onClick={b.undo}
          >
            ↶ Отмена
          </button>
          <button data-ma="back" onClick={s.back}>
            ← {m.status === "preparing" ? "К подготовке" : "В бой"}
          </button>
        </div>
      </div>
      <div className="map-missions">
        {[
          ["secure", "Secure"],
          ["extract", "Extract"],
        ].map(([kind, name]) => (
          <div key={kind} className="map-mission" data-kind={kind}>
            <span className="eyebrow">{name}</span>
            {m[kind] ? (
              <>
                <button
                  className="quiet"
                  data-bt="mission-card"
                  data-kind={kind}
                  onClick={() => b.mission(kind)}
                >
                  {m[kind].name} ↗
                </button>
                <small>Схема {m[kind].setup}</small>
              </>
            ) : (
              <span className="muted">Не выбрана</span>
            )}
            {!readonly && (
              <button
                data-bt="missions"
                data-kind={kind}
                onClick={() => b.openPicker("opponent", "crises", kind)}
              >
                {m[kind] ? "Заменить" : "Выбрать миссию"}
              </button>
            )}
          </div>
        ))}
      </div>
      {s.error && (
        <div className="notice">{s.error} Точки миссий не построены.</div>
      )}
      {[m.secure, m.extract]
        .filter((c) => c && !s.data.layouts[c.setup])
        .map((c) => (
          <div key={c.slug} className="notice">
            Для {c.name} не найдена схема {c.setup}.
          </div>
        ))}
      <div className="map-toolbar">
        <div className="map-mode-bar">
          <div
            className="map-tools"
            role="tablist"
            aria-label="Режим расстояний"
          >
            {[
              ["objects", "До объектов"],
              ["boundaries", "До краёв и стартовых зон"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                role="tab"
                data-ma="distance-mode"
                data-distance-mode={mode}
                aria-selected={s.distanceMode === mode}
                className={s.distanceMode === mode ? "selected" : ""}
                onClick={() => s.setField("distanceMode", mode)}
              >
                {label}
              </button>
            ))}
          </div>
          {s.distanceMode === "objects" && (
            <button data-ma="add-point" disabled={readonly} onClick={s.add}>
              + Дополнительная точка
            </button>
          )}
        </div>
        <div className="map-settings">
          <label>
            {b.activeNetwork ? "Край " + m.mine.name : "Мой край"}
            <select
              id="map-edge"
              value={s.state.edge}
              disabled={readonly}
              onChange={(e) => s.setEdge(e.target.value)}
            >
              {Object.entries(edgeNames).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Измерять
            <select
              id="map-mode"
              value={s.mode}
              onChange={(e) => s.setField("mode", e.target.value)}
            >
              <option value="bases">От краёв баз</option>
              <option value="centers">Между центрами</option>
            </select>
          </label>
          <label>
            Единицы
            <select
              id="map-unit"
              value={s.unit}
              onChange={(e) => s.setField("unit", e.target.value)}
            >
              <option value="in">Дюймы</option>
              <option value="cm">Сантиметры</option>
            </select>
          </label>
          <label className="check">
            <input
              id="map-lines"
              type="checkbox"
              checked={s.lines}
              onChange={(e) => s.setField("lines", e.target.checked)}
            />
            Расстояния на карте
          </label>
        </div>
      </div>
      <p className="map-instruction">
        Выберите или перетащите точку. Дополнительная метка удаляется клавишей
        Backspace, когда выделена.
      </p>
      <div className="battle-map-layout">
        <section className="map-canvas-section">
          <div className="map-canvas-scroll">
            <MapCanvas />
          </div>
          <div className="map-legend">
            {roles.map((role) => (
              <span key={role}>
                <i
                  className="map-dot"
                  style={{ background: G.palette[role] }}
                />
                {G.roleNames[role]}
              </span>
            ))}
            {["mine", "opponent"].map((side) => (
              <span key={side}>
                <i
                  className="map-dot"
                  style={{ background: G.palette[side] }}
                />
                {s.zoneLabel(side)}
              </span>
            ))}
          </div>
          {s.distanceMode === "boundaries" && (
            <p className="map-zone-gap">
              Между стартовыми зонами: <b>{s.text(24)}</b>
            </p>
          )}
          <div className="map-zoom">
            <button
              data-ma="zoom-out"
              aria-label="Уменьшить карту"
              onClick={() => s.zoomBy(-0.5)}
            >
              −
            </button>
            <span>{Math.round(s.zoom * 100)}%</span>
            <button
              data-ma="zoom-in"
              aria-label="Увеличить карту"
              onClick={() => s.zoomBy(0.5)}
            >
              +
            </button>
            <button data-ma="zoom-reset" onClick={() => s.setField("zoom", 1)}>
              Вписать
            </button>
          </div>
          <p className="battle-rule-note">
            36″ × 36″. Стартовая полоса — 6″ от края. Все точки имеют диаметр
            1″. Координаты задают их центр. «От краёв баз» учитывает размер,
            «Между центрами» — нет. Расстояния — по прямой.
          </p>
        </section>
        <aside className="map-details">
          <label className="field">
            Точка отсчёта
            <select
              id="map-origin"
              value={s.origin?.id || ""}
              onChange={(e) => s.setField("selected", e.target.value)}
            >
              <option value="">Выбрать точку…</option>
              {s.points.map((p) => (
                <option key={p.id} value={p.id}>
                  {s.pointName(p)}
                </option>
              ))}
            </select>
          </label>
          <DistancePanel />
        </aside>
      </div>
      {s.distanceMode === "objects" && (
        <details data-ui-disclosure className="map-all-distances">
          <summary>Все расстояния между точками · {s.points.length}</summary>
          {s.points.length < 2 ? (
            <p className="muted">Добавьте как минимум две точки.</p>
          ) : (
            <div className="map-matrix-scroll">
              <table className="map-matrix">
                <thead>
                  <tr>
                    <th />
                    {s.points.map((p) => (
                      <th key={p.id}>
                        <button
                          data-ma="select"
                          data-key={p.id}
                          onClick={() => s.setField("selected", p.id)}
                        >
                          {p.kind === "objective" ? p.code : p.name}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.points.map((a) => (
                    <tr key={a.id}>
                      <th>{a.kind === "objective" ? a.code : a.name}</th>
                      {s.points.map((bb) => (
                        <td key={bb.id}>
                          {a.id === bb.id
                            ? "—"
                            : s.text(G.distance(a, bb, s.mode))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
      <div className="source-line">
        <a
          href="https://www.jarvis-protocol.com/mission-previewer"
          target="_blank"
          rel="noopener"
        >
          Раскладки · Jarvis Protocol ↗
        </a>
        <a
          href="https://www.atomicmassgames.com/mcp-rules/"
          target="_blank"
          rel="noopener"
        >
          Правила расстановки · AMG ↗
        </a>
      </div>
      <RenameDialog />
    </>
  );
});
