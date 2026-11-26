"""把 tools/vocab_master.tsv（日文）＋ tools/zh/*.tsv（中文）合併成 App 用的 data/jlpt/n1~n5.json，
並把每個單字要念的文字寫進 tools/texts_jlpt.json（給 gen_audio.py 產生 Azure 發音）。

  python -I tools/build_vocab.py

每個單字：
  i  id（"j" + 編號）    w  顯示寫法    r  讀音    m  中文意思    n  備註
  s  發音用文字：有漢字且寫法不重複、而且不是單一漢字 → 用漢字（Azure 才知道是哪個詞、音調才對）；
     其餘用讀音（避免「上」「方」「明日」這種多讀音的字念錯）。
資料來源：open-anki-jlpt-decks（MIT），原始資料 tanos.co.uk / Jonathan Waller（CC BY）。
"""
import csv, glob, json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KANJI = re.compile(r'[一-鿿々]')
KANA = re.compile(r'^[぀-ヿー～・\s]+$')


def main():
    rows = list(csv.DictReader(open(os.path.join(HERE, 'vocab_master.tsv'), encoding='utf-8'), delimiter='\t'))
    zh = {}
    for f in glob.glob(os.path.join(HERE, 'zh', '*.tsv')):
        for line in open(f, encoding='utf-8'):
            line = line.rstrip('\n')
            if line:
                i, t = line.split('\t', 1)
                zh[i] = t
    expr_count = collections.Counter(r['word'] for r in rows)
    levels = collections.defaultdict(list)
    says = []
    for r in rows:
        w, rd, note = r['word'].strip(), r['reading'].strip(), r['note'].strip()
        # 資料錯置：讀音欄是漢字、寫法欄是假名（例如 いただく｜頂く）→ 對調
        if KANJI.search(rd) and not KANJI.search(w):
            w, rd = rd, w
        if not rd:
            rd = w
        # 讀音後面黏了「する」（うんどうする）→ 拿掉，記在備註
        if rd.endswith('する') and not w.endswith('する') and len(rd) > 2:
            rd = rd[:-2]
            if 'する' not in note:
                note = (note + '；' if note else '') + '可加する作動詞'
        if note.startswith('する；'):
            note = note[3:]
        m = re.match(r'^(.+)；\1$', note)          # 「タイム；タイム」這種重複
        if m:
            note = m.group(1)
        w = re.sub(r'\s*～\s*', '～', w)            # 「～ しまう」→「～しまう」
        rd = re.sub(r'\s*～\s*', '～', rd)
        plain_w = w.replace('～', '').strip()
        plain_r = rd.replace('～', '').strip()
        if KANJI.search(plain_w) and len(plain_w) >= 2 and expr_count[r['word']] == 1 and '～' not in w:
            say = plain_w
        else:
            say = plain_r or plain_w
        item = {'i': 'j' + r['id'], 'w': w, 'r': rd if rd != w else '', 'm': zh[r['id']], 's': say}
        if note:
            item['n'] = note
        levels[r['level']].append(item)
        says.append(say)
    os.makedirs(os.path.join(ROOT, 'data', 'jlpt'), exist_ok=True)
    for lv, items in levels.items():
        path = os.path.join(ROOT, 'data', 'jlpt', f'n{lv}.json')
        json.dump(items, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print(f'N{lv}: {len(items)} 個單字 → {path} ({os.path.getsize(path) // 1024} KB)')
    index = {f'n{lv}': len(items) for lv, items in levels.items()}
    json.dump(index, open(os.path.join(ROOT, 'data', 'jlpt', 'index.json'), 'w', encoding='utf-8'))
    uniq = sorted(set(s for s in says if s))
    json.dump(uniq, open(os.path.join(HERE, 'texts_jlpt.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(uniq), '段發音文字 → tools/texts_jlpt.json')


if __name__ == '__main__':
    main()
