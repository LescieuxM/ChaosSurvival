export function createSoundEffectPool(
  url,
  { size = 4, volume = 0.5, AudioConstructor = () => new Audio(url) } = {},
) {
  const voices = [];
  let disposed = false;

  function play() {
    if (disposed) return false;
    let voice = voices.find((audio) => audio.paused || audio.ended);
    if (!voice && voices.length < size) {
      try {
        voice = AudioConstructor();
        if (!voice) return false;
        voices.push(voice);
      } catch {
        return false;
      }
    }
    if (!voice) return false;
    try {
      voice.volume = volume;
      voice.currentTime = 0;
      const result = voice.play();
      result?.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function stopAll() {
    for (const voice of voices) {
      try {
        voice.pause();
        voice.currentTime = 0;
      } catch {
        // Optional sound effects must never interfere with gameplay.
      }
    }
  }

  function dispose() {
    if (disposed) return;
    stopAll();
    disposed = true;
    for (const voice of voices) {
      try {
        voice.removeAttribute?.('src');
        voice.load?.();
      } catch {
        // Best effort cleanup for partial browser media implementations.
      }
    }
    voices.length = 0;
  }

  return Object.freeze({ play, stopAll, dispose });
}
