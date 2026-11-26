"""檢查發音檔：量出實際說話長度；太長的（可能拖音或多念）再用 Azure 語音辨識聽它說了什麼。

  python tools/check_audio.py
需要 ffmpeg、numpy，以及環境變數 AZURE_SPEECH_KEY、AZURE_SPEECH_REGION。
"""
import json, os, subprocess, sys, time, urllib.request, urllib.parse, urllib.error
import importlib.util
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen_audio.py'))
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)


def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32)


def speech_secs(x):
    """有聲音的範圍：第一個到最後一個超過門檻（最大音量 -35dB）的 20ms 音框。"""
    f = 320
    if len(x) < f:
        return 0.0
    frames = x[: len(x) // f * f].reshape(-1, f)
    rms = np.sqrt((frames ** 2).mean(axis=1)) + 1e-9
    on = np.where(20 * np.log10(rms / rms.max()) > -35)[0]
    return 0.0 if len(on) == 0 else (on[-1] - on[0] + 1) * 0.02


def recognize(x, key, region):
    wav = subprocess.run(['ffmpeg', '-v', 'quiet', '-f', 's16le', '-ar', '16000', '-ac', '1', '-i', '-', '-f', 'wav', '-'],
                         input=x.astype(np.int16).tobytes(), capture_output=True, check=True).stdout
    url = (f'https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?'
           + urllib.parse.urlencode({'language': 'ja-JP', 'format': 'simple'}))
    for attempt in range(5):
        req = urllib.request.Request(url, data=wav, method='POST', headers={
            'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', 'User-Agent': 'nihongo-tts'})
        try:
            return json.load(urllib.request.urlopen(req, timeout=30)).get('DisplayText', '')
        except urllib.error.HTTPError as e:
            if e.code in (401, 429, 500, 503):
                time.sleep(3 * (attempt + 1)); continue
            return f'(辨識失敗 {e.code})'
    return '(辨識失敗)'


def limit_for(t):
    has_kanji = any('一' <= ch <= '鿿' for ch in t)
    return 0.55 + 0.32 * gen.morae(gen.tts_text(t) if has_kanji else t)  # 稍慢語速下每拍約 0.2 秒，留寬裕


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    key, region = os.environ['AZURE_SPEECH_KEY'], os.environ['AZURE_SPEECH_REGION']
    texts = json.load(open(os.path.join(HERE, 'texts.json'), encoding='utf-8'))
    flagged = []
    for t in texts:
        x = pcm(os.path.join(ROOT, 'audio', gen.speech_hash(t) + '.mp3'))
        secs = speech_secs(x)
        if secs > limit_for(t):
            flagged.append((t, secs, x))
    print(f'{len(texts)} 個檔案，可疑 {len(flagged)} 個', flush=True)
    for t, secs, x in flagged:
        said = gen.tts_text(t)
        print(f'  {secs:.2f}s（上限 {limit_for(t):.2f}s）{gen.voice_for(t, said)}  {t} → 「{said}」 聽到「{recognize(x, key, region)}」', flush=True)


if __name__ == '__main__':
    main()
