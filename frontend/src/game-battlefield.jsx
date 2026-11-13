import React, { useEffect, useMemo, useRef, useState } from "react";
import geometry from "../../game/geometry.cjs";
import { Vitals } from "./game-hud.jsx";

const { deployable, fits, gridStep, movement, snap, within, allowedAngle } =
  geometry;
const colors = { p1: "#48b5ff", p2: "#ff6283" };

export function Board({
  state,
  side,
  mode,
  selected,
  position,
  onDrop,
  onActivate,
  onInspect,
  catalog,
  aim,
  rangePreview,
  targetIds,
  onTarget,
  onAngle,
  onFire,
  frames,
  quickActions,
  onQuickAttack,
  onQuickPower,
  direction,
  onDirection,
}) {
  const svg = useRef(null);
  const pointer = useRef(null);
  const skipClick = useRef(false);
  const menu = useRef(null);
  const [quickFighter, setQuickFighter] = useState("");
  const [quickPreview, setQuickPreview] = useState(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hovered, setHovered] = useState("");
  const placed = useMemo(
    () => state.fighters.filter((f) => !f.ko && f.x != null),
    [state.fighters],
  );
  const directionOrigin =
    direction &&
    placed.find((item) => item.id === (direction.mover || direction.source));
  const directionRoute = useMemo(() => {
    if (!directionOrigin) return null;
    if (direction.type === "throw-terrain")
      return (angle) =>
        geometry.terrainThrowPath(
          directionOrigin,
          direction.piece,
          state.terrain,
          placed,
          direction.speed,
          angle,
        ).point;
    return (angle) => {
      if (
        !allowedAngle(
          directionOrigin,
          direction.reference,
          direction.direction,
          angle,
        )
      )
        return null;
      return geometry.toolEnd(
        directionOrigin,
        directionOrigin,
        state.terrain,
        placed,
        direction.speed,
        angle,
        direction.mode === "throw" ? direction.source : null,
        direction.breakSize,
      ).point;
    };
  }, [direction, directionOrigin, placed, state.terrain]);
  const directionArea = useMemo(() => {
    if (!directionRoute) return "";
    const { x, y } = directionOrigin;
    const outline = Array.from(
      { length: 361 },
      (_, angle) => directionRoute(angle) || directionOrigin,
    );
    return `M${x} ${y}L${outline.map((point) => `${point.x} ${point.y}`).join(" ")}Z`;
  }, [directionRoute, directionOrigin]);
  const menuFighter =
    quickActions && quickFighter === state.active
      ? placed.find((item) => item.id === quickFighter)
      : null;
  const menuOpen = !!menuFighter;
  useEffect(() => () => clearTimeout(pointer.current?.timer), []);
  useEffect(() => {
    const updateShift = (event) => {
      if (event.key === "Shift") setShiftHeld(event.shiftKey);
    };
    const clearShift = () => setShiftHeld(false);
    window.addEventListener("keydown", updateShift);
    window.addEventListener("keyup", updateShift);
    window.addEventListener("blur", clearShift);
    return () => {
      window.removeEventListener("keydown", updateShift);
      window.removeEventListener("keyup", updateShift);
      window.removeEventListener("blur", clearShift);
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) {
      setQuickPreview(null);
      return;
    }
    menu.current?.querySelector("button")?.focus({ preventScroll: true });
    const closeOutside = (event) => {
      if (!menu.current?.contains(event.target)) setQuickFighter("");
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setQuickFighter("");
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);
  const fighter =
    position?.model || state.fighters.find((f) => f.id === selected);
  const objective =
    position?.type === "drop-objective"
      ? state.objectives.find((o) => o.id === position.objective)
      : null;
  const placingConstruct = position?.type === "place-construct";
  const placingProjection = position?.effect === "projection";
  const movingPiece =
    objective ||
    (placingConstruct
      ? position.reference
      : position?.model
        ? { ...fighter, ...position.reference, radius: fighter.radius }
        : fighter);
  const check = useMemo(() => {
    if (!movingPiece || !mode) return null;
    if (placingProjection)
      return (point) =>
        geometry.projectionAt(point, fighter.projection || fighter);
    if (placingConstruct)
      return (point) =>
        geometry.metalConstruct(
          point,
          position.reference,
          placed,
          state.terrain,
        );
    if (objective)
      return (point) =>
        point.x >= 0 &&
        point.x <= 36 &&
        point.y >= 0 &&
        point.y <= 36 &&
        within(position.origin, { ...point, radius: objective.radius }, 2);
    if (mode === "deploy")
      return (point) =>
        deployable(
          point,
          state.deployment[side],
          fighter,
          placed,
          state.terrain,
        );
    if (position?.mode === "place")
      return (point) =>
        within(
          position.reference || fighter,
          { ...point, radius: fighter.radius },
          position.range,
        ) && fits(point, fighter, placed, state.terrain);
    const model =
      position?.speed || position?.climbsOnAdvance
        ? {
            ...fighter,
            ...(position.speed && { speed: position.speed }),
            ...(position.climbsOnAdvance && { climbsOnAdvance: true }),
          }
        : fighter;
    const route = movement(
      model,
      position?.moveMode || (position ? "advance" : mode),
      placed,
      state.terrain,
    ).route;
    return position?.direction
      ? (point) =>
          allowedAngle(
            fighter,
            position.reference,
            position.direction,
            (Math.atan2(point.y - fighter.y, point.x - fighter.x) * 180) /
              Math.PI,
          ) && route(point)
      : route;
  }, [
    fighter,
    mode,
    movingPiece,
    objective,
    placed,
    position,
    placingConstruct,
    placingProjection,
    side,
    state.deployment,
    state.terrain,
  ]);
  const area = useMemo(() => {
    if (!check) return "";
    const limit = mode === "deploy" ? 36 : 11;
    const minY = Math.max(0, (movingPiece.y || 0) - limit),
      maxY = Math.min(36, (movingPiece.y || 0) + limit);
    const minX = Math.max(0, (movingPiece.x || 0) - limit),
      maxX = Math.min(36, (movingPiece.x || 0) + limit);
    let path = "";
    for (
      let y = Math.ceil(minY / gridStep) * gridStep;
      y <= maxY;
      y += gridStep
    ) {
      let start = null;
      for (
        let x = Math.ceil(minX / gridStep) * gridStep;
        x <= maxX + gridStep;
        x += gridStep
      ) {
        if (x <= maxX && check({ x, y })) {
          if (start === null) start = x;
        } else if (start !== null) {
          path += `M${start - gridStep / 2} ${y}H${x - gridStep / 2}`;
          start = null;
        }
      }
    }
    return path;
  }, [check, movingPiece, mode]);

  function boardPoint(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.current.getScreenCTM().inverse(),
    );
  }
  function local(event, drag) {
    const point = boardPoint(event);
    return snap({ x: point.x - (drag?.dx || 0), y: point.y - (drag?.dy || 0) });
  }
  function directionAt(point) {
    if (!point || !directionRoute) return null;
    const dx = point.x - directionOrigin.x;
    const dy = point.y - directionOrigin.y;
    if (Math.hypot(dx, dy) < 0.05) return null;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const end = directionRoute(angle);
    return end ? { angle, end } : null;
  }
  function stop(event) {
    const dragging = pointer.current;
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    clearTimeout(dragging.timer);
    pointer.current = null;
    setCursor(null);
    if (event.type !== "pointerup" || dragging.held) return;
    const point =
      dragging.canDrag && dragging.fighter === selected
        ? local(event, dragging)
        : null;
    const canDrop = point && check?.(point);
    if (!dragging.moved && !canDrop) {
      onInspect(dragging.fighter);
      skipClick.current = true;
      return;
    }
    if (dragging.canDirect && directionOrigin?.id === dragging.fighter) {
      const { x, y } = boardPoint(event);
      const preview = directionAt({ x: x - dragging.dx, y: y - dragging.dy });
      if (preview) onDirection(preview.angle);
      skipClick.current = true;
      return;
    }
    if (canDrop)
      onDrop({
        type: mode,
        fighter: selected,
        value: position?.value,
        payer: position?.payer,
        mode: position?.moveMode,
        ...point,
      });
  }
  const preview = cursor && check?.(cursor);
  const directionPreview = directionAt(cursor);
  const showObjectiveRanges =
    !!check &&
    !objective &&
    fighter &&
    !fighter.grunt &&
    fighter.interactRange !== 0 &&
    !placingConstruct &&
    !placingProjection;
  const objectivePosition =
    showObjectiveRanges &&
    (cursor
      ? preview && { ...cursor, radius: fighter.radius }
      : fighter.x != null && fighter);
  const firing =
    aim &&
    (aim.origin || placed.find((f) => f.id === (aim.fighter || state.active)));
  const hoveredRange = menuOpen ? quickPreview : rangePreview;
  const rangeOrigin = menuOpen
    ? quickPreview?.origin || menuFighter
    : rangePreview?.origin ||
      placed.find((f) => f.id === rangePreview?.fighter);
  const previewRange = geometry.range[hoveredRange?.range];
  const previewRadius =
    previewRange +
    (rangeOrigin?.radius || 0) * (hoveredRange?.placement ? 2 : 1);
  const combined =
    shiftHeld &&
    previewRange > 0 &&
    !hoveredRange.origin &&
    rangeOrigin?.speed &&
    !rangeOrigin.dazed;
  const combinedArea = useMemo(
    () =>
      combined
        ? geometry.rangeAfterMove(
            rangeOrigin,
            previewRadius,
            placed,
            state.terrain,
          )
        : "",
    [combined, rangeOrigin, previewRadius, placed, state.terrain],
  );
  const hover =
    !menuOpen &&
    !pointer.current &&
    !position &&
    placed.find((f) => f.id === hovered);
  const beamAngle = (event) => {
    const point = local(event);
    return (
      ((Math.atan2(point.y - firing.y, point.x - firing.x) * 180) / Math.PI +
        360) %
      360
    );
  };
  const isTarget = (item) =>
    targetIds.includes(item.id) &&
    (aim?.shape !== "beam" ||
      !firing ||
      geometry.beamReaches(firing, item, aim.range, aim.angle, aim.damageType));
  function choose(item) {
    if (item.id === state.active) {
      onInspect(item.id);
      return;
    }
    if (isTarget(item)) onTarget(item.id);
    else if (mode !== "deploy" && !position && !aim) {
      onInspect(item.id);
      onActivate(item.id);
    } else if (mode !== "deploy" && aim?.shape !== "beam" && !position)
      onInspect(item.id);
  }
  return (
    <div className="game-battlefield">
      <svg
        className="game-board"
        ref={svg}
        viewBox="0 0 36 36"
        aria-label="Поле 36 на 36 дюймов"
        onPointerDownCapture={() => {
          skipClick.current = false;
        }}
        onPointerMove={(event) => {
          const dragging = pointer.current;
          if (dragging?.pointerId === event.pointerId) {
            if (dragging.held) return;
            if (
              Math.hypot(
                event.clientX - dragging.startX,
                event.clientY - dragging.startY,
              ) > 5
            ) {
              dragging.moved = true;
              clearTimeout(dragging.timer);
            }
            if (dragging.canDirect) {
              const { x, y } = boardPoint(event);
              setCursor({ x: x - dragging.dx, y: y - dragging.dy });
            }
            if (dragging.canDrag) setCursor(local(event, dragging));
            return;
          }
          if (directionRoute) {
            setCursor(boardPoint(event));
            return;
          }
          if (firing && aim.shape === "beam" && !position)
            onAngle(beamAngle(event));
          if (mode === "deploy" || position) setCursor(local(event));
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onPointerLeave={() => {
          setCursor(null);
          setHovered("");
        }}
        onClick={(event) => {
          if (menuOpen || skipClick.current) {
            skipClick.current = false;
            return;
          }
          if (directionRoute) {
            const preview = directionAt(boardPoint(event));
            if (preview) onDirection(preview.angle);
            return;
          }
          if (firing && aim.shape === "beam" && !position) {
            const angle = beamAngle(event);
            if (
              placed.some(
                (f) =>
                  targetIds.includes(f.id) &&
                  geometry.beamReaches(
                    firing,
                    f,
                    aim.range,
                    angle,
                    aim.damageType,
                  ),
              )
            )
              onFire(angle);
            return;
          }
          if (mode !== "deploy" && !position) return;
          const point = local(event);
          if (check?.(point))
            onDrop({
              type: mode,
              fighter: selected,
              value: position?.value,
              payer: position?.payer,
              mode: position?.moveMode,
              ...point,
            });
        }}
      >
        <defs>
          <radialGradient id="game-street" cx="55%" cy="46%" r="72%">
            <stop offset="0%" stopColor="#303c48" />
            <stop offset="100%" stopColor="#141d28" />
          </radialGradient>
          <pattern
            id="game-grid"
            width="1"
            height="1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M1 0H0V1"
              fill="none"
              stroke="#8394a8"
              strokeOpacity=".17"
              strokeWidth=".032"
            />
          </pattern>
          <pattern
            id="game-roof"
            width=".28"
            height=".28"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(36)"
          >
            <path
              d="M0 0V.28"
              stroke="#b7c9da"
              strokeOpacity=".19"
              strokeWidth=".035"
            />
          </pattern>
        </defs>
        <rect width="36" height="36" fill="url(#game-street)" />
        <path
          d="M0 17.7H36M18 0V36"
          stroke="#9eacb3"
          opacity=".12"
          strokeWidth="3.8"
          fill="none"
        />
        <path
          d="M0 17.7H36M18 0V36"
          stroke="#f8d17a"
          opacity=".2"
          strokeWidth=".065"
          strokeDasharray=".9 .65"
          fill="none"
        />
        <rect width="36" height="36" fill="url(#game-grid)" />
        {state.terrain.map((item) => (
          <g
            key={item.id}
            data-targeted={targetIds.includes(item.id)}
            className="game-terrain"
            onClick={(event) => {
              if (targetIds.includes(item.id)) {
                event.stopPropagation();
                onTarget(item.id);
              }
            }}
          >
            <rect
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx=".16"
              className="game-terrain-base"
              fill={
                item.size > 3
                  ? "#354453"
                  : item.size > 1
                    ? "#4b5a65"
                    : "#52554e"
              }
              stroke="#8c9ea9"
              strokeWidth=".075"
            />
            <rect
              x={item.x + 0.07}
              y={item.y + 0.07}
              width={item.w - 0.14}
              height={item.h - 0.14}
              rx=".12"
              fill="url(#game-roof)"
              pointerEvents="none"
            />
            <text
              x={item.x + item.w / 2}
              y={item.y + item.h / 2}
              className="game-board-label"
            >
              {item.size}
            </text>
          </g>
        ))}
        {combinedArea && (
          <path
            className="game-move-range-preview"
            d={combinedArea}
            stroke="#ffbd4a"
            strokeWidth={gridStep}
            opacity=".24"
            fill="none"
            pointerEvents="none"
          />
        )}
        {rangeOrigin && previewRange > 0 && (
          <circle
            className="game-attack-range-preview"
            cx={rangeOrigin.x}
            cy={rangeOrigin.y}
            r={previewRadius}
            fill="#ffbd4a"
            stroke="#ffe8a7"
            strokeWidth=".09"
            opacity=".3"
            strokeDasharray=".35 .23"
            pointerEvents="none"
          />
        )}
        {firing &&
          !(rangeOrigin && previewRange > 0) &&
          (aim.shape === "beam" ? (
            <rect
              x={firing.radius}
              y={-0.5}
              width={geometry.range[aim.range]}
              height={1}
              transform={`translate(${firing.x} ${firing.y}) rotate(${aim.angle})`}
              fill="#ffbd4a"
              stroke="#ffe8a7"
              strokeWidth=".09"
              opacity=".52"
              pointerEvents="none"
            />
          ) : (
            <circle
              cx={firing.x}
              cy={firing.y}
              r={firing.radius + geometry.range[aim.range]}
              fill="#ffbd4a"
              stroke="#ffe8a7"
              strokeWidth=".09"
              opacity=".22"
              strokeDasharray=".35 .23"
              pointerEvents="none"
            />
          ))}
        <path
          d={area}
          stroke="#62dfa9"
          opacity=".37"
          strokeWidth={gridStep}
          fill="none"
          pointerEvents="none"
        />
        {directionArea && (
          <path
            className="game-direction-area"
            d={directionArea}
            pointerEvents="none"
          />
        )}
        {state.objectives
          .filter((obj) => !obj.holder)
          .map((obj, index, items) => {
            const objectiveRange =
              obj.role === "secure" ? 1 : fighter?.interactRange || 1;
            const inRange =
              !!objectivePosition &&
              within(objectivePosition, obj, objectiveRange);
            return (
              <g
                key={obj.id}
                className="game-objective"
                data-in-range={inRange}
                data-targeted={targetIds.includes(obj.id)}
                onClick={(event) => {
                  if (targetIds.includes(obj.id)) {
                    event.stopPropagation();
                    onTarget(obj.id);
                  }
                }}
              >
                <title>{obj.name}</title>
                {showObjectiveRanges && (
                  <circle
                    className="game-objective-range"
                    data-role={obj.role}
                    cx={obj.x}
                    cy={obj.y}
                    r={obj.radius + geometry.range[objectiveRange]}
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                )}
                <circle
                  className="game-objective-marker"
                  cx={obj.x}
                  cy={obj.y}
                  r={
                    obj.radius +
                    (items.some(
                      (p, i) => i > index && p.x === obj.x && p.y === obj.y,
                    )
                      ? 0.17
                      : 0)
                  }
                  fill={obj.id.startsWith("secure:") ? "#a978e6" : "#e9a142"}
                  stroke="#23232a"
                  strokeWidth=".075"
                />
              </g>
            );
          })}
        {placed
          .filter((item) => item.projection)
          .map((item) => (
            <g
              key={item.id}
              className="game-projection"
              onClick={(event) => {
                if (aim?.damageType === "mystic" && isTarget(item)) {
                  event.stopPropagation();
                  onTarget(item.id);
                }
              }}
            >
              <title>{item.name + " · Projection"}</title>
              <circle
                cx={item.projection.x}
                cy={item.projection.y}
                r={item.projection.radius}
                fill="#7d43c7"
                stroke={isTarget(item) ? "#ffe8a7" : "#e3bdff"}
                strokeWidth=".12"
              />
              <text
                x={item.projection.x}
                y={item.projection.y}
                className="game-board-label"
              >
                P
              </text>
            </g>
          ))}
        {placed.map((item, index) => (
          <g
            key={item.id}
            className="game-token"
            role="button"
            tabIndex={0}
            aria-label={
              item.name +
              " · " +
              item.side.toUpperCase() +
              (item.dazed ? " · Dazed" : "")
            }
            data-targeted={isTarget(item)}
            data-hovered={item.id === hovered}
            onPointerEnter={() => setHovered(item.id)}
            onPointerLeave={() => setHovered("")}
            onFocus={() => setHovered(item.id)}
            onBlur={() => setHovered("")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                choose(item);
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || pointer.current) return;
              const canDrag =
                !!check &&
                !aim &&
                mode !== "deploy" &&
                !position &&
                item.id === selected;
              const canHold =
                !!quickActions && !position && item.id === state.active;
              const canDirect = direction?.mover === item.id;
              if (!canDrag && !canHold && !canDirect) return;
              event.preventDefault();
              const hit = new DOMPoint(
                event.clientX,
                event.clientY,
              ).matrixTransform(svg.current.getScreenCTM().inverse());
              const dragging = {
                pointerId: event.pointerId,
                fighter: item.id,
                dx: hit.x - item.x,
                dy: hit.y - item.y,
                startX: event.clientX,
                startY: event.clientY,
                canDrag,
                canDirect,
              };
              if (canHold) {
                dragging.timer = setTimeout(() => {
                  dragging.held = true;
                  setCursor(null);
                  setQuickFighter(item.id);
                }, 400);
              }
              pointer.current = dragging;
              svg.current.setPointerCapture(event.pointerId);
            }}
            onClick={(event) => {
              if (menuOpen || skipClick.current) return;
              if (item.id === state.active) {
                event.stopPropagation();
                onInspect(item.id);
                return;
              }
              if (directionRoute) return;
              if (!position && mode !== "deploy") {
                if (isTarget(item) || aim?.shape !== "beam")
                  event.stopPropagation();
                choose(item);
              }
            }}
            style={{
              cursor: isTarget(item)
                ? "crosshair"
                : (item.id === selected && mode) || item.id === direction?.mover
                  ? "grab"
                  : "pointer",
            }}
          >
            <circle
              className="game-token-halo"
              cx={item.x}
              cy={item.y}
              r={item.radius + 0.22}
            />
            <defs>
              <clipPath id={"game-fighter-" + index}>
                <circle cx={item.x} cy={item.y} r={item.radius} />
              </clipPath>
            </defs>
            <circle
              cx={item.x}
              cy={item.y}
              r={item.radius}
              fill={colors[item.side]}
            />
            <image
              href={catalog.characters[item.slug].portrait}
              x={item.x - item.radius}
              y={item.y - item.radius}
              width={item.radius * 2}
              height={item.radius * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath={"url(#game-fighter-" + index + ")"}
              opacity={
                pointer.current?.fighter === item.id && cursor
                  ? 0.32
                  : item.activated || item.dazed
                    ? 0.55
                    : 1
              }
            />
            <circle
              cx={item.x}
              cy={item.y}
              r={item.radius}
              fill="none"
              stroke={item.id === selected ? "#ffdf8b" : colors[item.side]}
              strokeWidth=".13"
            />
            {state.objectives.some((o) => o.holder === item.id) && (
              <circle
                cx={item.x + item.radius * 0.7}
                cy={item.y - item.radius * 0.7}
                r=".20"
                fill="#e9a142"
              />
            )}
            {item.dazed && (
              <g
                className="game-token-status"
                aria-hidden="true"
                transform={`translate(${item.x} ${item.y + item.radius * 0.72})`}
              >
                <rect x="-.57" y="-.35" width="1.14" height=".70" rx=".15" />
                <text x="0" y="0">
                  Dz
                </text>
              </g>
            )}
          </g>
        ))}
        {directionPreview && (
          <g className="game-direction-preview" pointerEvents="none">
            <line
              x1={directionOrigin.x}
              y1={directionOrigin.y}
              x2={directionPreview.end.x}
              y2={directionPreview.end.y}
            />
            <circle
              cx={directionPreview.end.x}
              cy={directionPreview.end.y}
              r={direction.mover ? directionOrigin.radius : 0.4}
            />
          </g>
        )}
        {cursor && preview && (
          <g pointerEvents="none">
            {placingProjection && (
              <circle
                cx={preview.x}
                cy={preview.y}
                r={preview.radius}
                fill="#a877ec"
                stroke="#e3bdff"
                strokeWidth=".1"
              />
            )}
            {placingConstruct && (
              <rect
                {...preview}
                rx=".12"
                fill="#85b4d7"
                fillOpacity=".6"
                stroke="#e8f8ff"
                strokeWidth=".09"
              />
            )}
            {Array.isArray(preview) && (
              <polyline
                points={preview.map(({ x, y }) => x + "," + y).join(" ")}
                stroke="#e8ffe3"
                strokeWidth=".10"
                fill="none"
              />
            )}
            {fighter && !objective && !placingProjection && (
              <g>
                <defs>
                  <clipPath id="game-drag-image">
                    <circle
                      cx={cursor.x}
                      cy={cursor.y}
                      r={movingPiece.radius}
                    />
                  </clipPath>
                </defs>
                <image
                  href={catalog.characters[fighter.slug].portrait}
                  x={cursor.x - movingPiece.radius}
                  y={cursor.y - movingPiece.radius}
                  width={movingPiece.radius * 2}
                  height={movingPiece.radius * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#game-drag-image)"
                  opacity=".8"
                />
              </g>
            )}
            <circle
              cx={cursor.x}
              cy={cursor.y}
              r={movingPiece.radius}
              stroke="#e8ffe3"
              strokeWidth=".075"
              fill="none"
            />
          </g>
        )}
        {frames?.map((frame, index) => (
          <Feedback key={frame.key} frame={frame} delay={index * 140} />
        ))}
      </svg>
      {menuFighter && (
        <div
          className="game-quick-actions"
          ref={menu}
          role="group"
          aria-label="Атаки и способности"
          data-right={menuFighter.x > 18}
          data-bottom={menuFighter.y > 18}
          style={{
            left: (menuFighter.x / 36) * 100 + "%",
            top: (menuFighter.y / 36) * 100 + "%",
          }}
        >
          {quickActions.attacks.length > 0 && (
            <>
              <strong>Атаки</strong>
              {quickActions.attacks.map((attack) => (
                <button
                  key={attack.index}
                  type="button"
                  onPointerEnter={() => setQuickPreview(attack)}
                  onPointerLeave={() => setQuickPreview(null)}
                  onClick={() => {
                    setQuickFighter("");
                    onQuickAttack(attack, menuFighter.id);
                  }}
                >
                  {attack.name}
                </button>
              ))}
            </>
          )}
          {quickActions.powers.length > 0 && (
            <>
              <strong>Способности</strong>
              {quickActions.powers.map((power) => (
                <button
                  key={power.value}
                  type="button"
                  onPointerEnter={() =>
                    setQuickPreview({
                      ...power,
                      placement: power.mode === "place",
                    })
                  }
                  onPointerLeave={() => setQuickPreview(null)}
                  onClick={() => {
                    setQuickFighter("");
                    onQuickPower(power, menuFighter.id);
                  }}
                >
                  {power.label} · {power.cost} Power
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {hover && (
        <div
          className="game-map-tooltip"
          role="tooltip"
          data-right={hover.x >= 23}
          data-bottom={hover.y >= 29}
          style={{
            left: (hover.x / 36) * 100 + "%",
            top: (hover.y / 36) * 100 + "%",
          }}
        >
          <strong>{hover.name}</strong>
          <Vitals fighter={hover} />
        </div>
      )}
    </div>
  );
}

function Feedback({ frame, delay }) {
  const { source, target, animation, color } = frame;
  const style = { "--fx-color": color, "--fx-delay": delay + "ms" };
  const length = Math.hypot(target.x - source.x, target.y - source.y);
  const arc = `M${target.x - 0.65} ${target.y + 0.55} Q${target.x} ${target.y - 0.9} ${target.x + 0.8} ${target.y - 0.65}`;
  return (
    <g
      className="game-fx"
      data-animation={animation}
      style={style}
      aria-hidden="true"
      pointerEvents="none"
    >
      {(animation === "beam" || animation === "bolt") && length > 0.1 && (
        <path
          className="game-fx-trace"
          pathLength="100"
          d={`M${source.x} ${source.y} L${target.x} ${target.y}`}
        />
      )}
      {animation === "slash" && (
        <path className="game-fx-trace" pathLength="100" d={arc} />
      )}
      <g transform={`translate(${target.x} ${target.y})`}>
        {typeof frame.sprite === "string" && /^assets\//.test(frame.sprite) && (
          <image
            className="game-fx-sprite"
            href={frame.sprite}
            x="-2.5"
            y="-2.5"
            width="5"
            height="5"
          />
        )}
        <circle className="game-fx-impact" cx="0" cy="0" r="1.2" />
        {frame.type === "attack" && (
          <text className="game-fx-damage" x="0" y="-.7">
            {frame.dealt > 0 ? "−" + frame.dealt : "BLOCK"}
          </text>
        )}
      </g>
    </g>
  );
}
