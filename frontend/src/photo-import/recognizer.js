import { Capacitor, registerPlugin } from "@capacitor/core";
import { titleRegions, textBandRegions } from "./regions.js";
const NativeScanner = registerPlugin("CardScanner");
const asset = (path) => new URL(`assets/ocr/${path}`, document.baseURI).href;
const MAX_BYTES = 35 * 1024 * 1024;
export const PHOTO_LIMIT = 12;
const cancelled = () =>
  Object.assign(new Error("Распознавание отменено."), {
    code: "SCAN_CANCELLED",
  });
let libraryPromise;
function loadLocalOCR() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!libraryPromise)
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = asset("tesseract.min.js");
      script.onload = () =>
        window.Tesseract
          ? resolve(window.Tesseract)
          : reject(Error("Не удалось загрузить распознавание текста."));
      script.onerror = () => {
        script.remove();
        reject(
          Error(
            "Не удалось загрузить локальное распознавание. Обновите приложение и повторите.",
          ),
        );
      };
      document.head.append(script);
    }).catch((error) => {
      libraryPromise = null;
      throw error;
    });
  return libraryPromise;
}
export const nativeScannerAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CardScanner");
export class PhotoRecognizer {
  worker = null;
  workerPromise = null;
  progress = null;
  generation = 0;
  pending = new Set();
  waitFor(promise, generation) {
    if (generation !== this.generation) return Promise.reject(cancelled());
    return new Promise((resolve, reject) => {
      const stop = () => reject(cancelled());
      this.pending.add(stop);
      Promise.resolve(promise)
        .then(resolve, reject)
        .finally(() => this.pending.delete(stop));
    });
  }
  get native() {
    return nativeScannerAvailable();
  }
  async choose(source, maxPhotos = PHOTO_LIMIT) {
    const result = await NativeScanner.choosePhotos({ source, maxPhotos });
    return (result.photos || []).map((p) => ({
      ...p,
      native: true,
      rotation: 0,
      preview: Capacitor.convertFileSrc(p.path),
      name: p.name || "Фото",
    }));
  }
  fromFiles(files) {
    const selected = [...files];
    for (const file of selected) {
      if (!file || !/^image\//.test(file.type) || file.type === "image/svg+xml")
        throw Error("Выберите фотографию в формате JPEG, PNG, WebP или HEIC.");
      if (!file.size || file.size > MAX_BYTES)
        throw Error("Размер одной фотографии должен быть не больше 35 МБ.");
    }
    return selected.map((file) => {
      return {
        id: crypto.randomUUID(),
        native: false,
        file,
        rotation: 0,
        preview: URL.createObjectURL(file),
        name: file.name || "Фото",
      };
    });
  }
  async getWorker() {
    if (this.worker) return this.worker;
    if (!this.workerPromise) {
      const generation = this.generation;
      this.workerPromise = (async () => {
        const { createWorker, OEM } = await loadLocalOCR();
        const w = await createWorker("eng", OEM.LSTM_ONLY, {
          workerPath: asset("worker.min.js"),
          corePath: asset("core/"),
          langPath: asset("lang/"),
          workerBlobURL: false,
          gzip: true,
          logger: (m) => {
            if (generation === this.generation)
              this.progress?.({
                stage: m.status,
                value: Number(m.progress) || 0,
              });
          },
        });
        if (generation !== this.generation) {
          await w.terminate();
          throw cancelled();
        }
        await w.setParameters({ preserve_interword_spaces: "1" });
        if (generation !== this.generation) {
          await w.terminate();
          throw cancelled();
        }
        this.worker = w;
        return w;
      })().catch((error) => {
        if (generation === this.generation) this.workerPromise = null;
        throw error;
      });
    }
    return this.workerPromise;
  }
  async recognize(photo, onProgress = () => {}) {
    const generation = this.generation;
    if (photo.native) {
      onProgress({ stage: "recognizing text", value: 0.2 });
      const result = await this.waitFor(
        NativeScanner.recognizePhoto({
          id: photo.id,
          rotation: photo.rotation,
        }),
        generation,
      );
      if (generation !== this.generation) throw cancelled();
      onProgress({ stage: "recognizing text", value: 1 });
      return { ...result, engine: "mlkit-latin" };
    }
    this.progress = (p) =>
      onProgress({
        ...p,
        value:
          p.stage === "recognizing text"
            ? 0.2 + 0.8 * p.value
            : 0.05 + 0.15 * p.value,
      });
    let image;
    try {
      onProgress({ stage: "loading image", value: 0 });
      image = await createImageBitmap(photo.file);
      if (generation !== this.generation) throw cancelled();
      const quarter = ((photo.rotation % 360) + 360) % 360,
        sideways = quarter % 180 !== 0;
      const factor = Math.min(1, 3200 / Math.max(image.width, image.height));
      const iw = Math.max(1, Math.round(image.width * factor)),
        ih = Math.max(1, Math.round(image.height * factor));
      const canvas = document.createElement("canvas");
      canvas.width = sideways ? ih : iw;
      canvas.height = sideways ? iw : ih;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((quarter * Math.PI) / 180);
      context.drawImage(image, -iw / 2, -ih / 2, iw, ih);
      image.close();
      image = null;
      const worker = await this.waitFor(this.getWorker(), generation);
      if (generation !== this.generation) throw cancelled();
      const result = await this.waitFor(
        worker.recognize(canvas, {}, { blocks: true, text: true }),
        generation,
      );
      if (generation !== this.generation) throw cancelled();
      const lines = [];
      for (const [bi, block] of (result.data.blocks || []).entries())
        for (const paragraph of block.paragraphs || [])
          for (const line of paragraph.lines || []) {
            const b = line.bbox;
            lines.push({
              text: line.text,
              confidence: line.confidence,
              block: bi,
              box: b
                ? {
                    x: b.x0 / canvas.width,
                    y: b.y0 / canvas.height,
                    w: (b.x1 - b.x0) / canvas.width,
                    h: (b.y1 - b.y0) / canvas.height,
                  }
                : null,
            });
          }
      this.progress = null;
      const detector = document.createElement("canvas");
      detector.width = Math.min(800, canvas.width);
      detector.height = Math.max(
        1,
        Math.round((canvas.height * detector.width) / canvas.width),
      );
      const dc = detector.getContext("2d", { willReadFrequently: true });
      dc.drawImage(canvas, 0, 0, detector.width, detector.height);
      const pixels = dc.getImageData(0, 0, detector.width, detector.height);
      const regions = [
        ...titleRegions(pixels),
        ...textBandRegions(pixels, lines),
      ].slice(0, 20);
      const excerpts = [];
      for (let ri = 0; ri < regions.length; ri++) {
        if (generation !== this.generation) throw cancelled();
        const region = regions[ri],
          sx = Math.round(region.x * canvas.width),
          sy = Math.round(region.y * canvas.height);
        const sw = Math.min(
            canvas.width - sx,
            Math.round(region.w * canvas.width),
          ),
          sh = Math.min(
            canvas.height - sy,
            Math.round(region.h * canvas.height),
          );
        if (sw < 8 || sh < 8) continue;
        const crop = document.createElement("canvas"),
          scale = Math.min(3, 1600 / sw);
        crop.width = Math.max(1, Math.round(sw * scale));
        crop.height = Math.max(1, Math.round(sh * scale));
        crop
          .getContext("2d")
          .drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        const read = await this.waitFor(
          worker.recognize(crop, {}, { blocks: true, text: true }),
          generation,
        );
        if (generation !== this.generation) throw cancelled();
        excerpts.push(read.data.text || "");
        for (const [bi, block] of (read.data.blocks || []).entries())
          for (const paragraph of block.paragraphs || [])
            for (const line of paragraph.lines || []) {
              const b = line.bbox;
              lines.push({
                text: line.text,
                confidence: line.confidence,
                block: `title-${ri}-${bi}`,
                box: b
                  ? {
                      x: region.x + (b.x0 / crop.width) * region.w,
                      y: region.y + (b.y0 / crop.height) * region.h,
                      w: ((b.x1 - b.x0) / crop.width) * region.w,
                      h: ((b.y1 - b.y0) / crop.height) * region.h,
                    }
                  : null,
              });
            }
        onProgress({
          stage: "recognizing titles",
          value: 0.55 + 0.45 * ((ri + 1) / regions.length),
        });
      }
      return {
        text: [result.data.text || "", ...excerpts].join("\n"),
        lines,
        width: canvas.width,
        height: canvas.height,
        engine: "tesseract-local",
      };
    } finally {
      image?.close();
      if (generation === this.generation) this.progress = null;
    }
  }
  async cancel() {
    this.generation++;
    for (const stop of this.pending) stop();
    this.pending.clear();
    const w = this.worker;
    this.worker = null;
    this.workerPromise = null;
    this.progress = null;
    if (w) await w.terminate().catch(() => {});
  }
  async release(photos) {
    for (const p of photos)
      if (!p.native && p.preview) URL.revokeObjectURL(p.preview);
    const ids = photos.filter((p) => p.native).map((p) => p.id);
    if (ids.length) await NativeScanner.releasePhotos({ ids }).catch(() => {});
  }
}
