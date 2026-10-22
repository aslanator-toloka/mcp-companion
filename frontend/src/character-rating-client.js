// The worker is bundled into the client, so calculation needs no extra request.
export function createCharacterRatingClient() {
  let worker,
    nextId = 0;
  const pending = new Map();
  function stop(message) {
    worker?.terminate();
    worker = null;
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(Error(message));
    }
    pending.clear();
  }
  return (data) =>
    new Promise((resolve, reject) => {
      if (
        typeof Worker === "undefined" ||
        typeof __CHARACTER_RATING_WORKER__ !== "string"
      ) {
        reject(Error("Браузер не поддерживает фоновый расчёт рейтинга"));
        return;
      }
      if (!worker) {
        const url = URL.createObjectURL(
          new Blob([__CHARACTER_RATING_WORKER__], { type: "text/javascript" }),
        );
        try {
          worker = new Worker(url);
        } catch (error) {
          reject(error);
          return;
        } finally {
          URL.revokeObjectURL(url);
        }
        worker.onmessage = ({ data: { id, model, error } }) => {
          const task = pending.get(id);
          if (!task) return;
          pending.delete(id);
          clearTimeout(task.timer);
          error ? task.reject(Error(error)) : task.resolve(model);
        };
        worker.onerror = () =>
          stop("Не удалось рассчитать рейтинг. Попробуй ещё раз.");
      }
      const id = ++nextId;
      const timer = setTimeout(
        () => stop("Расчёт рейтинга занял слишком много времени"),
        15000,
      );
      pending.set(id, { resolve, reject, timer });
      // Do not serialize old points, raw text, card art or unrelated archive fields.
      worker.postMessage({
        id,
        data: {
          characters: data.characters.map(({ id, grunt }) => ({ id, grunt })),
          rosters: data.rosters.map(
            ({
              id,
              playerId,
              eventId,
              characterIds,
              wins,
              losses,
              variantCount,
              inventoryComplete,
              resultBasis,
              provisional,
            }) => ({
              id,
              playerId,
              eventId,
              characterIds,
              wins,
              losses,
              variantCount,
              inventoryComplete,
              resultBasis,
              provisional,
            }),
          ),
        },
      });
    });
}
