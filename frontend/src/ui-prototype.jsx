// THROWAWAY: navigation variants on the existing app route, ?prototype=ui&variant=A|B.
// Question: can navigation and progressive disclosure reduce overload without slowing play?
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./ui-prototype.css";
import { StatSurface, StatControls, ConditionModal, RuleReferenceModal } from "./cards.jsx";
import { catalog as nativeCatalog } from "./ui-prototype-card-state.js";
history.scrollRestoration = "manual";

const variants = {
  A: ["Навигация", "Каталог без лишних панелей. Подробности открываются по запросу."],
  B: ["Партия", "Старт с текущей задачи. Каталог и инструменты — следующий уровень."],
};
const seed = ["amazing-spider-man", "black-cat", "ghost-spider", "moon-knight", "venom", "spider-man-miles-morales", "spider-woman", "scarlet-spider"];
const paths = {
  catalog: "M4 5h16v15H4zM8 5V3m8 2V3M4 10h16",
  rosters: "M8 5h12v15H8zM4 16V2h12M11 10h6m-6 4h6",
  battle: "m4 3 16 17M4 20 20 3M3 15l6 6M15 3l6 6",
  search: "M21 21l-5-5M18 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  filter: "M4 6h16M7 12h10M10 18h4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m9 5 7 7-7 7",
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3z",
};
function Icon({ name, size = 20 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.more} /></svg>; }
function Avatar({ c, large = false }) { return <img className={large ? "avatar large" : "avatar"} src={c.portrait} alt="" />; }
function App() {
  const params = new URLSearchParams(location.search);
  const [variant, setVariant] = useState(variants[params.get("variant")] ? params.get("variant") : "A");
  const [screen, setScreen] = useState(params.get("screen") || (params.get("variant") === "B" ? "home" : "catalog"));
  const [characters, setCharacters] = useState([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [affiliation, setAffiliation] = useState("");
  const [threat, setThreat] = useState("");
  const [filters, setFilters] = useState(false);
  const [owned, setOwned] = useState(new Set(seed));
  const [roster, setRoster] = useState(seed.slice(0, 5));
  const [selected, setSelected] = useState(params.get("card"));
  const [returnScreen, setReturnScreen] = useState(params.get("from") || "catalog");
  const positions = useRef({});
  const [tools, setTools] = useState(false);
  const [battle, setBattle] = useState({ round: 2, mine: 4, theirs: 3, fighters: {} });
  const [previous, setPrevious] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { fetch("data/catalog.json").then(r => r.json()).then(d => { nativeCatalog.load(d); setCharacters(d.characters.filter(c => !c.isGrunt)); }); }, []);
  const ordered = [...characters].sort((a, b) => {
    const ai = seed.indexOf(a.slug), bi = seed.indexOf(b.slug);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.name.localeCompare(b.name);
  });
  const results = ordered.filter(c =>
    `${c.name} ${c.alterEgo} ${c.affiliations.map(a => a.name).join(" ")}`.toLowerCase().includes(query.toLowerCase()) &&
    (mode !== "mine" || owned.has(c.slug)) && (!affiliation || c.affiliations.some(a => a.name === affiliation)) &&
    (!threat || c.threatLevel === Number(threat)));
  const current = characters.find(c => c.slug === selected);
  const team = roster.map(slug => characters.find(c => c.slug === slug)).filter(Boolean);
  function navigate(next) {
    positions.current[screen] = window.scrollY;
    history.pushState({}, "", location.href);
    setScreen(next); setSelected(null); setTools(false);
  }
  function openCharacter(slug) {
    positions.current[screen] = window.scrollY;
    history.pushState({ prototypeCharacter: true }, "", location.href);
    setReturnScreen(screen); setSelected(slug); setScreen("character"); setTools(false);
  }
  function closeCharacter() {
    if (history.state?.prototypeCharacter) history.back();
    else navigate(returnScreen);
  }
  function switchVariant(next) { setVariant(next); setScreen(next === "B" ? "home" : "catalog"); setSelected(null); setTools(false); }
  useEffect(() => {
    const p = new URLSearchParams(location.search); p.set("variant", variant); p.set("screen", screen);
    if (screen === "character" && selected) { p.set("card", selected); p.set("from", returnScreen); }
    else { p.delete("card"); p.delete("from"); }
    history.replaceState(history.state, "", `${location.pathname}?${p}`);
    window.scrollTo(0, positions.current[screen] || 0);
    document.title = screen === "character" && current ? `${current.name} · MCP Companion` : "MCP Companion · Прототип интерфейса";
  }, [variant, screen, selected, returnScreen, current?.name]);
  useEffect(() => {
    const sync = () => { const p = new URLSearchParams(location.search); setVariant(variants[p.get("variant")] ? p.get("variant") : "A"); setScreen(p.get("screen") || "catalog"); setSelected(p.get("card")); setReturnScreen(p.get("from") || "catalog"); };
    addEventListener("popstate", sync); return () => removeEventListener("popstate", sync);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2500); return () => clearTimeout(timer); }, [notice]);
  function toggleOwned(slug) { setOwned(old => { const n = new Set(old); n.has(slug) ? n.delete(slug) : n.add(slug); return n; }); }
  function addToRoster(c) { if (roster.includes(c.slug)) { navigate("rosters"); return; } setRoster([...roster, c.slug]); setNotice(`${c.name} добавлен в демо-ростер`); }
  function updateBattle(fn) { setPrevious(battle); setBattle(fn(battle)); }
  const nav = <>{[["battle", "Бой"], ["rosters", "Ростеры"], ["catalog", "Каталог"]].map(([id, label]) => <button key={id} className={`nav-button ${(screen === id || (screen === "character" && returnScreen === id)) ? "active" : ""}`} aria-current={(screen === id || (screen === "character" && returnScreen === id)) ? "page" : undefined} onClick={() => navigate(id)}><Icon name={id} /><span>{label}</span>{id === "battle" && <i className="live-dot" />}</button>)}</>;
  const toolMenu = <div className="tool-wrap"><button className={`tool-button ${tools ? "active" : ""}`} aria-label="Инструменты" title="Инструменты" aria-expanded={tools} onClick={() => setTools(!tools)}><Icon name="more" /></button>{tools && <div className="tool-menu"><small>В текущем приложении</small>{[["tournaments", "Турнирный архив"], ["calculator", "Калькулятор атак"], ["purchases", "Покупки и наборы"]].map(([id, label]) => <a key={id} href={`?screen=${id}`} target="_blank" rel="noreferrer">{label}<span>↗</span></a>)}</div>}</div>;
  const catalog = <>
    <div className="catalog-toolbar"><div className="segmented" aria-label="Состав каталога">{[["all", "Все"], ["mine", "В коллекции"]].map(([id, label]) => <button key={id} aria-pressed={mode === id} className={mode === id ? "active" : ""} onClick={() => setMode(id)}>{label}{id === "mine" && <small>{owned.size}</small>}</button>)}</div></div>
    <div className="search-row"><label className="search"><Icon name="search" /><input id="hero-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск персонажа" aria-label="Поиск персонажей" /><kbd>/</kbd></label><button className={`outline filter-button ${filters ? "active" : ""}`} onClick={() => setFilters(!filters)} aria-expanded={filters}><Icon name="filter" />Фильтры{(affiliation || threat) && <i className="live-dot" />}</button></div>
    {filters && <div className="filter-panel"><label>Аффилиация<select value={affiliation} onChange={e => setAffiliation(e.target.value)}><option value="">Все аффилиации</option>{[...new Set(characters.flatMap(c => c.affiliations.map(a => a.name)))].sort().map(a => <option key={a}>{a}</option>)}</select></label><label>Threat<select value={threat} onChange={e => setThreat(e.target.value)}><option value="">Любой</option>{[2, 3, 4, 5, 6, 7, 8].map(t => <option key={t}>{t}</option>)}</select></label><button className="text-button" onClick={() => { setAffiliation(""); setThreat(""); }}>Сбросить</button></div>}
    <div className="results-caption"><span>{query || affiliation || threat ? `Найдено: ${results.length}` : mode === "mine" ? "Ваши персонажи" : "Персонажи"}</span><span>THREAT</span></div>
    <div className="character-list">{results.slice(0, 65).map(c => <button key={c.slug} className={`character-row ${current?.slug === c.slug ? "selected" : ""}`} onClick={() => openCharacter(c.slug)}><Avatar c={c} /><span className="character-copy"><strong>{c.name}</strong><small>{c.alterEgo}<span className="affiliation-inline"> · {c.affiliations[0]?.name}</span></small></span>{owned.has(c.slug) && <span className="owned-mark" title="В вашей коллекции">✓</span>}<span className="threat-value">{c.threatLevel}</span><Icon name="chevron" size={16} /></button>)}{!results.length && <div className="empty-state">{characters.length ? "Ничего не найдено. Попробуйте другое имя или снимите фильтры." : "Загружаем каталог…"}</div>}</div>
    <div className="list-foot">{results.length > 65 ? `Показаны первые 65 из ${results.length}. Уточните поиск.` : `${results.length} персонажей`}<span>Карты и правила · Jarvis Protocol</span></div>
  </>;
  const home = <div className="home-page"><div className="game-callout"><div className="game-callout-top"><span className="status"><i className="live-dot" />Текущая партия</span></div><div className="game-callout-main"><div><h2>Web Warriors</h2><p>Раунд {battle.round} · Ваш ход</p></div><div className="big-score">{battle.mine}<span>:</span>{battle.theirs}</div></div><div className="game-callout-bottom"><div className="avatar-stack">{team.slice(0, 4).map(c => <Avatar key={c.slug} c={c} />)}</div><button className="primary" onClick={() => navigate("battle")}>Продолжить бой<Icon name="arrow" /></button></div></div><div className="section-heading"><h2>На следующую игру</h2><button className="text-button" onClick={() => navigate("rosters")}>Мои ростеры <Icon name="arrow" size={16} /></button></div><button className="roster-home" onClick={() => navigate("rosters")}><span className="roster-emblem">W</span><span><strong>Friendly neighborhood</strong><small>Web Warriors · {roster.length} персонажей · демо-ростер</small></span><Icon name="chevron" /></button><div className="home-catalog"><div><button className="text-button" onClick={() => navigate("catalog")}>Открыть каталог <Icon name="arrow" size={17} /></button></div><div className="portrait-spread">{ordered.slice(0, 3).map(c => <Avatar c={c} key={c.slug} />)}</div></div></div>;
  const rosterScreen = <><div className="page-heading"><div><h1>Friendly neighborhood</h1><p>Web Warriors</p></div></div><div className="roster-summary"><span><strong>{roster.length}</strong> персонажей</span><button className="primary" onClick={() => navigate("battle")}>К демо-бою<Icon name="arrow" /></button></div><div className="character-list">{team.map(c => <div className="roster-row" key={c.slug}><button className="roster-character" onClick={() => openCharacter(c.slug)}><Avatar c={c} /><span><strong>{c.name}</strong><small>{c.alterEgo}</small></span><span className="threat-value">{c.threatLevel}</span></button><button className="icon-button" aria-label={`Убрать ${c.name} из ростера`} onClick={() => setRoster(roster.filter(s => s !== c.slug))}><Icon name="close" size={16} /></button></div>)}</div><button className="add-character" onClick={() => navigate("catalog")}>+ Добавить персонажа</button></>;
  const battleScreen = <><div className="battle-scoreboard"><div><small>РАУНД</small><strong>{battle.round}</strong></div><div className="score-pair"><Counter label="Мой счёт" value={battle.mine} change={d => updateBattle(s => ({ ...s, mine: Math.max(0, s.mine + d) }))} /><span>:</span><Counter label="Счёт противника" value={battle.theirs} change={d => updateBattle(s => ({ ...s, theirs: Math.max(0, s.theirs + d) }))} /></div><button className="outline" onClick={() => updateBattle(s => ({ ...s, round: s.round + 1, fighters: Object.fromEntries(Object.entries(s.fighters).map(([k, v]) => [k, { ...v, active: false }])) }))}>Следующий раунд →</button></div><div className="section-heading"><h2>Ваш отряд <span>{team.length}</span></h2><button className="text-button" disabled={!previous} onClick={() => { setBattle(previous); setPrevious(null); }}>↶ Отменить</button></div><div className="fighters">{team.map(c => { const f = { hp: c.stamina, power: 2, active: false, ...battle.fighters[c.slug] }; const change = (key, value) => updateBattle(s => ({ ...s, fighters: { ...s.fighters, [c.slug]: { ...f, [key]: value } } })); return <div className={`fighter ${f.active ? "activated" : ""}`} key={c.slug}><button className="fighter-info" onClick={() => openCharacter(c.slug)}><Avatar c={c} /><span><strong>{c.name}</strong><small>{f.active ? "Активирован" : "Готов к активации"}</small></span></button><Counter label={`HP ${c.name}`} caption="HP" value={f.hp} change={d => change("hp", Math.max(0, Math.min(c.stamina, f.hp + d)))} /><Counter label={`Энергия ${c.name}`} caption="ЭНЕРГИЯ" value={f.power} change={d => change("power", Math.max(0, Math.min(10, f.power + d)))} /><button className={`activation ${f.active ? "done" : ""}`} aria-pressed={f.active} onClick={() => change("active", !f.active)}>{f.active ? "✓ Ход сделан" : "Активировать"}</button></div>; })}</div></>;
  const detail = current && <CharacterPage key={current.slug} c={current} owned={owned.has(current.slug)} inRoster={roster.includes(current.slug)} onOwned={() => toggleOwned(current.slug)} onAdd={() => addToRoster(current)} onBack={closeCharacter} returnScreen={returnScreen} />;
  const content = screen === "character" ? detail || <div className="empty-state" role="status">Загружаем персонажа…</div> : screen === "home" ? home : screen === "rosters" ? rosterScreen : screen === "battle" ? battleScreen : catalog;
  return <div className={`prototype variant-${variant}`}>
    {variant === "A" && <aside className="sidebar"><nav aria-label="Разделы">{nav}</nav><div className="sidebar-secondary">{toolMenu}</div></aside>}
    {variant !== "A" && <header className="topbar"><button className="icon-button" onClick={() => navigate("home")} aria-label="На главную"><Icon name="home" /></button><nav aria-label="Разделы">{nav}</nav>{toolMenu}</header>}
    <div className="workspace"><main aria-label={screen === "character" ? current?.name || "Персонаж" : screen === "catalog" ? "Каталог персонажей" : screen === "battle" ? "Бой" : screen === "rosters" ? "Ростер" : "Главная"}><div className={`main-content ${screen === "character" ? "character-page-content" : ""}`}>{content}</div></main></div>
    <ConditionModal /><RuleReferenceModal />
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {process.env.NODE_ENV !== "production" && <PrototypeSwitcher variant={variant} change={switchVariant} state={`${screen === "character" ? current?.name || "Персонаж" : screen === "catalog" ? `Каталог · ${mode === "mine" ? "Мои" : "Все"} · ${results.length}` : screen === "battle" ? `Бой · раунд ${battle.round} · ${battle.mine}:${battle.theirs}` : screen === "rosters" ? "Ростер" : "Главная"} · В ростере: ${roster.length}`} />}
  </div>;
}
function Counter({ value, change, label, caption }) { return <div className="counter-wrap">{caption && <small>{caption}</small>}<div className="counter"><button aria-label={`Уменьшить ${label}`} onClick={() => change(-1)}>−</button><strong aria-label={label}>{value}</strong><button aria-label={`Увеличить ${label}`} onClick={() => change(1)}>+</button></div></div>; }
function CharacterPage({ c, owned, inRoster, onOwned, onAdd, onBack, returnScreen }) {
  const [detail, setDetail] = useState(null), [error, setError] = useState("");
  const [face, setFace] = useState({ form: 0, side: "front" });
  useEffect(() => {
    let active = true;
    nativeCatalog.detail(c.slug).then(d => { if (active) setDetail(d); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [c.slug]);
  const view = { key: "prototype-character", slug: c.slug, detail, ...face };
  return <section className="character-page">
    <div className="character-page-toolbar">
      <button className="text-button page-back" onClick={onBack}>← {returnScreen === "rosters" ? "Ростер" : returnScreen === "battle" ? "Бой" : "Каталог"}</button>
      <div className="character-page-actions">
        <button className={`collection-toggle ${owned ? "owned" : ""}`} aria-pressed={owned} onClick={onOwned}>{owned ? "✓ В коллекции" : "+ В коллекцию"}</button>
        <button className="primary" onClick={onAdd}>{inRoster ? "Открыть ростер" : "+ В ростер"}<Icon name="arrow" size={17} /></button>
      </div>
    </div>
    {error ? <p role="alert">{error}</p> : detail ? <StatSurface view={view}>
      <StatControls view={view} onSwitch={(field, value) => setFace(previous => field === "form" ? { form: value, side: "front" } : { ...previous, side: value })} />
    </StatSurface> : <div className="empty-state" role="status">Загружаем карту…</div>}
    <div className="native-card-source"><a href={c.sourceUrl} target="_blank" rel="noreferrer">Jarvis ↗</a></div>
  </section>;
}
function PrototypeSwitcher({ variant, change, state }) {
  const cycle = d => { const keys = Object.keys(variants); change(keys[(keys.indexOf(variant) + d + keys.length) % keys.length]); };
  useEffect(() => {
    const key = e => {
      if (e.target.closest("input, textarea, select, button, a, summary, [contenteditable], [role=slider]") || e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); cycle(e.key === "ArrowLeft" ? -1 : 1); }
      if (e.key === "/") { e.preventDefault(); document.getElementById("hero-search")?.focus(); }
    }; addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [variant]);
  return <div className="prototype-controls"><div className="prototype-caption"><span>ПРОТОТИП · ДЕМО, БЕЗ СОХРАНЕНИЯ</span><span>{state}</span></div><div className="prototype-bar"><button className="cycle-button" aria-label="Предыдущий вариант" onClick={() => cycle(-1)}>←</button><div className="variant-options">{Object.entries(variants).map(([key, [name]]) => <button key={key} className={variant === key ? "active" : ""} aria-pressed={variant === key} onClick={() => change(key)}><b>{key}</b><span>{name}</span></button>)}</div><button className="cycle-button" aria-label="Следующий вариант" onClick={() => cycle(1)}>→</button></div></div>;
}
createRoot(document.getElementById("app-root")).render(<App />);
