"""Offline musical analysis. Never executed by Electron or required by players.

Run from the repository: .tools/audio-analysis/Scripts/python.exe scripts/analyze-music.py
Beat tracking supports a locally estimated tempo, rather than a constant BPM grid.
Section names and kick candidates are acoustic heuristics, not annotated ground truth.
"""

import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parent.parent / ".tools/matplotlib"))

import librosa
import matplotlib
import numpy as np
import soundfile as sf
from scipy.ndimage import gaussian_filter1d, median_filter
from scipy.signal import find_peaks
from scipy.stats import lognorm

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/musiclvl1.mp3"
OUTPUT = ROOT / "src/config/music-lvl1.analysis.json"
SR = 22050
HOP = 220  # ~10 ms analysis resolution; actual audio timestamps retained below.


def normalized(values):
    low, high = np.percentile(values, [10, 95])
    return np.clip((values - low) / max(high - low, 1e-8), 0, 1)


def rounded(value):
    return round(float(value), 5)


def main():
    print("Decoding actual MP3...", flush=True)
    original_info = sf.info(SOURCE)
    y, sr = librosa.load(SOURCE, sr=SR, mono=True)
    duration = original_info.frames / original_info.samplerate
    spectrum = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
    frequencies = librosa.fft_frequencies(sr=sr, n_fft=2048)
    print(f"Decoded {duration:.3f}s; {original_info.samplerate} Hz original", flush=True)

    # Separate sustained/harmonic energy from percussive attacks.
    _, percussive = librosa.decompose.hpss(spectrum, margin=(2, 2))
    onset = librosa.onset.onset_strength(
        S=librosa.amplitude_to_db(percussive, ref=np.max), sr=sr, hop_length=HOP
    )
    low = percussive[(frequencies >= 35) & (frequencies <= 180)]
    low_flux = np.maximum(np.diff(low, axis=1, prepend=low[:, :1]), 0).mean(axis=0)
    # Spectral frames are already centered at their timestamp. Unlike librosa's
    # onset envelope, this raw flux has no extra center=True delay to add.
    full_onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    rhythm = full_onset
    print("Estimating local tempo and tracking beat peaks...", flush=True)
    default_tempo = float(librosa.feature.tempo(
        onset_envelope=rhythm, sr=sr, hop_length=HOP
    )[0])
    # Compare plausible autocorrelation peaks: a prior can mistake a ternary
    # subdivision for the main pulse. Prefer coherent attack-aligned tracks.
    correlation = librosa.autocorrelate(rhythm, max_size=int(2 * sr / HOP))
    peaks, _ = find_peaks(correlation)
    candidates = sorted(
        [p for p in peaks if 70 < 60 * sr / HOP / p < 210],
        key=lambda p: correlation[p], reverse=True,
    )[:4]
    evaluations = []
    for lag in candidates:
        tempo = 60 * sr / HOP / lag
        _, track = librosa.beat.beat_track(
            onset_envelope=rhythm, sr=sr, hop_length=HOP,
            bpm=tempo, tightness=100, trim=True,
        )
        gaps = np.diff(track)
        irregularity = np.std(gaps) / np.mean(gaps)
        score = np.mean(rhythm[track]) / (1 + 10 * irregularity)
        evaluations.append({"bpm": rounded(tempo), "coherence": rounded(1 - irregularity),
                            "score": rounded(score)})
    best_score = max(e["score"] for e in evaluations)
    global_tempo = max(e["bpm"] for e in evaluations if e["score"] >= best_score * 0.96)
    local_tempo = librosa.feature.tempo(
        onset_envelope=rhythm, sr=sr, hop_length=HOP,
        aggregate=None, ac_size=8, start_bpm=global_tempo,
        prior=lognorm(s=0.12, scale=global_tempo),
    )
    local_tempo = median_filter(local_tempo, size=301)
    _, beat_frames = librosa.beat.beat_track(
        onset_envelope=rhythm, sr=sr, hop_length=HOP,
        bpm=local_tempo, tightness=100, trim=True,
    )
    if len(beat_frames) < 16:
        raise ValueError("Insufficient detected beats; analysis needs manual review.")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset, sr=sr, hop_length=HOP, units="frames"
    )
    kick_frames, _ = find_peaks(
        normalized(low_flux), prominence=0.22, distance=int(0.18 * sr / HOP)
    )
    rms = librosa.feature.rms(S=spectrum, frame_length=2048, hop_length=HOP)[0]
    # Loudness + percussive density + high-band energy, smoothed over ~1s.
    bright = spectrum[frequencies > 3000].mean(axis=0)
    smooth = lambda values: gaussian_filter1d(values, sigma=0.65 * sr / HOP)
    intensity = np.clip(
        0.45 * normalized(smooth(rms))
        + 0.35 * normalized(smooth(onset))
        + 0.20 * normalized(smooth(bright)), 0, 1,
    )
    # Align tracked (spectrally delayed) peaks with actual waveform energy rises.
    # Search locally only; preserve the independent timestamps, never snap to a grid.
    short_rms = librosa.feature.rms(y=y, frame_length=512, hop_length=HOP)[0]
    attack = np.maximum(np.diff(short_rms, prepend=short_rms[0]), 0)
    refined = []
    for i, frame in enumerate(beat_frames):
        begin = max(0, frame - int(0.08 * sr / HOP))
        end = min(len(attack), frame + int(0.01 * sr / HOP) + 1)
        peak = begin + int(np.argmax(attack[begin:end]))
        refined.append(peak)
    beat_frames = np.array(refined)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP)
    intervals = np.diff(beat_times)
    bpm = 60 / np.median(intervals)
    beats = []
    for i, (frame, time) in enumerate(zip(beat_frames, beat_times)):
        nearby = onset_frames[np.abs(onset_frames - frame) <= 6]
        strength = float(np.max(normalized(full_onset)[frame:min(len(rhythm), frame + 9)]))
        kicks = kick_frames[np.abs(kick_frames - frame) <= 10]
        local_bpm = 60 / np.median(intervals[max(0, i - 4):min(len(intervals), i + 5)])
        beats.append({
            "time": rounded(time), "bpm": round(local_bpm, 2),
            "intensity": rounded(intensity[frame]), "strength": rounded(strength),
            "kick": bool(len(kicks)), "accent": bool(strength >= 0.68),
            "confidence": rounded(min(1, strength + (0.2 if len(nearby) else 0))),
        })

    # Half-beat effects use detected offbeat attacks, not fabricated spawn times.
    subdivisions = []
    onset_times = np.maximum(0, librosa.frames_to_time(onset_frames, sr=sr, hop_length=HOP) - 2048 / (2 * sr))
    for i in range(len(beats) - 1):
        midpoint = (beat_times[i] + beat_times[i + 1]) / 2
        candidates = np.where(np.abs(onset_times - midpoint) < intervals[i] * 0.18)[0]
        if len(candidates) and beats[i]["intensity"] >= 0.6:
            candidate = candidates[np.argmax(onset[onset_frames[candidates]])]
            subdivisions.append({
                "time": rounded(onset_times[candidate]), "beat": i + 0.5,
                "strength": rounded(normalized(onset)[onset_frames[candidate]]),
                "intensity": rounded(intensity[onset_frames[candidate]]),
            })

    # Phrase-sized bins are anchored to detected beats. Transitions are inferred
    # from measured energy and attack density; labels remain explicitly estimates.
    blocks = []
    for start in range(0, len(beats), 8):
        stop = min(len(beats), start + 8)
        a = 0 if start == 0 else beat_times[start]
        b = beat_times[stop] if stop < len(beats) else duration
        mask = slice(int(a * sr / HOP), min(len(intensity), int(b * sr / HOP)))
        blocks.append({"beat": start, "time": rounded(a), "endTime": rounded(b),
                       "intensity": rounded(np.mean(intensity[mask])),
                       "attackDensity": rounded(np.count_nonzero((onset_times >= a) & (onset_times < b)) / (b - a))})
    labels = {"intro": "CONNEXION EN DOUCEUR", "calm": "LE BUREAU RESPIRE",
              "build": "LES AMIS ARRIVENT", "drop": "LA FETE DU 56K",
              "break": "PETITE RESPIRATION", "outro": "DECONNEXION TRANQUILLE"}
    sections = []
    for i, block in enumerate(blocks):
        energy = block["intensity"]
        previous = blocks[i - 1]["intensity"] if i else energy
        following = blocks[i + 1]["intensity"] if i + 1 < len(blocks) else energy
        if i == 0:
            kind = "intro"
        elif i == len(blocks) - 1 and energy < 0.42:
            kind = "outro"
        elif energy < 0.38 and (previous > energy + 0.1 or (sections and sections[-1]["kind"] == "break")):
            kind = "break"
        elif energy >= 0.55 and block["attackDensity"] >= 2:
            kind = "drop"
        elif following > energy + 0.12 or energy > previous + 0.15:
            kind = "build"
        else:
            kind = "calm" if energy < 0.52 else "build"
        if sections and sections[-1]["kind"] == kind:
            sections[-1]["endTime"] = block["endTime"]
        else:
            sections.append({"time": block["time"], "endTime": block["endTime"],
                             "beat": block["beat"], "kind": kind, "label": labels[kind],
                             "name": f"{kind} (estimation acoustique)"})

    # Estimate displayed BPM over eight pulses to reduce 10ms quantization noise.
    phrase_tempos = 60 * 8 / (beat_times[8:] - beat_times[:-8])
    bpm = float(np.median(phrase_tempos))
    for i, beat in enumerate(beats):
        a, b = max(0, i - 4), min(len(beats) - 1, i + 4)
        beat["bpm"] = round(60 * (b - a) / (beat_times[b] - beat_times[a]), 2)
    result = {
        "schemaVersion": 1,
        "source": {"file": SOURCE.name, "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                   "durationSeconds": duration, "decodedSamples": original_info.frames, "sampleRate": original_info.samplerate,
                   "channels": original_info.channels},
        "analysis": {"tool": "librosa", "version": librosa.__version__, "sampleRate": sr,
                     "hopLength": HOP, "resolutionSeconds": rounded(HOP / sr),
                     "method": "Autocorrelation candidate coherence, dynamic local tempo, waveform attack refinement, HPSS low-band flux, RMS/attack/high-band energy",
                     "limitations": "Kick candidates and intro/build/drop/break labels are acoustic estimates; beats may be ambiguous at half/double tempo."},
        "bpm": round(bpm, 2), "globalTempoEstimate": round(global_tempo, 2),
        "defaultTempoEstimate": round(default_tempo, 2), "tempoCandidates": evaluations,
        "firstBeatSeconds": rounded(beat_times[0]),
        "tempoRange": [round(float(np.percentile(phrase_tempos, q)), 2) for q in [10, 90]],
        "beats": beats, "subdivisions": subdivisions,
        "kicks": [{"time": rounded(f * HOP / sr), "strength": rounded(normalized(low_flux)[f])} for f in kick_frames],
        "accents": [{"time": beat["time"], "beat": i, "strength": beat["strength"]} for i, beat in enumerate(beats) if beat["accent"]],
        "intensity": [{"time": rounded(f * HOP / sr), "value": rounded(intensity[f])} for f in range(0, len(intensity), 25)],
        "phrases": blocks, "sections": sections,
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    qa = ROOT / ".qa"
    qa.mkdir(exist_ok=True)
    fig, axes = plt.subplots(3, 1, figsize=(16, 9), sharex=True)
    times = np.arange(len(rms)) * HOP / sr
    axes[0].plot(times, rms, lw=0.6, label="RMS")
    for time in beat_times:
        axes[0].axvline(time, color="blue", alpha=0.15, lw=0.5)
    axes[0].set_ylabel("Energy / detected beats")
    axes[1].plot(times, intensity, label="Musical intensity")
    for section in sections:
        axes[1].axvline(section["time"], color="grey", alpha=0.4)
        axes[1].text(section["time"], 1.02, section["kind"], rotation=45, fontsize=8)
    axes[1].set_ylim(0, 1.15)
    axes[1].set_ylabel("Intensity")
    axes[2].plot(beat_times[:-1], 60 / intervals, lw=0.8, label="Measured inter-beat BPM")
    axes[2].plot(times, local_tempo, lw=0.8, label="Local tempo estimator", alpha=0.7)
    axes[2].set_ylabel("BPM")
    axes[2].set_xlabel("Audio time (seconds)")
    axes[2].legend()
    fig.suptitle(f"musiclvl1.mp3: {duration:.2f}s, median {bpm:.2f} BPM; first pulse {beat_times[0]:.3f}s")
    fig.tight_layout()
    fig.savefig(qa / "music-lvl1-analysis.png", dpi=130)
    print(json.dumps({"duration": duration, "bpm": bpm, "globalTempo": global_tempo,
                      "firstBeat": float(beat_times[0]), "beats": len(beats),
                      "subdivisions": len(subdivisions), "sections": sections}, indent=2), flush=True)


if __name__ == "__main__":
    main()
