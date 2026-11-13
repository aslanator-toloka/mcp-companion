import { useEffect, useRef, useState } from "react";

const defaults = {
  attack: { animation: "bolt", color: "#ffd77a", sound: "impact" },
  power: { animation: "pulse", color: "#81f3ff", sound: "charge" },
};
const tones = {
  impact: [160, 42, 0.22, "triangle"],
  zap: [850, 130, 0.24, "sawtooth"],
  charge: [210, 660, 0.38, "sine"],
};
const frameTime = 760;

export function useGameFeedback(state) {
  const previous = useRef(null);
  const audio = useRef(null);
  const settings = useRef({});
  const [frames, setFrames] = useState([]);
  const [sound, setSound] = useState(
    () => localStorage.getItem("mcp-game-sound") !== "off",
  );
  useEffect(() => {
    const abort = new AbortController();
    fetch("assets/game-feedback.json", {
      signal: abort.signal,
      cache: "no-cache",
    })
      .then((response) => response.ok && response.json())
      .then((value) => {
        if (value) settings.current = value;
      })
      .catch(() => {});
    const unlock = () => {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      audio.current ||= new (
        window.AudioContext || window.webkitAudioContext
      )();
      audio.current.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      abort.abort();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.current?.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const { id, log, fighters } = state;
    const before = previous.current;
    previous.current = { id, length: log.length };
    if (before?.id !== id) {
      setFrames([]);
      return;
    }
    if (log.length <= before.length) return;
    const start = Math.max(before.length, log.length - 12);
    const next = log.slice(start).flatMap((event, index) => {
      const type =
        event.attack && event.rolled ? "attack" : event.power ? "power" : null;
      if (!type) return [];
      const source = event.from || fighters.find((f) => f.id === event.fighter);
      if (source?.x == null) return [];
      const target =
        event.to || event.point || fighters.find((f) => f.id === event.target);
      const style = {
        ...defaults[type],
        ...(event.beam && { animation: "beam", sound: "zap" }),
        ...settings.current[type === "attack" ? "attacks" : "powers"]?.[
          event[type]
        ],
      };
      return [
        {
          key: id + ":" + (start + index) + ":" + state.revision,
          source,
          target: target?.x == null ? source : target,
          type,
          dealt: event.dealt,
          ...style,
        },
      ];
    });
    if (!next.length) return;
    setFrames(next);
    if (sound)
      for (const [index, frame] of next.entries()) {
        if (frame.sound === "silent") continue;
        const tone = tones[frame.sound];
        if (!tone) {
          if (typeof frame.sound === "string" && /^assets\//.test(frame.sound))
            new Audio(frame.sound).play().catch(() => {});
          continue;
        }
        const context = audio.current;
        if (context?.state !== "running") continue;
        const [from, to, duration, waveform] = tone;
        const at = context.currentTime + index * 0.12;
        const oscillator = context.createOscillator(),
          volume = context.createGain();
        oscillator.type = waveform;
        oscillator.frequency.setValueAtTime(from, at);
        oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
        volume.gain.setValueAtTime(0.001, at);
        volume.gain.linearRampToValueAtTime(0.09, at + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.001, at + duration);
        oscillator.connect(volume).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + duration);
      }
  }, [state, sound]);
  useEffect(() => {
    if (!frames.length) return;
    const timer = setTimeout(
      () => setFrames([]),
      frameTime + 140 * frames.length,
    );
    return () => clearTimeout(timer);
  }, [frames]);
  return {
    frames,
    sound,
    toggleSound() {
      setSound(!sound);
      localStorage.setItem("mcp-game-sound", sound ? "off" : "on");
    },
  };
}
