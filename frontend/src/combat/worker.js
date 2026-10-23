import { compare } from "./engine.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      result: compare(data.first, data.second, data.options),
    });
  } catch (error) {
    self.postMessage({ error: error.message || "Не удалось рассчитать урон" });
  }
};
