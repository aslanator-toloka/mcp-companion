import { fitCharacterRating } from "./character-rating.js";
self.onmessage = ({ data: { id, data } }) => {
  try {
    self.postMessage({ id, model: fitCharacterRating(data) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
