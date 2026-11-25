"""Genera la cama musical del tutorial con MusicGen small (local, CPU) y la lleva a la duración del video.

python musicgen_bgm.py <salida.wav> <segundos> "<prompt>"
"""
import sys
import numpy as np
import soundfile as sf
import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

salida, total, prompt = sys.argv[1], float(sys.argv[2]), sys.argv[3]
torch.manual_seed(7)
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
sr = model.config.audio_encoder.sampling_rate
semilla = 28  # segundos por generación (límite del decodificador ~30 s)
tokens = int(semilla * 50)
inp = proc(text=[prompt], padding=True, return_tensors="pt")
with torch.no_grad():
    audio = model.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=tokens)[0, 0].numpy()
print("semilla", len(audio) / sr, "s")
# lazo con fundido cruzado de 2 s hasta cubrir la duración
xf = int(2 * sr)
out = audio.copy()
while len(out) < total * sr:
    a, b = out[:-xf], out[-xf:]
    ramp = np.linspace(0, 1, xf)
    out = np.concatenate([a, b * (1 - ramp) + audio[:xf] * ramp, audio[xf:]])
out = out[: int(total * sr)]
fo = int(2.5 * sr)
out[-fo:] *= np.linspace(1, 0, fo)
out = out / (np.max(np.abs(out)) + 1e-9) * 0.89  # pico ~ -1 dBFS
sf.write(salida, np.stack([out, out], axis=1), sr)
print("escrito", salida, len(out) / sr, "s")
