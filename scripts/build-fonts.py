#!/usr/bin/env python3
"""
Pretendard 서브셋 빌드 스크립트.

assets/fonts-src/Pretendard-*.otf (원본, 각 ~1.5MB) 를 읽어
(원본은 public/ 밖에 둔다 — public/ 은 통째로 정적 배포되므로)
public/font/subset/*.woff2 서브셋과 src/app/fonts.css 의 @font-face 규칙을 생성한다.

  weight당 2개 파일로 나눈다
    *-ko.woff2    Latin/기호 + KS X 1001 완성형 2350자   (~170KB)  → preload 대상
    *-koext.woff2 나머지 확장 한글                        (~440KB)  → 필요할 때만 로드

실행:  python scripts/build-fonts.py
의존:  pip install fonttools brotli
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "assets", "fonts-src")
OUT_DIR = os.path.join(ROOT, "public", "font", "subset")
CSS_PATH = os.path.join(ROOT, "src", "app", "fonts.css")

# 앱에서 실제로 사용하는 weight 만 빌드한다 (globals.css / tsx 의 font-* 클래스 기준)
WEIGHTS = {
    "400": "Pretendard-Regular.otf",
    "500": "Pretendard-Medium.otf",
    "600": "Pretendard-SemiBold.otf",
    "700": "Pretendard-Bold.otf",
    "800": "Pretendard-ExtraBold.otf",
}

# Latin, 문장부호, 통화기호, 화살표, 도형, CJK 기호, 한글 자모, 전각
BASE_RANGES = [
    (0x0020, 0x007E), (0x00A0, 0x00FF), (0x0131, 0x0131), (0x0152, 0x0153),
    (0x02BB, 0x02BC), (0x02C6, 0x02C6), (0x02DA, 0x02DA), (0x02DC, 0x02DC),
    (0x2000, 0x206F), (0x20A9, 0x20A9), (0x20AC, 0x20AC), (0x2122, 0x2122),
    (0x2190, 0x2193), (0x2212, 0x2212), (0x2215, 0x2215), (0x25A0, 0x25CF),
    (0x2713, 0x2713), (0x3000, 0x303F), (0x3131, 0x318E), (0xFE0E, 0xFE0F),
    (0xFF01, 0xFF60),
]


def ks_x_1001_syllables():
    """KS X 1001 완성형에 포함된 한글 음절 2350자."""
    out = []
    for cp in range(0xAC00, 0xD7A4):
        try:
            b = chr(cp).encode("cp949")
        except UnicodeEncodeError:
            continue
        if len(b) == 2 and 0xB0 <= b[0] <= 0xC8 and 0xA1 <= b[1] <= 0xFE:
            out.append(cp)
    return out


def collapse(cps):
    out, start, prev = [], cps[0], cps[0]
    for c in cps[1:]:
        if c == prev + 1:
            prev = c
            continue
        out.append((start, prev))
        start = prev = c
    out.append((start, prev))
    return out


def fmt_ranges(ranges):
    return ", ".join(
        f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in ranges
    )


def subset(src, codepoints, out_path):
    fd, list_path = tempfile.mkstemp(suffix=".txt", text=True)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join("U+%04X" % c for c in codepoints))
    try:
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", src,
                "--unicodes-file=" + list_path,
                "--layout-features=kern,liga,calt",
                "--flavor=woff2",
                "--desubroutinize",
                "--output-file=" + out_path,
            ],
            check=True,
        )
    finally:
        os.unlink(list_path)
    return os.path.getsize(out_path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    ks = ks_x_1001_syllables()
    ks_set = set(ks)
    ext = [cp for cp in range(0xAC00, 0xD7A4) if cp not in ks_set]
    base = [c for a, b in BASE_RANGES for c in range(a, b + 1)]
    ko_range = fmt_ranges(BASE_RANGES + collapse(ks))

    blocks = [
        "/* ─────────────────────────────────────────────────────────────────\n"
        "   Pretendard 자체 호스팅 서브셋 — scripts/build-fonts.py 가 생성한다.\n"
        "   직접 수정하지 말고 스크립트를 고친 뒤 다시 실행할 것.\n"
        "\n"
        "   *-ko.woff2     Latin/기호 + KS X 1001 2350자 (~170KB/weight)\n"
        "                  실제 한국어 UI 텍스트 대부분을 담당. layout.tsx 에서 preload.\n"
        "   *-koext.woff2  나머지 확장 한글 (~440KB/weight)\n"
        "                  희귀 음절이 실제로 렌더될 때만 내려받는다.\n"
        "\n"
        "   ko 규칙을 koext 뒤에 선언해, 두 범위가 겹치는 구간에서 ko 가 이기도록 한다.\n"
        "   ───────────────────────────────────────────────────────────────── */"
    ]

    total = 0
    for weight, filename in WEIGHTS.items():
        src = os.path.join(SRC_DIR, filename)
        ko_size = subset(src, base + ks, os.path.join(OUT_DIR, f"pretendard-{weight}-ko.woff2"))
        ext_size = subset(src, ext, os.path.join(OUT_DIR, f"pretendard-{weight}-koext.woff2"))
        total += ko_size + ext_size
        print(f"  {weight}: ko={ko_size / 1024:7.1f}KB  koext={ext_size / 1024:7.1f}KB")

        blocks.append(
            f"""
@font-face {{
  font-family: 'Pretendard';
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url('/font/subset/pretendard-{weight}-koext.woff2') format('woff2');
  unicode-range: U+AC00-D7A3;
}}
@font-face {{
  font-family: 'Pretendard';
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url('/font/subset/pretendard-{weight}-ko.woff2') format('woff2');
  unicode-range: {ko_range};
}}"""
        )

    with open(CSS_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(blocks) + "\n")

    print(f"  총 {total / 1024 / 1024:.2f}MB → {CSS_PATH}")


if __name__ == "__main__":
    main()
