import React from "react";
import { observer } from "mobx-react-lite";
import { library, actions } from "./stores/index.js";
import { MODEL_STAGES } from "./model-progress.js";
export const ModelProgress = observer(function ModelProgress({
  character,
  compact = false,
}) {
  if (!character || !library.owned.has(character.slug)) return null;
  const stage = library.hobby.get(character.slug) || "";
  return (
    <label className={"model-progress" + (compact ? " compact" : "")}>
      {!compact && <span>Сборка и покраска</span>}
      <select
        aria-label={"Этап модели: " + character.name}
        data-model-progress={character.slug}
        data-stage={stage || "unset"}
        value={stage}
        onChange={(event) => {
          event.stopPropagation();
          if (!library.setHobbyProgress(character.slug, event.target.value)) {
            event.currentTarget.value = library.hobby.get(character.slug) || "";
            if (library.error) actions.notify(library.error);
          }
        }}
      >
        <option value="">Без отметки</option>
        {MODEL_STAGES.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
});
