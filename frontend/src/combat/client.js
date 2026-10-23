// Each comparison owns its worker; changing the opponent cancels stale work immediately.
export function calculate(first, second, options) {
  let worker, timer;
  const promise = new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(
        new Blob([__COMBAT_WORKER__], { type: "text/javascript" }),
      );
      try {
        worker = new Worker(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        worker.terminate();
        data.error ? reject(Error(data.error)) : resolve(data.result);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        reject(Error("Ошибка фонового расчёта. Попробуй ещё раз."));
      };
      timer = setTimeout(() => {
        worker.terminate();
        reject(Error("Расчёт занял слишком много времени. Попробуй ещё раз."));
      }, 45000);
      worker.postMessage({ first, second, options });
    } catch {
      reject(Error("Для расчёта нужен браузер с поддержкой Web Worker"));
    }
  });
  return {
    promise,
    cancel() {
      clearTimeout(timer);
      worker?.terminate();
    },
  };
}
