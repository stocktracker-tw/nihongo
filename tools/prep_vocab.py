"""整理 vendor/jlpt/*.csv（open-anki-jlpt-decks，MIT；原始資料 tanos.co.uk / Jonathan Waller，CC BY）
→ tools/vocab_master.tsv：id, 級數, 顯示寫法, 讀音, 備註, 英文釋義

  python -I tools/prep_vocab.py            # 產生 master
  python -I tools/prep_vocab.py show 0 300 # 列出第 0~299 筆（翻譯用）
同一個（寫法, 讀音）出現在多個級數時，歸到最簡單的級數。
"""
import csv, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MASTER = os.path.join(HERE, 'vocab_master.tsv')


def clean(expr, reading):
    note = ''
    # 括號裡的用法說明，例如「こす (みずを～)」「はあ (かん)」→ 移到備註
    m = re.search(r'\s*[（(]([^)）]*)[)）]\s*', expr)
    if m:
        inner = m.group(1)
        note = '感嘆詞' if inner == 'かん' else inner
        expr = (expr[:m.start()] + ' ' + expr[m.end():]).strip()
    alts = [a.strip() for a in re.split(r'[;；]', expr) if a.strip()]
    main = alts[0] if alts else expr
    other = '、'.join(alts[1:])
    rm = re.search(r'\s*[（(]([^)）]*)[)）]\s*', reading)
    if rm:
        inner = rm.group(1)
        tag = '可加する作動詞' if inner == 'する' else inner
        note = (note + '；' if note else '') + tag
        reading = (reading[:rm.start()] + ' ' + reading[rm.end():]).strip()
    r_alts = [a.strip() for a in re.split(r'[;；]', reading) if a.strip()]
    reading = r_alts[0] if r_alts else reading
    main = main.replace('〜', '～')
    return main, reading.replace('〜', '～'), note, other


def build():
    seen, rows = {}, []
    for n in [5, 4, 3, 2, 1]:
        for r in csv.DictReader(open(os.path.join(ROOT, 'vendor', 'jlpt', f'n{n}.csv'), encoding='utf-8')):
            expr, reading, note, other = clean(r['expression'].strip(), r['reading'].strip())
            key = (expr, reading)
            if key in seen or not expr:
                continue
            seen[key] = True
            if other:
                note = (note + '；' if note else '') + '也寫作 ' + other
            rows.append((len(rows), n, expr, reading, note, ' '.join(r['meaning'].split())))
    with open(MASTER, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, delimiter='\t', lineterminator='\n')
        w.writerow(['id', 'level', 'word', 'reading', 'note', 'en'])
        w.writerows(rows)
    print(len(rows), 'words →', MASTER)


def show(a, b):
    sys.stdout.reconfigure(encoding='utf-8')
    rows = list(csv.reader(open(MASTER, encoding='utf-8'), delimiter='\t'))[1:]
    for r in rows[a:b]:
        i, n, word, reading, note, en = r
        extra = f' [{note}]' if note else ''
        print(f'{i}|{word}|{reading if reading != word else ""}{extra}|{en}')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'show':
        show(int(sys.argv[2]), int(sys.argv[3]))
    else:
        build()
