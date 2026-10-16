#!/usr/bin/env python3
"""Renders Base Alpha's sampled sound effects (weapons, misses, hits, monsters) with numpy,
encodes them as small MP3s and writes js/sfxdata.js. Everything is generated here, so there are
no third-party sound files and no licences to track. Run: python3 tools/make_sfx.py"""
import numpy as np, subprocess, tempfile, base64, pathlib, json
from scipy import signal

SR = 32000
rng = np.random.default_rng(7)
root = pathlib.Path(__file__).resolve().parent.parent

def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.standard_normal(int(SR * d))
def env_exp(d, tau, attack=0.0015):
    x = t(d); e = np.exp(-x / tau)
    a = int(SR * attack)
    if a > 1: e[:a] *= np.linspace(0, 1, a)
    return e
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'highpass', fs=SR, output='sos'), x)
def sweep(f0, f1, d, curve='exp'):
    x = t(d)
    f = f0 * (f1 / f0) ** (x / d) if curve == 'exp' else f0 + (f1 - f0) * x / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR), f
def pad(x, d):
    n = int(SR * d)
    return np.pad(x, (0, max(0, n - len(x))))[:max(n, len(x))]
def mix(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n)
    for p in parts: out[:len(p)] += p
    return out
def at(x, delay):
    return np.concatenate([np.zeros(int(SR * delay)), x])
def room(x, size=0.35, wet=0.22, bright=5000):
    ir = noise(size) * np.exp(-t(size) / (size / 5)); ir = lp(ir, bright)
    ir[0] = 0; ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = signal.fftconvolve(x, ir)[:len(x) + int(SR * size)]
    return mix(x, w * wet)
def punch(x, drive=2.0): return np.tanh(x * drive) / np.tanh(drive)
def norm(x, peak=0.97):
    m = np.max(np.abs(x)) + 1e-9; x = x / m * peak
    fade = int(SR * 0.01); x[-fade:] *= np.linspace(1, 0, fade)
    return x

# ---------- weapons ----------
def gunshot(body_lo, body_hi, body_tau, thump_f, thump_amp, crack_amp=1.0, tail=0.35, wet=0.25, drive=2.5, mech=0.0):
    d = 0.5
    crack = hp(noise(d), 2500) * env_exp(d, 0.003) * crack_amp
    body = bp(noise(d), body_lo, body_hi) * env_exp(d, body_tau) * 1.6
    s, _ = sweep(thump_f * 1.6, thump_f * 0.7, d); thump = s * env_exp(d, 0.05) * thump_amp
    parts = [crack, body, thump]
    if mech:
        clk = bp(noise(0.03), 3000, 7000) * env_exp(0.03, 0.004) * mech
        parts.append(at(clk, 0.09))
    x = punch(mix(*parts), drive)
    return norm(room(x, tail, wet))

def laser():
    d = 0.32; s, f = sweep(2600, 180, d)
    fm = np.sin(2 * np.pi * np.cumsum(f * 0.5 + 40 * np.sin(2 * np.pi * 30 * t(d))) / SR)
    x = (np.sign(s) * 0.4 + fm * 0.6) * env_exp(d, 0.12, 0.002)
    x = mix(x, bp(noise(d), 2000, 8000) * env_exp(d, 0.02) * 0.5)
    return norm(room(lp(x, 9000), 0.3, 0.2))

def freeze_shot():
    d = 0.6; x = np.zeros(int(SR * d))
    for f in [2400, 3100, 3700, 4400, 5200]:
        s, _ = sweep(f * 1.15, f * 0.85, d); x += s * env_exp(d, 0.18 * rng.uniform(.7, 1.2), 0.004) * 0.25
    x += hp(noise(d), 5000) * env_exp(d, 0.08) * 0.5
    pop = lp(noise(0.05), 1200) * env_exp(0.05, 0.01)
    return norm(room(mix(x, pop), 0.5, 0.35, 9000))

def bomb_launch():
    d = 0.6; s, _ = sweep(180, 60, 0.12); thoomp = s * env_exp(0.12, 0.05)
    w, _ = sweep(1800, 900, 0.5); whistle = w * env_exp(0.5, 0.3, 0.05) * 0.25
    return norm(room(mix(punch(thoomp * 1.5 + lp(noise(0.12), 600) * env_exp(0.12, 0.02), 2), at(whistle, 0.06)), 0.4, 0.25))

# ---------- misses ----------
def ricochet(f0, f1, d=0.5, wob=0.0, impact=1.0):
    imp = bp(noise(0.05), 1500, 6000) * env_exp(0.05, 0.004) * impact
    x = t(d); f = f0 * (f1 / f0) ** (x / d) * (1 + wob * np.sin(2 * np.pi * 9 * x))
    whine = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 0.6 * env_exp(d, d * 0.8) * 0.8
    whine += np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * 0.15 * env_exp(d, d * 0.4)
    return norm(room(mix(imp, at(whine, 0.015)), 0.5, 0.3, 7000))

def ric_laser():
    d = 0.4; x = bp(noise(d), 2500, 9000) * env_exp(d, 0.12)
    s, _ = sweep(1400, 300, d); x += s * env_exp(d, 0.1) * 0.3
    return norm(room(x, 0.3, 0.2))

def ric_cannon():
    d = 0.8; thud = lp(noise(d), 300) * env_exp(d, 0.12) * 1.5
    s, _ = sweep(90, 40, d); thud += s * env_exp(d, 0.15)
    debris = np.zeros(int(SR * d))
    for _ in range(14):
        p = int(SR * rng.uniform(0.05, 0.6)); g = bp(noise(0.02), 1500, 5000) * env_exp(0.02, 0.004) * rng.uniform(.1, .35)
        debris[p:p + len(g)] += g[:len(debris) - p]
    return norm(room(punch(mix(thud, debris), 1.5), 0.6, 0.25, 3000))

def ric_freeze():
    d = 0.6; wh = bp(noise(d), 800, 5000) * np.sin(np.pi * t(d) / d) ** 2 * 0.6
    tink = np.zeros(int(SR * d))
    for i, f in enumerate([4200, 5300, 6100]):
        s, _ = sweep(f, f * 0.98, 0.25); g = s * env_exp(0.25, 0.06); p = int(SR * (0.2 + i * 0.09)); tink[p:p + len(g)] += g[:len(tink) - p] * 0.4
    return norm(room(mix(wh, tink), 0.5, 0.35, 9000))

def whoosh():
    d = 0.35; x = bp(noise(d), 500, 3500) * np.sin(np.pi * t(d) / d) ** 2
    return norm(room(x, 0.2, 0.15))

# ---------- hits ----------
def hit_bullet():
    d = 0.25; smack = lp(noise(d), 2500) * env_exp(d, 0.015) * 1.4
    s, _ = sweep(220, 90, d); thump = s * env_exp(d, 0.04)
    squish = bp(noise(d), 300, 1200) * env_exp(d, 0.06) * 0.4
    return norm(room(punch(mix(smack, thump, squish), 2.5), 0.25, 0.15))

def hit_laser():
    d = 0.4; sizzle = bp(noise(d), 3000, 10000) * env_exp(d, 0.15) * (1 + 0.5 * np.sign(np.sin(2 * np.pi * 60 * t(d))))
    s, _ = sweep(900, 200, d); x = mix(sizzle * 0.7, s * env_exp(d, 0.06) * 0.6, lp(noise(d), 800) * env_exp(d, 0.02))
    return norm(room(x, 0.25, 0.2))

def hit_cannon():
    d = 0.5; x = lp(noise(d), 700) * env_exp(d, 0.06) * 1.5; s, _ = sweep(140, 45, d); x += s * env_exp(d, 0.12) * 1.2
    return norm(room(punch(x, 2.5), 0.4, 0.2, 3000))

def hit_armor():
    d = 0.7; x = np.zeros(int(SR * d))
    for r, a, tau in [(1.0, 1, .25), (2.76, .6, .18), (5.4, .4, .1), (8.93, .25, .06)]:
        x += np.sin(2 * np.pi * 1100 * r * t(d)) * env_exp(d, tau, 0.0005) * a
    x += hp(noise(d), 4000) * env_exp(d, 0.004)
    return norm(room(x, 0.4, 0.25, 8000))

def hit_freeze():
    d = 0.6; crack = hp(noise(d), 3000) * env_exp(d, 0.006) * 1.5
    crk = np.zeros(int(SR * d))
    for _ in range(18):
        p = int(SR * rng.uniform(0, 0.35)); g = bp(noise(0.012), 2500, 9000) * env_exp(0.012, 0.002) * rng.uniform(.2, .7)
        crk[p:p + len(g)] += g[:len(crk) - p]
    shimmer = sum(np.sin(2 * np.pi * f * t(d)) * env_exp(d, .2, .01) * .12 for f in [3300, 4100, 5200])
    return norm(room(mix(crack, crk, shimmer), 0.5, 0.35, 9000))

def explosion(far=False):
    d = 1.6
    rumble = lp(noise(d), 180 if far else 400) * env_exp(d, 0.35 if far else 0.45, 0.004) * 2
    s, _ = sweep(80, 30, d); sub = s * env_exp(d, 0.3) * (0.8 if far else 1.6)
    crack = hp(noise(d), 1500) * env_exp(d, 0.02) * (0.15 if far else 1.0)
    crackle = np.zeros(int(SR * d))
    if not far:
        for _ in range(40):
            p = int(SR * rng.uniform(0.05, 1.0)); g = bp(noise(0.015), 1000, 5000) * env_exp(0.015, 0.003) * rng.uniform(.05, .3)
            crackle[p:p + len(g)] += g[:len(crackle) - p]
    x = punch(mix(rumble, sub, crack, crackle), 3)
    x = room(x, 0.9, 0.35, 2500 if far else 5000)
    return norm(x, 0.6 if far else 0.98)

# ---------- monsters (cartoon voices) ----------
FORMANTS = {'uh': [(600, 1.0, 80), (1000, .5, 90), (2400, .2, 120)], 'aa': [(750, 1.0, 90), (1150, .6, 90), (2500, .25, 120)],
            'oo': [(350, 1.0, 60), (800, .4, 80), (2300, .1, 120)], 'ee': [(300, .8, 60), (2200, .6, 100), (3000, .3, 120)], 'oh': [(500, 1, 70), (850, .5, 80), (2500, .15, 120)]}
def voice(f0_curve, d, vowel='uh', breath=0.15, jitter=0.03, vib=(5, 0.03), rough=0.0, vowel2=None):
    x = t(d); f0 = f0_curve(x) * (1 + vib[1] * np.sin(2 * np.pi * vib[0] * x)) * (1 + jitter * lp(rng.standard_normal(len(x)), 30) * 5)
    ph = np.cumsum(f0) / SR
    glot = (np.mod(ph, 1.0) < 0.4) * np.sin(np.pi * np.mod(ph, 1.0) / 0.4) ** 2
    glot = np.diff(glot, prepend=0) * 20
    if rough: glot *= 1 + rough * np.sign(np.sin(2 * np.pi * np.cumsum(f0 * 0.5) / SR))
    src = glot + noise(d) * breath
    out = np.zeros(len(x))
    for (f, a, bw) in FORMANTS[vowel]:
        b, aa = signal.iirpeak(f, f / bw * 2, fs=SR) if f < SR / 2 else (None, None)
        out += signal.lfilter(b, aa, src) * a
    if vowel2:
        out2 = np.zeros(len(x))
        for (f, a, bw) in FORMANTS[vowel2]:
            b, aa = signal.iirpeak(f, f / bw * 2, fs=SR); out2 += signal.lfilter(b, aa, src) * a
        k = np.clip(x / d, 0, 1); out = out * (1 - k) + out2 * k
    return out

def shape(d, att=0.04, rel=0.25):
    x = t(d); e = np.ones(len(x)); a = int(SR * att); r = int(SR * rel)
    e[:a] = np.linspace(0, 1, a) ** 0.7; e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e

def grunt(f0, f1, d, vowel='uh', rough=0.3, wet=0.2, vowel2=None):
    v = voice(lambda x: f0 * (f1 / f0) ** (x / d), d, vowel, rough=rough, vowel2=vowel2) * shape(d, 0.03, d * 0.5)
    return norm(room(punch(v, 1.8), 0.3, wet))

def gurgle(d):
    x = np.zeros(int(SR * d))
    for _ in range(int(d * 25)):
        p = int(SR * rng.uniform(0, d - 0.05)); f = rng.uniform(300, 900)
        g = np.sin(2 * np.pi * np.linspace(f, f * 1.5, int(SR * .03)) * t(.03)) * env_exp(.03, .01) * rng.uniform(.1, .3)
        x[p:p + len(g)] += g
    return x

def zombie_die():
    d = 1.1; v = voice(lambda x: 150 * (60 / 150) ** (x / d), d, 'aa', rough=0.4, vowel2='uh') * shape(d, 0.04, 0.6)
    return norm(room(punch(mix(v, gurgle(d) * 0.5), 1.8), 0.4, 0.22))

def horde(die=False):
    d = 1.0 if die else 0.6; out = np.zeros(int(SR * (d + 0.25)))
    for i, (f0, f1) in enumerate([(140, 100), (170, 120), (115, 85), (190, 140)][:4 if die else 3]):
        v = voice(lambda x, a=f0, b=f1: a * (b / a) ** (x / d), d, ['uh', 'aa', 'oh', 'uh'][i], rough=0.35) * shape(d, 0.05, d * 0.5)
        p = int(SR * i * 0.07); out[p:p + len(v)] += v * rng.uniform(.6, 1)
    return norm(room(punch(out, 1.6), 0.4, 0.25))

def tank(die=False):
    d = 1.3 if die else 0.55
    v = voice(lambda x: 85 * (45 / 85 if die else 65 / 85) ** (x / d), d, 'oh', rough=0.6, breath=0.25) * shape(d, 0.05, d * 0.5)
    ring = sum(np.sin(2 * np.pi * f * t(d)) * env_exp(d, .3) * .08 for f in [620, 1710])
    parts = [v, ring]
    if die:
        crash = lp(noise(0.6), 400) * env_exp(0.6, 0.15) * 1.2; parts.append(at(crash, 0.75))
    return norm(room(punch(mix(*parts), 2.0), 0.5, 0.25, 4000))

def speedy(die=False):
    d = 0.5 if die else 0.22
    v = voice(lambda x: (420 if not die else 600) * ((900 if not die else 200) / (420 if not die else 600)) ** (x / d), d, 'ee', rough=0.1, breath=0.05, vib=(12, .05)) * shape(d, 0.01, d * 0.4)
    parts = [v]
    if die: pop = lp(noise(0.06), 2000) * env_exp(0.06, 0.01); parts.append(at(pop, 0.42))
    return norm(room(mix(*parts), 0.25, 0.2))

def ghost(die=False):
    d = 0.9 if die else 0.45; x = t(d)
    f = 400 + 900 * np.sin(np.pi * x / d) if not die else 900 * (2.5 ** (x / d))
    v = bp(noise(d), 300, 6000)
    b, a = signal.iirpeak(800, 6, fs=SR)
    res = np.zeros(len(x))
    for i in range(0, len(x), 256):
        fc = float(np.clip(f[i], 200, 6000)); b, a = signal.iirpeak(fc, 8, fs=SR); seg = v[i:i + 256]; res[i:i + len(seg)] = signal.lfilter(b, a, seg)
    res *= np.sin(np.pi * x / d) ** 1.5
    if die: res += sum(np.sin(2 * np.pi * fq * x) * np.clip(x / d, 0, 1) * env_exp(d, .5) * .15 for fq in [1800, 2400, 3000, 3600])
    return norm(room(res, 0.6, 0.35, 9000))

def sleepy(die=False):
    d = 1.4 if die else 0.8
    v = voice(lambda x: 95 * (55 / 95) ** (x / d), d, 'aa', rough=0.25, breath=0.3, vowel2='oo', vib=(3, .04)) * shape(d, 0.15, d * 0.5)
    parts = [v]
    if die: thud = lp(noise(0.4), 200) * env_exp(0.4, 0.1) * 1.5; parts.append(at(thud, 1.15))
    return norm(room(mix(*parts), 0.5, 0.25))

def dancer_die():
    d = 0.7; v = voice(lambda x: 300 * (620 / 300) ** np.clip(x / 0.35, 0, 1), d, 'oo', rough=0, breath=0.05, vib=(7, .04), vowel2='oo') * shape(d, 0.02, 0.3)
    chord = sum(np.sign(np.sin(2 * np.pi * f * t(0.35))) * env_exp(0.35, .15) * .08 for f in [523, 659, 784])
    return norm(room(mix(v, at(chord, 0.4)), 0.4, 0.25))

def blip(die=False):
    d = 0.3 if die else 0.15; s, _ = sweep(700, 150 if die else 350, d)
    return norm(room(np.sign(s) * env_exp(d, d * 0.4) * 0.6 + s * 0.4, 0.2, 0.2))

SOUNDS = {
    'fire_handgun': lambda: gunshot(800, 4000, 0.035, 120, 0.8, 1.0, 0.35, 0.25, 2.5, mech=0.3),
    'fire_striker': lambda: gunshot(500, 3500, 0.05, 90, 1.0, 1.1, 0.4, 0.25, 3.0),
    'fire_viper': lambda: gunshot(1200, 5000, 0.022, 160, 0.5, 0.9, 0.25, 0.18, 2.2),
    'fire_longshot': lambda: gunshot(300, 2500, 0.09, 70, 1.3, 1.3, 0.8, 0.35, 3.5, mech=0.5),
    'fire_cannon': lambda: explosion_cannon(),
    'fire_laser': laser,
    'fire_freeze': freeze_shot,
    'fire_bomb': bomb_launch,
    'ric_1': lambda: ricochet(3200, 1100, 0.55),
    'ric_2': lambda: ricochet(4200, 1800, 0.4, wob=0.02),
    'ric_3': lambda: ricochet(2500, 700, 0.7),
    'ric_4': lambda: ricochet(5200, 2600, 0.35, wob=0.04, impact=1.3),
    'ric_laser': ric_laser, 'ric_cannon': ric_cannon, 'ric_freeze': ric_freeze, 'ric_dodge': whoosh,
    'hit_bullet': hit_bullet, 'hit_laser': hit_laser, 'hit_cannon': hit_cannon, 'hit_armor': hit_armor, 'hit_freeze': hit_freeze,
    'explode': lambda: explosion(False), 'explode_far': lambda: explosion(True),
    'hurt_z': lambda: grunt(150, 110, 0.4, 'uh'), 'hurt_z2': lambda: grunt(130, 170, 0.35, 'aa'),
    'hurt_h': lambda: horde(False), 'hurt_tk': lambda: tank(False), 'hurt_sp': lambda: speedy(False),
    'hurt_iv': lambda: ghost(False), 'hurt_sl': lambda: sleepy(False), 'hurt_my': lambda: blip(False),
    'die_z': zombie_die, 'die_h': lambda: horde(True), 'die_tk': lambda: tank(True), 'die_sp': lambda: speedy(True),
    'die_iv': lambda: ghost(True), 'die_sl': lambda: sleepy(True), 'die_dn': dancer_die, 'die_my': lambda: blip(True),
    'ric_wall': lambda: ric_wall(), 'booster': lambda: booster(),
}
def ric_wall():
    # bullet into a wall: dull thwack, plaster crumbles, a tiny ping
    d = 0.7; thwack = lp(noise(d), 1200) * env_exp(d, 0.02) * 1.6
    s, _ = sweep(160, 70, d); thwack += s * env_exp(d, 0.05)
    crumble = np.zeros(int(SR * d))
    for _ in range(22):
        p = int(SR * rng.uniform(0.03, 0.5)); g = bp(noise(0.015), 900, 4000) * env_exp(0.015, 0.003) * rng.uniform(.1, .4)
        crumble[p:p + len(g)] += g[:len(crumble) - p]
    ping, _ = sweep(2600, 2200, 0.2); ping = ping * env_exp(0.2, 0.05) * 0.25
    return norm(room(punch(mix(thwack, crumble, at(ping, 0.02)), 2.0), 0.35, 0.2, 5000))

def booster():
    # laser booster clicks in: rising charge whine, buzz, then a clunk
    d = 1.0; x = t(d); s, f = sweep(220, 2400, 0.8)
    whine = s * np.clip(np.arange(len(s)) / len(s), 0, 1) ** 0.5 * 0.6
    buzz = np.sign(np.sin(2 * np.pi * 120 * t(0.8))) * 0.08 * env_exp(0.8, 0.5)
    clunk = lp(noise(0.15), 900) * env_exp(0.15, 0.02) * 1.2
    zap = bp(noise(0.25), 3000, 9000) * env_exp(0.25, 0.06) * 0.5
    return norm(room(mix(whine, buzz, at(clunk, 0.8), at(zap, 0.8)), 0.3, 0.2, 8000))

def explosion_cannon():
    a = gunshot(150, 1500, 0.12, 55, 1.6, 1.2, 0.7, 0.3, 3.5)
    return norm(mix(a, lp(noise(0.6), 250) * env_exp(0.6, 0.15) * 0.6))

def loud(x, target=-12.0):
    # Lift quiet sounds: measure loudness over the loudest 300 ms, push up with a soft clipper.
    w = int(SR * 0.3); e = np.convolve(x ** 2, np.ones(w) / w, 'same'); rms = 10 * np.log10(np.max(e) + 1e-12)
    if rms < target:
        g = 10 ** ((target - rms) / 20); x = np.tanh(x * g * 1.2) / 1.2
    return norm(x)

def main():
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SOUNDS.items():
            x = loud(fn()) if not name.startswith('explode_far') else fn(); wav = pathlib.Path(tmp) / f'{name}.wav'; mp3 = pathlib.Path(tmp) / f'{name}.mp3'
            from scipy.io import wavfile
            wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-ac', '1', '-ar', str(SR), '-b:a', '64k', str(mp3)], check=True)
            out[name] = base64.b64encode(mp3.read_bytes()).decode()
    js = '// Generated by tools/make_sfx.py. Sound effects rendered from code (no third-party audio).\nexport const SFX = ' + json.dumps(out) + ';\n'
    (root / 'js' / 'sfxdata.js').write_text(js)
    print(len(out), 'sounds,', len(js) // 1024, 'KB')

if __name__ == '__main__':
    main()
