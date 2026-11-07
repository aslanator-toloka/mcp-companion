import React, { useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { rosters, ui } from "./stores/index.js";

export const RosterCodeFields = observer(function RosterCodeFields({
  dialog: d,
}) {
  const field = useRef(null);
  const exporting = d.type === "code-export";
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [d.type, d.id]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.code);
      ui.notify("Код ростера скопирован");
    } catch {
      field.current?.focus();
      field.current?.select();
      ui.notify("Код выделен — скопируйте его вручную.");
    }
  };
  return (
    <form
      data-roster-code-form={exporting ? "export" : "import"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!exporting) rosters.importCode();
      }}
    >
      {exporting && (
        <label className="field">
          Формат
          <select
            id="roster-code-format"
            value={d.format}
            onChange={(event) => rosters.setCodeFormat(event.target.value)}
          >
            <option value="mct">Jarvis / Longshanks</option>
            <option value="companion">MCP Companion — с названием</option>
          </select>
        </label>
      )}
      <label className="field">
        {exporting ? "Код ростера" : "Вставьте код ростера"}
        <textarea
          ref={field}
          id="roster-code-text"
          className="roster-code-text"
          value={exporting ? d.code : d.text}
          readOnly={exporting}
          onChange={(event) => rosters.setCodeInput(event.target.value)}
          onFocus={exporting ? (event) => event.target.select() : undefined}
          maxLength={20000}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!d.error}
          aria-describedby={d.error ? "roster-code-error" : "roster-code-help"}
          placeholder={exporting ? "" : "00040101,00010201,… или MCP1.…"}
        />
      </label>
      <p id="roster-code-help" className="muted">
        {exporting
          ? d.format === "mct"
            ? "Персонажи, тактики и кризисы. Название и аффилиация в этот формат не входят."
            : "Персонажи, тактики, кризисы, название и аффилиация — для обмена между устройствами в MCP Companion."
          : "Откроется новый черновик. Проверьте его и нажмите «Сохранить ростер»."}
      </p>
      {d.error && (
        <p id="roster-code-error" className="field-error" role="alert">
          {d.error}
        </p>
      )}
      <div className="actions">
        {exporting ? (
          <button
            type="button"
            className="primary"
            disabled={!d.code}
            onClick={copy}
          >
            Копировать код
          </button>
        ) : (
          <button className="primary" type="submit">
            Открыть ростер
          </button>
        )}
        <button type="button" onClick={rosters.closeDialog}>
          {exporting ? "Готово" : "Отмена"}
        </button>
      </div>
    </form>
  );
});
