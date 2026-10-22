export const MODEL_STAGES = [
  ["assembled", "Assembled"],
  ["primed", "Primed"],
  ["painted", "Painted"],
];
export const validModelStage = (stage) =>
  MODEL_STAGES.some(([key]) => key === stage);
