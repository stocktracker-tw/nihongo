"""用 Azure 語音（Neural TTS）產生 App 的發音檔。

用法：
  1. 設定環境變數 AZURE_SPEECH_KEY、AZURE_SPEECH_REGION（金鑰不會寫進任何檔案）
  2. python tools/gen_audio.py            # 只產生缺少的檔案
     python tools/gen_audio.py --force    # 全部重新產生

讀 tools/texts.json（由 tools/collect.html 產生），輸出 audio/<雜湊>.mp3 與 audio/index.json。
App 只會播放這些預先產生的 mp3；網頁裡完全不含 Azure 金鑰。
"""
import http.client, json, os, re, subprocess, sys, time, urllib.request, urllib.error
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio')
# 聲音：Nanami HD，調成成熟「大姊姊」感（低一點、慢一點）
VOICE = os.environ.get('NIHONGO_VOICE', 'ja-JP-Nanami:DragonHDLatestNeural')
# HD 聲音遇到很短的輸入（單一假名、兩三拍的詞）常會拖音或多念雜音，
# 這些改用同一位說話者的標準版 Nanami（同樣低音慢速），句子和較長的詞才用 HD。
SHORT_VOICE = 'ja-JP-NanamiNeural'
SHORT_MORAE = 3
RATE = '-12%'
PITCH = '-8%'
_SMALL = set('ゃゅょぁぃぅぇぉャュョァィゥェォ')


def morae(s: str) -> int:
    """大約的拍數：假名一字一拍（小字不算），漢字算兩拍。"""
    n = 0
    for ch in s:
        if ch in _SMALL:
            continue
        if '぀' <= ch <= 'ヿ':
            n += 1
        elif '一' <= ch <= '鿿':
            n += 2
    return max(1, n)


# 檢查工具抓到 HD 版會多念雜音的字，固定用標準版
FORCE_SHORT = {'保守', '秘書', '補助'}


def voice_for(text: str, said: str) -> str:
    if text in FORCE_SHORT:
        return SHORT_VOICE
    # 原文是假名時用原文算拍數比較準（漢字的拍數只能估計）
    has_kanji = any('一' <= ch <= '鿿' for ch in text)
    m = morae(said) if has_kanji else morae(text)
    return SHORT_VOICE if m <= SHORT_MORAE else VOICE


HERE = os.path.dirname(os.path.abspath(__file__))

# 念法修正：只影響送給 Azure 的文字，App 播放時仍用原文找檔案。
# 單獨一個詞或句首時容易念成別的讀音的漢字，改成指定的假名。
WHOLE = {   # 整段完全相同才替換
    '今': 'いま', '本': 'ほん', '雨': 'あめ', '私は': 'わたしは', '私の': 'わたしの', '本を': 'ほんを',
    '机の': 'つくえの', '学生': 'がくせい', '上に': 'うえに', '一緒に': 'いっしょに',
}
PARTS = [   # 段落中出現就替換
    ('明日', 'あした'), ('昨日', 'きのう'), ('今日', 'きょう'), ('何ですか', 'なんですか'),
    ('日本', 'にほん'), ('私', 'わたし'), ('上に', 'うえに'), ('一緒', 'いっしょ'),
    ('九時', 'くじ'), ('四時', 'よじ'), ('七時', 'しちじ'), ('母と', 'ははと'), ('雨で', 'あめで'),
]
REGEX = [
    (re.compile(r'行(?=[かきくけこっ])'), 'い'),       # 行く系動詞念 い，不念 ゆ（不影響「銀行」）
    (re.compile(r'今(?![日週年月朝晩])'), 'いま'),      # 單獨的「今」念 いま，不念 こん
]
# 漢字寫法提示（tools/hints.json，由 collect.html 產生）：假名 → 漢字，讓 Azure 判斷是哪個詞、音調才正確
_hints_path = os.path.join(HERE, 'hints.json')
HINTS = json.load(open(_hints_path, encoding='utf-8')) if os.path.exists(_hints_path) else {}


def tts_text(t: str) -> str:
    if t in WHOLE:
        return WHOLE[t]
    # 單一平假名（は・へ・を…）單獨念時會被當成助詞，改用同音的片假名
    if len(t) == 1 and 'ぁ' <= t <= 'ゖ':
        return chr(ord(t) + 0x60)
    t = HINTS.get(t, t)
    for a, b in PARTS:
        t = t.replace(a, b)
    for rx, b in REGEX:
        t = rx.sub(b, t)
    return t


def speech_hash(s: str) -> str:
    """FNV-1a 32 位元，與 app.js 的 speechHash() 相同。"""
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def synth(text, key, region, voice=None):
    voice = voice or VOICE
    ssml = (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>"
            f"<voice name='{voice}'><prosody rate='{RATE}' pitch='{PITCH}'>{escape(text)}</prosody></voice></speak>")
    req = urllib.request.Request(
        f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
        data=ssml.encode('utf-8'), method='POST',
        headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'nihongo-tts'})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                wait = float(e.headers.get('Retry-After') or 0) or min(60, 2 ** attempt * 2)
                print(f'  {e.code}，{wait:.0f} 秒後重試', flush=True)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, http.client.HTTPException, ConnectionError, TimeoutError):
            time.sleep(min(60, 2 ** attempt * 2))
    raise RuntimeError('重試太多次仍失敗：' + text)


BATCH = 25          # 一次請 Azure 念幾個字（免費方案每分鐘只能 20 次請求，逐字產生太慢）
GAP_MS = 1500       # 字與字之間插入的停頓
SPLIT_MS = 800      # 超過這麼長的靜音就當成切點（字裡面的停頓都比這短）


def synth_pcm(texts, key, region, voice):
    """一次念多個字，回傳 24kHz 16-bit 單聲道 PCM（numpy）。"""
    import numpy as np, wave, io
    body = f"<break time='{GAP_MS}ms'/>".join(escape(t) for t in texts)
    ssml = (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>"
            f"<voice name='{voice}'><prosody rate='{RATE}' pitch='{PITCH}'>{body}</prosody></voice></speak>")
    req = urllib.request.Request(
        f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode('utf-8'), method='POST',
        headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'nihongo-tts'})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                w = wave.open(io.BytesIO(r.read()))
                return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                wait = float(e.headers.get('Retry-After') or 0) or min(60, 2 ** attempt * 2)
                print(f'  {e.code}，{wait:.0f} 秒後重試', flush=True)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, http.client.HTTPException, ConnectionError, TimeoutError):
            time.sleep(min(60, 2 ** attempt * 2))
    raise RuntimeError('重試太多次仍失敗')


def split_pcm(x, n, sr=24000):
    """依長靜音把一段錄音切成 n 段；切不出剛好 n 段就回傳 None。"""
    import numpy as np
    f = sr // 50  # 20ms
    frames = x[: len(x) // f * f].reshape(-1, f).astype(np.float32)
    rms = np.sqrt((frames ** 2).mean(axis=1)) + 1e-9
    loud = 20 * np.log10(rms / rms.max()) > -40
    segs, start, quiet = [], None, 0
    for k, on in enumerate(loud):
        if on:
            if start is None:
                start = k
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 20 >= SPLIT_MS:
                segs.append((start, k - quiet + 1)); start, quiet = None, 0
    if start is not None:
        segs.append((start, len(loud) - quiet))
    if len(segs) != n:
        return None
    pad = 6  # 前後各留 120ms
    return [x[max(0, a - pad) * f: min(len(loud), b + pad) * f] for a, b in segs]


def pcm_to_mp3(x, path, sr=24000):
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '48k', path], input=x.tobytes(), check=True)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows 主控台預設 cp950，印日文會出錯
    key, region = os.environ.get('AZURE_SPEECH_KEY'), os.environ.get('AZURE_SPEECH_REGION')
    if not key or not region:
        sys.exit('請先設定環境變數 AZURE_SPEECH_KEY 與 AZURE_SPEECH_REGION')
    force = '--force' in sys.argv
    texts = json.load(open(os.path.join(ROOT, 'tools', 'texts.json'), encoding='utf-8'))
    jlpt = os.path.join(ROOT, 'tools', 'texts_jlpt.json')   # N5~N1 單字書（tools/build_vocab.py 產生）
    if os.path.exists(jlpt):
        seen = set(texts)
        texts += [t for t in json.load(open(jlpt, encoding='utf-8')) if t not in seen]
    hashes = {}
    for t in texts:
        h = speech_hash(t)
        assert hashes.setdefault(h, t) == t, f'雜湊碰撞：{t} / {hashes[h]}'
    os.makedirs(OUT, exist_ok=True)
    # 記錄每個檔案是用什麼「念法＋聲音設定」產生的；念法或聲音變了就自動重做
    made_path = os.path.join(HERE, 'made.json')
    made_log = json.load(open(made_path, encoding='utf-8')) if os.path.exists(made_path) else {}
    index, made, todo = {}, 0, []
    for t in texts:
        h = speech_hash(t)
        said = tts_text(t)
        voice = voice_for(t, said)
        want = f'{voice}|{RATE}|{PITCH}|{said}'
        index[h] = t
        if force or not os.path.exists(os.path.join(OUT, h + '.mp3')) or made_log.get(h) != want:
            todo.append((t, h, said, voice, want))

    def save_log():
        with open(made_path, 'w', encoding='utf-8') as f:
            json.dump({h: made_log[h] for h in sorted(made_log) if h in index}, f, ensure_ascii=False, indent=0)

    def one(t, h, said, voice, want):
        with open(os.path.join(OUT, h + '.mp3'), 'wb') as f:
            f.write(synth(said, key, region, voice))
        made_log[h] = want

    print(f'需要產生 {len(todo)} 個檔案', flush=True)
    by_voice = {}
    for item in todo:
        by_voice.setdefault(item[3], []).append(item)
    for voice, items in by_voice.items():
        for k in range(0, len(items), BATCH):
            chunk = items[k:k + BATCH]
            if len(chunk) == 1:
                one(*chunk[0])
            else:
                parts = split_pcm(synth_pcm([c[2] for c in chunk], key, region, voice), len(chunk))
                if parts is None:   # 切不準就逐字重做這一批
                    print(f'  這批切不準，逐字產生（{chunk[0][0]}…）', flush=True)
                    for c in chunk:
                        one(*c)
                else:
                    for c, x in zip(chunk, parts):
                        pcm_to_mp3(x, os.path.join(OUT, c[1] + '.mp3'))
                        made_log[c[1]] = c[4]
            made += len(chunk)
            save_log()
            print(f'[{made}/{len(todo)}] {chunk[-1][0]}', flush=True)
    save_log()
    # 刪掉清單裡已經沒有的舊檔
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f[:-4] not in index:
            os.remove(os.path.join(OUT, f))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(sorted(index), f, separators=(',', ':'))
    print(f'完成：共 {len(index)} 段，新產生 {made} 個檔案（短的用 {SHORT_VOICE}，其餘 {VOICE}）')


if __name__ == '__main__':
    main()
