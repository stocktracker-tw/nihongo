"""「大姊姊」風格的聲音候選：成熟、低一點、慢一點、帶點慵懶（tools/voice-samples/，不會上傳）。"""
import os, sys, urllib.request
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
TEXT = 'あ、い、う、え、お。こんにちは。わたしは がくせいです。すしを ください。'
# (檔名, 聲音, 風格, 語速, 音高, 說明)
VARIANTS = [
    ('onee_A_nanamiHD', 'ja-JP-Nanami:DragonHDLatestNeural', None, '-12%', '-8%', 'Nanami HD・低音慢速'),
    ('onee_B_mayu', 'ja-JP-MayuNeural', None, '-14%', '-10%', 'Mayu・柔和低音'),
    ('onee_C_shiori', 'ja-JP-ShioriNeural', None, '-12%', '-10%', 'Shiori・沉穩低音'),
    ('onee_D_nanami_chat', 'ja-JP-NanamiNeural', 'chat', '-15%', '-9%', 'Nanami・聊天語氣、慵懶'),
]


def ssml(voice, style, rate, pitch, text):
    body = f"<prosody rate='{rate}' pitch='{pitch}'>{escape(text)}</prosody>"
    if style:
        body = f"<mstts:express-as style='{style}'>{body}</mstts:express-as>"
    return ("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' "
            "xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='ja-JP'>"
            f"<voice name='{voice}'>{body}</voice></speak>")


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    key, region = os.environ['AZURE_SPEECH_KEY'], os.environ['AZURE_SPEECH_REGION']
    out = os.path.join(HERE, 'voice-samples'); os.makedirs(out, exist_ok=True)
    for fn, voice, style, rate, pitch, desc in VARIANTS:
        req = urllib.request.Request(
            f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1',
            data=ssml(voice, style, rate, pitch, TEXT).encode('utf-8'), method='POST',
            headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                     'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'nihongo-tts'})
        data = urllib.request.urlopen(req, timeout=30).read()
        open(os.path.join(out, fn + '.mp3'), 'wb').write(data)
        print('ok', fn, desc, len(data), flush=True)


if __name__ == '__main__':
    main()
