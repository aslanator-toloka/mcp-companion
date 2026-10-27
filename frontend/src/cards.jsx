import React, {
  useId,
  useLayoutEffect,
  useRef,
  useEffect,
  useState,
  useMemo,
} from "react";
import { observer } from "mobx-react-lite";
import { cardViews, catalog } from "./stores/index.js";
import { fitNativeCards, fitNativeGameCards } from "./card-layout.js";
import { annotationReference, ruleReference } from "./rule-references.js";
const labels = {
  stamina: "Stamina",
  speed: "Speed",
  size: "Size",
  threat: "Threat",
  physical: "Physical",
  energy: "Energy",
  mystic: "Mystic",
  power: "Power",
  damage: "Damage",
  range: "Range",
  strength: "Strength",
  wild: "Wild",
  critical: "Critical",
  failure: "Failure",
  hit: "Hit",
  block: "Block",
  active: "Active",
  reactive: "Reactive",
  innate: "Innate",
  leadership: "Leadership",
  range_small: "S",
  range_medium: "M",
  range_large: "L",
  movement_small: "S",
  movement_medium: "M",
  movement_large: "L",
};
export function Icon({ name, badge = false }) {
  const key = name.replace(/^badge-(attack-)?/, ""),
    label = labels[key] || key;
  return Object.hasOwn(labels, key) ? (
    <img
      className={"sc-icon" + (badge ? " sc-badge-icon" : "")}
      src={"assets/card-icons/" + name + ".png"}
      alt={label}
      title={label}
      width="24"
      height="24"
    />
  ) : (
    <span className="sc-token">{label}</span>
  );
}
export function Rule({ text, delimiter = "|", depth = 0 }) {
  if (depth > 4) return String(text ?? "");
  return String(text ?? "")
    .split(delimiter)
    .map((part, i) => {
      const nested = (body) => (
        <Rule
          text={body}
          delimiter={delimiter === "|" ? "&" : "|"}
          depth={depth + 1}
        />
      );
      let content;
      if (i % 2 === 0)
        content = part.split("\n").map((line, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {line}
          </React.Fragment>
        ));
      else if (part === "\\") content = <br />;
      else if (part[0] === "!") content = <Icon name={part.slice(1)} />;
      else if (part[0] === "*")
        content = <strong>{nested(part.slice(1))}</strong>;
      else if (part[0] === "~")
        content = (
          <span className="sc-rule-option">{nested(part.slice(1))}</span>
        );
      else if (part[0] === "§" || part[0] === "£") {
        const end = part.indexOf(part[0], 1);
        content =
          end < 0 ? (
            part
          ) : part[0] === "§" ? (
            <ConditionReference condition={part.slice(1, end)}>
              {nested(part.slice(end + 1))}
            </ConditionReference>
          ) : (
            <RuleReference reference={"character:" + part.slice(1, end)}>
              {nested(part.slice(end + 1))}
            </RuleReference>
          );
      } else if (part[0] === "<") {
        const end = part.indexOf(">");
        content =
          end < 0 ? (
            part
          ) : (
            <RuleReference reference={"token:" + part.slice(1, end)}>
              {nested(part.slice(end + 1))}
            </RuleReference>
          );
      } else if (part[0] === "$") {
        const match = part.match(/^\$([A-Z])-(.+)$/);
        content = match ? (
          <RuleReference reference={"map:" + match[1]}>
            {nested(match[2])}
          </RuleReference>
        ) : (
          part
        );
      } else if (part[0] === "=") {
        const match = part.match(/^=([^=]+)=([^=]+)=([\s\S]+)$/);
        const key =
          match && annotationReference(match[2], match[3].replaceAll("&", "|"));
        content = match ? (
          <RuleReference reference={key ? "note:" + key : null}>
            {nested(match[1])}
          </RuleReference>
        ) : (
          part
        );
      } else content = delimiter + part + delimiter;
      return <React.Fragment key={i}>{content}</React.Fragment>;
    });
}
export const RuleReference = observer(function RuleReference({
  reference,
  children,
}) {
  if (!ruleReference(reference)) return <span>{children}</span>;
  return (
    <button
      type="button"
      className="sc-condition-reference sc-rule-reference"
      data-rule-reference={reference}
      aria-haspopup="dialog"
      aria-controls="sc-reference-dialog"
      aria-expanded={cardViews.reference === reference}
      onClick={(event) => {
        event.stopPropagation();
        cardViews.showReference(reference);
      }}
    >
      {children}
    </button>
  );
});
export const ConditionReference = observer(function ConditionReference({
  condition,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className="sc-condition-reference"
      data-card-condition={condition}
      aria-haspopup="dialog"
      aria-controls="sc-condition-dialog"
      aria-expanded={cardViews.condition === condition}
      {...props}
      onClick={(event) => {
        event.stopPropagation();
        cardViews.showCondition(condition);
      }}
    >
      {children}
    </button>
  );
});
export function Attack({ attack: a, change }) {
  return (
    <article className="sc-ability sc-attack">
      <header className="sc-attack-heading">
        <div className="sc-ability-heading">
          <Icon name={"badge-attack-" + a.type} badge />
          <h4>{a.name}</h4>
        </div>
        <dl className="sc-attack-stats">
          <div>
            <dt>
              <Icon name="badge-range" />
            </dt>
            <dd>{a.range}</dd>
          </div>
          <div>
            <dt>
              <Icon name="badge-strength" />
            </dt>
            <dd
              className={
                change?.strength?.changed ? "sc-live-changed" : undefined
              }
              title={
                change?.strength?.changed ? change.strength.reason : undefined
              }
            >
              {change?.strength?.value ?? a.strength}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="badge-power" />
            </dt>
            <dd>{a.powerCost ?? 0}</dd>
          </div>
        </dl>
      </header>
      {a.steps?.length > 0 && (
        <ul className="sc-rules">
          {a.steps.map((s, i) => (
            <li key={i}>
              <Rule text={s} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
export function Power({ power: p, change }) {
  const raw = change?.cost?.value ?? p.powerCost,
    cost = Number(raw) === 100 ? "X" : raw;
  return (
    <article className={"sc-ability sc-superpower sc-" + p.type}>
      <header className="sc-power-heading">
        <div className="sc-ability-heading">
          <Icon name={"badge-" + p.type} badge />
          <h4>{p.name}</h4>
        </div>
        {cost != null && (
          <span
            className={
              "sc-power-cost" +
              (change?.cost?.changed ? " sc-cost-changed" : "")
            }
            aria-label={"Power: " + cost}
            title={change?.cost?.changed ? change.cost.reason : undefined}
          >
            <Icon name="power" />
            <b>{cost}</b>
          </span>
        )}
      </header>
      {p.body && (
        <div className="sc-power-body">
          <Rule text={p.body} />
        </div>
      )}
    </article>
  );
}
const sorted = (rows) =>
  [...(rows || [])].sort((a, b) => (a.rank || 0) - (b.rank || 0));
export function Pill({ name, value, label, change }) {
  const shown = change?.value ?? value,
    reason = change?.changed
      ? `${label}: ${change.base} → ${shown}. ${change.reason || ""}`
      : undefined;
  return (
    <div
      className={"sc-stat" + (change?.changed ? " sc-stat-changed" : "")}
      data-stat={name}
      aria-label={label + ": " + (shown ?? "—")}
      title={reason}
    >
      <Icon name={"badge-" + name} badge />
      <b>{shown ?? "—"}</b>
    </div>
  );
}
const safeArt = (value) => {
  try {
    const u = new URL(
      value,
      String(value).startsWith("/artworks/")
        ? "https://d15s9aja3f2wkq.cloudfront.net"
        : "https://www.jarvis-protocol.com",
    );
    return u.protocol === "https:" &&
      ["www.jarvis-protocol.com", "d15s9aja3f2wkq.cloudfront.net"].includes(
        u.hostname,
      )
      ? u.href
      : "";
  } catch {
    return "";
  }
};
const skinAsset = (value) =>
  typeof value === "string" &&
  /^assets\/card-skins\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|webp|jpe?g|svg)$/.test(
    value,
  )
    ? value
    : "";
function Art({ mode, image, fallback, name, settings = {} }) {
  const [failed, setFailed] = useState(false),
    [useFallback, setUseFallback] = useState(false);
  useEffect(() => {
    setFailed(false);
    setUseFallback(false);
  }, [image]);
  if (mode === "none" || !image) return <div className="sc-art sc-art-none" />;
  const frame = Object.fromEntries(
    Object.entries(settings.frame || {}).filter(
      ([k, v]) =>
        ["left", "bottom", "width", "height", "maxWidth"].includes(k) &&
        Number.isFinite(v),
    ),
  );
  return (
    <div
      className={"sc-art sc-art-" + mode + (failed ? " sc-art-failed" : "")}
      style={frame}
    >
      <div className="sc-art-illustration">
        <img
          src={useFallback ? fallback : image}
          data-card-fallback={
            !useFallback && fallback !== image ? fallback : undefined
          }
          alt={name}
          decoding="async"
          hidden={failed}
          onError={() => {
            if (!useFallback && fallback && fallback !== image)
              setUseFallback(true);
            else setFailed(true);
          }}
        />
      </div>
      {mode === "classic" && (
        <div
          className="sc-art-spacer"
          style={{
            height: Number.isFinite(settings.bottomSpacer)
              ? settings.bottomSpacer
              : 48,
          }}
        />
      )}
      <p className="sc-art-status" role="status" hidden={!failed}>
        Иллюстрация недоступна в источнике.
      </p>
    </div>
  );
}
export const StatCard = observer(function StatCard({ view: v }) {
  const { slug, detail, form = 0, side = "front", battle } = v,
    character = catalog.byId.get(slug) || {},
    metadata = cardViews.metadata || {},
    card = form === 1 ? detail?.secondStatCard : detail?.statCard,
    metrics = metadata.layout?.[slug]?.[form]?.[side] || {},
    sourceFace = side === "back" ? card?.backSide : card?.frontSide,
    artOnly = !sourceFace && metrics.art?.mode === "grunt",
    face = sourceFace || (artOnly ? { type: "artwork" } : null);
  if (!card || !face)
    return (
      <div className="sc-unavailable" role="status">
        Эта сторона карточки недоступна.
      </div>
    );
  const candidate = metadata.skins?.[slug],
    skin = candidate && Number(candidate.form || 0) === form ? candidate : null,
    layers = cardViews.layers.get(slug) || {},
    nameSkin = layers.name !== false ? skin?.name : null,
    background =
      layers.background !== false ? skinAsset(skin?.background?.src) : "",
    characterSkin = layers.character !== false ? skin?.character?.[side] : null,
    alternative = skinAsset(characterSkin?.src);
  const name = face.nameOverride || card.name || character.name || slug,
    image = safeArt(
      metrics.art?.url ||
        metadata.art?.[slug]?.[form]?.[side] ||
        face.artworkUrl ||
        face.fallbackArtworkUrl ||
        "",
    ),
    fallback = safeArt(
      metadata.art?.[slug]?.[form]?.front ||
        face.fallbackArtworkUrl ||
        (artOnly ? card.frontSide?.fallbackArtworkUrl : "") ||
        "",
    ),
    injured = face.type === "injured",
    width = character.isGrunt ? 550 : 1200,
    height = character.isGrunt ? 950 : 800,
    mode =
      metrics.art?.mode ||
      (character.isGrunt
        ? "none"
        : card.template === "2023"
          ? "canvas"
          : "classic");
  const lines = nameSkin
    ? (Array.isArray(nameSkin.lines) && nameSkin.lines.length
        ? nameSkin.lines
        : [nameSkin.text || name]
      ).slice(0, 3)
    : null;
  return (
    <>
      <div
        className="sc-card-stage"
        data-native-width={width}
        data-native-height={height}
      >
        <article
          className={`sc-card ${injured ? "sc-injured" : "sc-healthy"} ${character.isGrunt ? "sc-grunt" : ""} ${artOnly ? "sc-art-only" : ""}`}
          aria-label={`${name} · ${artOnly ? "Artwork" : injured ? "Injured" : "Healthy"}`}
          lang="en"
          data-card-template={
            character.isGrunt
              ? "grunt"
              : card.template === "2023"
                ? "2023"
                : "classic"
          }
        >
          {background && (
            <img
              className="sc-skin-background"
              src={background}
              alt=""
              aria-hidden="true"
              decoding="async"
            />
          )}
          <Art
            mode={alternative ? "alternative" : mode}
            image={alternative || image}
            fallback={alternative ? image : fallback}
            name={name}
            settings={
              alternative
                ? {
                    frame: {
                      left: 0,
                      bottom: 24,
                      width: 313,
                      height: 500,
                      ...characterSkin.frame,
                    },
                  }
                : metrics.art
            }
          />
          <aside className="sc-character-panel">
            <div
              className={
                "sc-identity" + (nameSkin ? " sc-identity-alternative" : "")
              }
            >
              {nameSkin ? (
                <h3
                  className={
                    "sc-name-styled sc-name-" +
                    (["noir", "comic", "classic"].includes(nameSkin.style)
                      ? nameSkin.style
                      : "classic")
                  }
                  aria-label={nameSkin.text || name}
                >
                  {lines.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </h3>
              ) : (
                <h3 data-name-font={metrics.nameSize || 35}>{name}</h3>
              )}
              {card.alterEgo && <p>{card.alterEgo}</p>}
            </div>
            {!artOnly && (
              <div className="sc-stats">
                <div className="sc-defenses">
                  {[
                    ["physical", "physicalDefense", "Physical"],
                    ["energy", "energyDefense", "Energy"],
                    ["mystic", "mysticDefense", "Mystic"],
                  ].map(([name, key, label]) => (
                    <Pill
                      key={name}
                      name={name}
                      value={face[key]}
                      label={label}
                      change={battle?.stats[name]}
                    />
                  ))}
                </div>
                <div className="sc-vitals">
                  <Pill
                    name="stamina"
                    value={face.stamina}
                    label="Stamina"
                    change={battle?.stats.stamina}
                  />
                  {!character.isGrunt && (
                    <Pill
                      name="threat"
                      value={face.threatLevel}
                      label="Threat"
                    />
                  )}
                  <Pill name="size" value={face.size} label="Size" />
                  <Pill
                    name="speed"
                    value={face.speed}
                    label="Speed"
                    change={battle?.stats.speed}
                  />
                </div>
              </div>
            )}
          </aside>
          {!artOnly && (
            <div className="sc-rules-panel">
              <div
                className="sc-rules-content"
                data-rule-leading={metrics.lineHeight || 20.8}
              >
                {sorted(face.attacks).map((a, i) => (
                  <Attack key={i} attack={a} change={battle?.attacks[i]} />
                ))}
                {sorted(face.superPowers).map((p, i) => (
                  <Power key={i} power={p} change={battle?.powers[i]} />
                ))}
              </div>
            </div>
          )}
          <footer className="sc-credit">
            © MARVEL © AMG ·{" "}
            {(side === "back" && card.secondSideArtist) || card.artist || ""}
          </footer>
        </article>
      </div>
      {card.erratas?.length > 0 && (
        <details className="sc-errata">
          <summary>Обновления правил · {card.erratas.length}</summary>
          {card.erratas.map((e, i) => (
            <div key={i}>
              <time>{e.createdOn}</time>
              <p>
                <Rule text={e.body} />
              </p>
            </div>
          ))}
        </details>
      )}
    </>
  );
});
function useCardLayout(ref, fit, deps) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fit(el));
    };
    fit(el);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    document.fonts?.ready.then(schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, deps);
}
export const StatControls = observer(function StatControls({
  view: v,
  onSwitch,
}) {
  const card = v.form === 1 ? v.detail?.secondStatCard : v.detail?.statCard,
    reverseArt =
      cardViews.metadata?.layout?.[v.slug]?.[v.form]?.back?.art?.mode ===
      "grunt",
    skin = cardViews.metadata?.skins?.[v.slug],
    layers = cardViews.layers.get(v.slug) || {},
    matching = skin && Number(skin.form || 0) === (v.form || 0),
    available = {
      name: !!skin?.name,
      background: !!skin?.background,
      character: !!skin?.character?.[v.side || "front"],
    };
  const change = (field, value) => {
    onSwitch?.(field, value);
  };
  const formName = (c) =>
    c?.frontSide?.nameOverride || c?.name || "Другая форма";
  const control = (field, value, label, selected) => (
    <button
      key={String(value)}
      type="button"
      data-cv={field}
      {...{ ["data-" + field]: value }}
      className={selected ? "selected" : ""}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        change(field, value);
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="stat-card-controls">
      {v.detail?.secondStatCard && (
        <div className="side-switch" role="group" aria-label="Форма персонажа">
          {control("form", 0, formName(v.detail.statCard), v.form === 0)}
          {control("form", 1, formName(v.detail.secondStatCard), v.form === 1)}
        </div>
      )}
      <div className="side-switch" role="group" aria-label="Сторона карточки">
        {control(
          "side",
          "front",
          card?.frontSide?.type === "injured"
            ? "Injured · ранен"
            : "Healthy · здоров",
          v.side === "front",
        )}
        {(card?.backSide || reverseArt) &&
          control(
            "side",
            "back",
            card.backSide?.type === "injured"
              ? "Injured · ранен"
              : "Обратная сторона",
            v.side === "back",
          )}
      </div>
      {matching && (
        <fieldset className="stat-card-skin-controls">
          <legend>Оформление · {skin.label || "Альтернативное"}</legend>
          {[
            ["name", "Название"],
            ["background", "Фон"],
            ["character", "Изображение"],
          ].map(([key, label]) => (
            <label
              key={key}
              className="check"
              title={
                !available[key]
                  ? "Альтернативный слой пока не добавлен"
                  : undefined
              }
            >
              <input
                type="checkbox"
                data-card-skin-layer={key}
                checked={available[key] && layers[key] !== false}
                disabled={!available[key]}
                onChange={(event) => {
                  event.stopPropagation();
                  cardViews.setLayers(v.slug, { [key]: event.target.checked });
                }}
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            className="quiet"
            data-cv="skin-reset"
            onClick={(event) => {
              event.stopPropagation();
              cardViews.setLayers(v.slug, {
                name: false,
                background: false,
                character: false,
              });
            }}
          >
            Оригинал
          </button>
        </fieldset>
      )}
    </div>
  );
});
const typeLabel = {
  active: "Active",
  reactive: "Reactive",
  active_action: "Active / Action",
  both: "Active / Reactive",
  reactive_reactive: "Reactive",
};
const gameImage = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      u.hostname === "d15s9aja3f2wkq.cloudfront.net"
      ? u.href
      : "";
  } catch {
    return "";
  }
};
function GameArtwork({ src }) {
  const [failed, setFailed] = useState(false);
  return src ? (
    <img
      className="gc-tactic-art"
      src={failed ? "assets/game-cards/question-mark.png" : src}
      data-game-art
      alt=""
      onError={(e) => {
        if (failed) e.currentTarget.hidden = true;
        else setFailed(true);
      }}
    />
  ) : null;
}
function RuleGroup({ label, text }) {
  return text ? (
    <div className="gc-tactic-rule-group">
      {label && <h3>{label}</h3>}
      <div className="gc-tactic-text">
        <Rule text={String(text).replace(/\r?\n/g, " ")} />
      </div>
    </div>
  ) : null;
}
function Tactic({ card: c, visual, side, data }) {
  const playSide = side === "front" || visual.doubleSided,
    face = side === "front" ? "front" : "back",
    attacks = (c.attacks || visual.attacks || []).filter(
      (a) => !a.form || a.form === "normal" || a.form === face,
    ),
    powers = (c.superPowers || visual.superPowers || []).filter(
      (p) => !p.form || p.form === face,
    ),
    art = gameImage(visual.artUrl);
  const rules = visual.doubleSided ? (
    <RuleGroup
      label={typeLabel[c.type]}
      text={side === "front" ? c.body : c.secondaryBody}
    />
  ) : c.type === "both" || c.type === "reactive_reactive" ? (
    <>
      <RuleGroup
        label={c.type === "both" ? "Active" : "Reactive"}
        text={c.body}
      />
      <RuleGroup label="Reactive" text={c.secondaryBody} />
    </>
  ) : (
    <>
      <RuleGroup label={typeLabel[c.type] || c.type} text={c.body} />
      {c.intermediaryBody && (
        <div className="gc-tactic-text gc-intermediary">
          <Rule text={String(c.intermediaryBody).replace(/\r?\n/g, " ")} />
        </div>
      )}
      <RuleGroup
        label={visual.repeatType ? typeLabel[c.type] : ""}
        text={c.secondaryBody}
      />
    </>
  );
  return (
    <article
      className={`gc-card gc-tactic ${playSide ? "gc-rules-face" : "gc-art-face"} ${visual.squished ? "gc-squished" : ""}`}
      lang="en"
      aria-label={`${c.name} · ${playSide ? "Rules" : "Artwork"}`}
    >
      <GameArtwork src={art} />
      <div className="gc-tactic-title">
        <h2>{c.name}</h2>
      </div>
      {playSide && (
        <>
          <div className="gc-tactic-art-space">
            {attacks.map((a, i) => (
              <Attack key={i} attack={a} />
            ))}
          </div>
          <div className="gc-tactic-content">
            {c.threatLevel != null ? (
              <div className="gc-gem-threat">
                <Icon name="badge-threat" badge />
                <b>{c.threatLevel}</b>
              </div>
            ) : (
              <h3 className="gc-affiliation">
                {c.affiliation?.name || "Unaffiliated"}
              </h3>
            )}
            {rules}
            {powers.map((p, i) => (
              <Power key={i} power={p} />
            ))}
          </div>
          <div className="gc-tactic-bottom-space" />
          <footer className="gc-tactic-credit">
            <span>© MARVEL © AMG</span>
            <span>{visual.artist || ""}</span>
            {data.symbols?.[c.setSymbol] && (
              <img src={data.symbols[c.setSymbol]} alt={c.setSymbol} />
            )}
          </footer>
        </>
      )}
    </article>
  );
}
function Threat({ card: c }) {
  const id = "gc-threat-" + useId(),
    label = c.type === "Secure" ? "SECURE" : "EXTRACTION";
  return (
    <svg
      className="gc-threat"
      viewBox="0 0 72 72"
      role="img"
      aria-label={`Threat ${c.threatLevel} · ${label}`}
    >
      <defs>
        <path id={id} d="M36 5a31 31 0 1 1-.01 0" />
      </defs>
      <circle cx="36" cy="36" r="34" className="gc-threat-ring" />
      <circle cx="36" cy="36" r="22" fill="#fff" />
      <text className="gc-threat-ring-text">
        <textPath href={"#" + id} textLength="190" lengthAdjust="spacing">
          THREAT {label} THREAT {label}
        </textPath>
      </text>
      <text
        x="36"
        y="37"
        className="gc-threat-number"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {c.threatLevel}
      </text>
    </svg>
  );
}
export function CrisisDiagram({ card: c, data }) {
  const points = data.layouts?.[c.setup];
  if (!Array.isArray(points))
    return <div className="gc-map-unavailable">Setup {c.setup || "—"}</div>;
  const unit = 304 / 36,
    sizes = { 2: 3, 3: 6, 4: 8, 5: 10 },
    types = [
      ["Source", "source"],
      ["Zone", "zone"],
      ["Point of Interest", "poi"],
      ["Target of Opportunity", "target"],
      ["Asset", "asset"],
      ["Assets", "asset"],
      ["Civilian", "civilian"],
      ["Civilians", "civilian"],
    ],
    base =
      data.tokens?.[
        types.find(([label]) =>
          String(c.setupDescription).includes("(" + label + ")"),
        )?.[1]
      ],
    family = c.cardFamily || c.slug;
  return (
    <svg
      className="gc-map"
      viewBox="0 0 304 304"
      role="img"
      aria-label={`Расстановка ${c.setup}: ${points.length} жетонов`}
      data-setup={c.setup}
    >
      <image href={data.assets?.board || ""} width="304" height="304" />
      {(data.rulers?.[c.setup] || []).map((r, i) => {
        const h = r.direction === "horizontal",
          x = r.x * unit - (h ? 0 : 6),
          y = r.y * unit - (h ? 6 : 0),
          w = h ? sizes[r.size] * unit : 12,
          hh = h ? 12 : sizes[r.size] * unit,
          tx = x + w / 2,
          ty = y + hh / 2;
        return (
          <g key={i} className="gc-range-ruler">
            <rect x={x} y={y} width={w} height={hh} />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              transform={h ? undefined : `rotate(90 ${tx} ${ty})`}
            >
              {r.size}⊕
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        let src = base,
          rotation = 0;
        if (family === "research-station-attacked" && i === 1)
          src = data.tokens?.civilian;
        if (
          family === "mystic-wakandan-herb-fact-or-fiction" &&
          (i === 1 || i === 2)
        )
          src = data.tokens?.asset;
        if (family === "terrigen-clouds-sweep-over-city" && i === 1) src = null;
        if (family === "x-men-infiltrate-secret-weapons-facility")
          rotation = [315, 225, 135, 45][i] || 0;
        return (
          <g
            key={i}
            data-objective={i + 1}
            transform={`translate(${p.x * unit} ${p.y * unit}) rotate(${rotation})`}
          >
            <circle r="9" fill="#6c6c6c" />
            {src && <image href={src} x="-9" y="-9" width="18" height="18" />}
          </g>
        );
      })}
      {family === "lockdown-security-systems-stymie-breakout" &&
        [
          [43.5, 100],
          [66.5, 100],
          [210, 100],
          [210.5, 184],
          [233.5, 184],
        ].map(([x, y], i) => (
          <image
            key={i}
            href={data.lockdownIcons?.[i] || ""}
            x={x}
            y={y}
            width="20"
            height="20"
          />
        ))}
      <rect
        x="1"
        y="1"
        width="302"
        height="302"
        rx="10"
        className="gc-map-border"
      />
    </svg>
  );
}
function Crisis({ card: c, visual, side, data }) {
  const legacy = visual.template === "2019",
    secure = c.type === "Secure",
    width = legacy ? 384 : 459,
    height = legacy ? 640 : 750,
    back =
      data.assets?.[
        (secure ? "backSecure" : "backExtraction") + (legacy ? "2019" : "2023")
      ];
  if (side === "back")
    return (
      <article
        className={"gc-card gc-crisis" + (legacy ? " gc-crisis-legacy" : "")}
        style={{ width, height }}
        aria-label={c.name + " · Back"}
      >
        <img
          className="gc-crisis-back"
          src={back || ""}
          alt={(secure ? "Secure" : "Extraction") + " crisis card back"}
        />
      </article>
    );
  return (
    <article
      className={"gc-card gc-crisis" + (legacy ? " gc-crisis-legacy" : "")}
      style={{ width, height }}
      lang="en"
      aria-label={c.name}
    >
      <img
        className="gc-crisis-paper"
        src={data.assets?.[secure ? "crisisSecure" : "crisisExtraction"] || ""}
        alt=""
      />
      <div className="gc-crisis-content">
        {legacy ? (
          <>
            <div className="gc-newspaper">
              <span>DAILY</span>
              <Threat card={c} />
              <span>BUGLE</span>
            </div>
            <h2 className="gc-crisis-title">{c.name}</h2>
          </>
        ) : (
          <header className="gc-crisis-heading">
            <Threat card={c} />
            <h2 className="gc-crisis-title">{c.name}</h2>
          </header>
        )}
        <div className="gc-crisis-rules">
          <div className="gc-setup-scoring">
            <section>
              <h3>SETUP</h3>
              <div>
                <Rule
                  text={String(c.setupDescription ?? "").replace(/\r?\n/g, " ")}
                />
              </div>
            </section>
            <section>
              <h3>SCORING</h3>
              <div>
                <Rule
                  text={String(c.scoringDescription ?? "").replace(
                    /\r?\n/g,
                    " ",
                  )}
                />
              </div>
            </section>
          </div>
          <div className="gc-crisis-paragraphs">
            {(c.paragraphs || [])
              .filter((p) => p !== ".")
              .map((p, i) => (
                <p key={i}>
                  <Rule text={String(p).replace(/\r?\n/g, " ")} />
                </p>
              ))}
            {(c.attacks || visual.attacks || []).map((a, i) => (
              <Attack key={i} attack={a} />
            ))}
          </div>
        </div>
        <div className="gc-crisis-space" />
        {!legacy && <CrisisDiagram card={c} data={data} />}
        <footer className="gc-crisis-credit">
          <span>© MARVEL © AMG</span>
          {data.symbols?.[c.setSymbol] && (
            <img src={data.symbols[c.setSymbol]} alt={c.setSymbol} />
          )}
        </footer>
      </div>
    </article>
  );
}
export const GameCard = observer(function GameCard({
  card,
  kind,
  side = "front",
  corner,
}) {
  const ref = useRef(null),
    data = cardViews.metadata?.game || {},
    visual = data[kind]?.[card.slug] || {},
    legacy = kind === "crises" && visual.template === "2019",
    width = kind === "tactics" ? 446 : legacy ? 384 : 459,
    height = kind === "tactics" ? 640 : legacy ? 640 : 750;
  useCardLayout(ref, fitNativeGameCards, [card, kind, side, visual]);
  return (
    <div ref={ref}>
      <div
        className="gc-stage"
        data-game-width={width}
        data-game-height={height}
        data-game-kind={kind}
      >
        {kind === "tactics" ? (
          <Tactic card={card} visual={visual} side={side} data={data} />
        ) : (
          <Crisis card={card} visual={visual} side={side} data={data} />
        )}
        {corner}
      </div>
    </div>
  );
});
function CardModal({
  id,
  className,
  labelledBy,
  describedBy,
  open,
  onClose,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      className={className}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose?.(event);
      }}
    >
      {children}
    </dialog>
  );
}
export const GameCardModal = observer(function GameCardModal() {
  const v = cardViews.game,
    c = v?.card,
    source = c
      ? "https://www.jarvis-protocol.com/" +
        (v.kind === "tactics" ? "team-tactics-cards/" : "crisis-cards/") +
        (v.kind === "tactics" ? c.cardFamily : c.slug)
      : "";
  return (
    <CardModal
      id="game-card-dialog"
      className="game-card-dialog"
      open={!!v}
      onClose={cardViews.closeGame}
    >
      <div id="game-card-content">
        {v && (
          <>
            <header className="gc-dialog-head">
              <div>
                <strong>{c.name}</strong>
                {v.metadata && <small>{v.metadata}</small>}
              </div>
              <button
                type="button"
                className="quiet close"
                data-rs="close-card"
                aria-label="Закрыть игровую карту"
                onClick={cardViews.closeGame}
              >
                ×
              </button>
            </header>
            <div className="gc-dialog-body">
              <div
                className="gc-controls side-switch"
                role="group"
                aria-label="Сторона игровой карты"
              >
                {[
                  ["front", "Лицевая сторона"],
                  ["back", "Обратная сторона"],
                ].map(([side, label]) => (
                  <button
                    key={side}
                    type="button"
                    data-game-side={side}
                    aria-pressed={v.side === side}
                    className={v.side === side ? "selected" : ""}
                    onClick={() => cardViews.gameSide(side)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="gc-surface">
                <GameCard card={c} kind={v.kind} side={v.side} />
              </div>
              <div className="source-line">
                <a href={source} target="_blank" rel="noopener">
                  Карта на Jarvis ↗
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </CardModal>
  );
});
export const ConditionModal = observer(function ConditionModal() {
  const key = cardViews.condition,
    item = cardViews.metadata?.conditions[key];
  return (
    <CardModal
      id="sc-condition-dialog"
      className="sc-condition-dialog"
      labelledBy="sc-condition-title"
      describedBy="sc-condition-body"
      open={!!item}
      onClose={cardViews.closeCondition}
    >
      {item && (
        <div className="sc-condition-description" lang="en">
          <button
            type="button"
            className="sc-condition-close"
            aria-label="Закрыть описание состояния"
            onClick={cardViews.closeCondition}
          >
            ×
          </button>
          <img
            className="sc-condition-token"
            src={"assets/conditions/" + key + ".png"}
            alt=""
            width="160"
            height="160"
          />
          <h2 id="sc-condition-title">{item.name}</h2>
          <p id="sc-condition-body">
            <Rule text={item.body} />
          </p>
        </div>
      )}
    </CardModal>
  );
});
const ReferencedCharacter = observer(function ReferencedCharacter({ slug }) {
  const [error, setError] = useState(""),
    [attempt, retry] = useState(0);
  const detail = catalog.details.get(slug);
  const view = useMemo(
    () => ({ key: "reference-" + slug, slug, detail, form: 0, side: "front" }),
    [slug, detail],
  );
  useEffect(() => {
    let active = true;
    setError("");
    catalog.detail(slug).catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [slug, attempt]);
  if (error)
    return (
      <p role="alert">
        {error} <button onClick={() => retry(attempt + 1)}>Повторить</button>
      </p>
    );
  return detail ? (
    <StatSurface view={view} />
  ) : (
    <p role="status">Загружаем карту…</p>
  );
});
export const RuleReferenceModal = observer(function RuleReferenceModal() {
  const item = ruleReference(cardViews.reference);
  const name =
    item?.type === "character"
      ? catalog.byId.get(item.key)?.name || item.key
      : item?.name;
  return (
    <CardModal
      id="sc-reference-dialog"
      className={
        "sc-reference-dialog" +
        (item?.type === "character" ? " sc-reference-character" : "")
      }
      labelledBy="sc-reference-title"
      open={!!item}
      onClose={cardViews.closeReference}
    >
      {item && (
        <>
          <header className="sc-reference-heading">
            <h2 id="sc-reference-title">{name}</h2>
            <button
              type="button"
              aria-label="Закрыть пояснение"
              onClick={cardViews.closeReference}
            >
              ×
            </button>
          </header>
          {item.type === "token" && item.src && (
            <img
              className="sc-reference-token"
              src={item.src}
              alt={name}
              width={item.double ? 320 : 160}
            />
          )}
          {item.body && (
            <div className="sc-reference-note">
              <Rule text={item.body} />
            </div>
          )}
          {item.type === "map" && (
            <CrisisDiagram
              card={{ setup: item.key }}
              data={cardViews.metadata?.game || {}}
            />
          )}
          {item.type === "character" && (
            <ReferencedCharacter key={item.key} slug={item.key} />
          )}
        </>
      )}
    </CardModal>
  );
});
export const StatSurface = observer(function StatSurface({ view, children }) {
  const ref = useRef(null),
    layers = cardViews.layers.get(view.slug);
  const [readable, setReadable] = useState(false);
  useCardLayout(ref, fitNativeCards, [
    view,
    layers,
    cardViews.metadata,
    readable,
  ]);
  return (
    <section
      ref={ref}
      className="stat-card-viewer"
      data-card-view={view.key}
      data-card-zoom={readable ? "readable" : "fit"}
    >
      <div className="stat-view-tools">
        {children}
        <button
          type="button"
          className="stat-zoom-toggle quiet"
          aria-pressed={readable}
          onClick={() => setReadable(!readable)}
        >
          <i
            className={
              "fa-solid " +
              (readable ? "fa-compress" : "fa-magnifying-glass-plus")
            }
            aria-hidden="true"
          />
          {readable ? "Вписать карту" : "Увеличить карту"}
        </button>
      </div>
      {readable && (
        <p className="stat-zoom-hint">
          Прокрутите карту в сторону, чтобы прочитать все способности.
        </p>
      )}
      <div className="stat-card-surface">
        <StatCard view={view} />
      </div>
    </section>
  );
});
