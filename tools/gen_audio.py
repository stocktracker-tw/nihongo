"""用 Azure 語音（Neural TTS）產生 App 的發音檔。

用法：
  1. 設定環境變數 AZURE_SPEECH_KEY、AZURE_SPEECH_REGION（金鑰不會寫進任何檔案）
  2. python tools/gen_audio.py            # 只產生缺少的檔案
     python tools/gen_audio.py --force    # 全部重新產生

讀 tools/texts.json（由 tools/collect.html 產生），輸出 audio/<雜湊>.mp3 與 audio/index.json。
App 只會播放這些預先產生的 mp3；網頁裡完全不含 Azure 金鑰。
"""
import json, os, sys, time, urllib.request, urllib.error
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio')
# 聲音：Nanami HD，調成成熟「大姊姊」感（低一點、慢一點）
VOICE = os.environ.get('NIHONGO_VOICE', 'ja-JP-Nanami:DragonHDLatestNeural')
RATE = '-12%'
PITCH = '-8%'


HERE = os.path.dirname(os.path.abspath(__file__))

# 念法修正：只影響送給 Azure 的文字，App 播放時仍用原文找檔案。
# 單獨一個詞或句首時容易念成別的讀音的漢字，改成指定的假名。
WHOLE = {   # 整段完全相同才替換
    '今': 'いま', '本': 'ほん', '雨': 'あめ', '私は': 'わたしは', '私の': 'わたしの', '本を': 'ほんを',
    '机の': 'つくえの', '学生': 'がくせい', '上に': 'うえに', '一緒に': 'いっしょに',
}
PARTS = [   # 段落中出現就替換
    ('明日', 'あした'), ('昨日', 'きのう'), ('今日', 'きょう'), ('何ですか', 'なんですか'),
    ('日本', 'にほん'), ('私', 'わたし'), ('上に', 'うえに'),
]


def tts_text(t: str) -> str:
    if t in WHOLE:
        return WHOLE[t]
    # 單一平假名（は・へ・を…）單獨念時會被當成助詞，改用同音的片假名
    if len(t) == 1 and 'ぁ' <= t <= 'ゖ':
        return chr(ord(t) + 0x60)
    for a, b in PARTS:
        t = t.replace(a, b)
    return t


def speech_hash(s: str) -> str:
    """FNV-1a 32 位元，與 app.js 的 speechHash() 相同。"""
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def synth(text, key, region):
    ssml = (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>"
            f"<voice name='{VOICE}'><prosody rate='{RATE}' pitch='{PITCH}'>{escape(text)}</prosody></voice></speak>")
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
        except urllib.error.URLError:
            time.sleep(min(60, 2 ** attempt * 2))
    raise RuntimeError('重試太多次仍失敗：' + text)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows 主控台預設 cp950，印日文會出錯
    key, region = os.environ.get('AZURE_SPEECH_KEY'), os.environ.get('AZURE_SPEECH_REGION')
    if not key or not region:
        sys.exit('請先設定環境變數 AZURE_SPEECH_KEY 與 AZURE_SPEECH_REGION')
    force = '--force' in sys.argv
    texts = json.load(open(os.path.join(ROOT, 'tools', 'texts.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    # 記錄每個檔案是用什麼「念法＋聲音設定」產生的；念法或聲音變了就自動重做
    made_path = os.path.join(HERE, 'made.json')
    made_log = json.load(open(made_path, encoding='utf-8')) if os.path.exists(made_path) else {}
    sig = f'{VOICE}|{RATE}|{PITCH}'
    index, made = {}, 0
    for i, t in enumerate(texts, 1):
        h = speech_hash(t)
        path = os.path.join(OUT, h + '.mp3')
        said = tts_text(t)
        want = f'{sig}|{said}'
        if force or not os.path.exists(path) or made_log.get(h) != want:
            data = synth(said, key, region)
            with open(path, 'wb') as f:
                f.write(data)
            made += 1
            print(f'[{i}/{len(texts)}] {t}' + (f'  →  {said}' if said != t else ''), flush=True)
        made_log[h] = want
        index[h] = t
    with open(made_path, 'w', encoding='utf-8') as f:
        json.dump({h: made_log[h] for h in sorted(index)}, f, ensure_ascii=False, indent=0)
    # 刪掉清單裡已經沒有的舊檔
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f[:-4] not in index:
            os.remove(os.path.join(OUT, f))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(sorted(index), f, separators=(',', ':'))
    print(f'完成：共 {len(index)} 段，新產生 {made} 個檔案（{VOICE}）')


if __name__ == '__main__':
    main()
