"""產生 Azure 日文語音候選的試聽檔（tools/voice-samples/，不會上傳）。"""
import json, os, sys, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('gen', os.path.join(HERE, 'gen_audio.py'))
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)

VOICES = [
    ('ja-JP-NanamiNeural', '女', '標準・明亮，最常用（目前使用）'),
    ('ja-JP-Nanami:DragonHDLatestNeural', '女', 'HD 新世代，Nanami 的更自然版'),
    ('ja-JP-AoiNeural', '女', '年輕、活潑'),
    ('ja-JP-MayuNeural', '女', '柔和、溫暖'),
    ('ja-JP-ShioriNeural', '女', '沉穩、清楚'),
    ('ja-JP-KeitaNeural', '男', '標準男聲'),
    ('ja-JP-Masaru:DragonHDLatestNeural', '男', 'HD 新世代男聲'),
    ('ja-JP-MasaruMultilingualNeural', '男', '多語言男聲'),
    ('ja-JP-DaichiNeural', '男', '成熟、穩重'),
    ('ja-JP-NaokiNeural', '男', '年輕男聲'),
]
TEXT = 'あ、い、う、え、お。こんにちは。わたしは がくせいです。すしを ください。'


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    key, region = os.environ['AZURE_SPEECH_KEY'], os.environ['AZURE_SPEECH_REGION']
    out = os.path.join(HERE, 'voice-samples'); os.makedirs(out, exist_ok=True)
    meta = []
    for name, gender, desc in VOICES:
        gen.VOICE = name
        fn = name.replace(':', '_') + '.mp3'
        try:
            data = gen.synth(TEXT, key, region)
            open(os.path.join(out, fn), 'wb').write(data)
            meta.append({'name': name, 'gender': gender, 'desc': desc, 'file': fn})
            print('ok', name, len(data), flush=True)
        except Exception as e:
            print('FAIL', name, e, flush=True)
    json.dump({'text': TEXT, 'voices': meta}, open(os.path.join(out, 'voices.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
