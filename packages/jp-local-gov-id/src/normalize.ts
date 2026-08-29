/** 都道府県コード入力を 2 桁に正規化する。無効なら null */
export function normalizePrefectureCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 1 || digits.length > 2) return null;
  return digits.padStart(2, "0");
}

/**
 * getByCode 用: 1–2 桁 → 都道府県組織キー、6 桁 → 地方公共団体コード候補
 * （都道府県エンティティ / 市区町村は呼び出し側で二次判定）。
 */
export function normalizeLookupCode(
  input: string,
):
  | { kind: "prefecture"; code: string }
  | { kind: "entity"; code: string }
  | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 1 || digits.length === 2) {
    return { kind: "prefecture", code: digits.padStart(2, "0") };
  }
  if (digits.length === 6) {
    return { kind: "entity", code: digits };
  }
  return null;
}

/** 市区町村コード（6 桁）のみ。それ以外は null */
export function normalizeMunicipalityCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/**
 * 検索比較用: ひらがな→カタカナ、全角カナ→半角カナ。
 * 漢字などはそのまま残す。
 */
export function normalizeSearchText(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;

    // Hiragana → Katakana
    if (code >= 0x3041 && code <= 0x3096) {
      out += String.fromCodePoint(code + 0x60);
      continue;
    }

    out += ch;
  }

  return toHalfwidthKatakana(out);
}

/** Fullwidth katakana (and voiced marks) → halfwidth. */
function toHalfwidthKatakana(input: string): string {
  const base: Record<string, string> = {
    ア: "ｱ",
    イ: "ｲ",
    ウ: "ｳ",
    エ: "ｴ",
    オ: "ｵ",
    カ: "ｶ",
    キ: "ｷ",
    ク: "ｸ",
    ケ: "ｹ",
    コ: "ｺ",
    サ: "ｻ",
    シ: "ｼ",
    ス: "ｽ",
    セ: "ｾ",
    ソ: "ｿ",
    タ: "ﾀ",
    チ: "ﾁ",
    ツ: "ﾂ",
    テ: "ﾃ",
    ト: "ﾄ",
    ナ: "ﾅ",
    ニ: "ﾆ",
    ヌ: "ﾇ",
    ネ: "ﾈ",
    ノ: "ﾉ",
    ハ: "ﾊ",
    ヒ: "ﾋ",
    フ: "ﾌ",
    ヘ: "ﾍ",
    ホ: "ﾎ",
    マ: "ﾏ",
    ミ: "ﾐ",
    ム: "ﾑ",
    メ: "ﾒ",
    モ: "ﾓ",
    ヤ: "ﾔ",
    ユ: "ﾕ",
    ヨ: "ﾖ",
    ラ: "ﾗ",
    リ: "ﾘ",
    ル: "ﾙ",
    レ: "ﾚ",
    ロ: "ﾛ",
    ワ: "ﾜ",
    ヲ: "ｦ",
    ン: "ﾝ",
    ァ: "ｧ",
    ィ: "ｨ",
    ゥ: "ｩ",
    ェ: "ｪ",
    ォ: "ｫ",
    ッ: "ｯ",
    ャ: "ｬ",
    ュ: "ｭ",
    ョ: "ｮ",
    ー: "ｰ",
    "・": "･",
    "゛": "ﾞ",
    "゜": "ﾟ",
  };

  const voiced: Record<string, string> = {
    ガ: "ｶﾞ",
    ギ: "ｷﾞ",
    グ: "ｸﾞ",
    ゲ: "ｹﾞ",
    ゴ: "ｺﾞ",
    ザ: "ｻﾞ",
    ジ: "ｼﾞ",
    ズ: "ｽﾞ",
    ゼ: "ｾﾞ",
    ゾ: "ｿﾞ",
    ダ: "ﾀﾞ",
    ヂ: "ﾁﾞ",
    ヅ: "ﾂﾞ",
    デ: "ﾃﾞ",
    ド: "ﾄﾞ",
    バ: "ﾊﾞ",
    ビ: "ﾋﾞ",
    ブ: "ﾌﾞ",
    ベ: "ﾍﾞ",
    ボ: "ﾎﾞ",
    パ: "ﾊﾟ",
    ピ: "ﾋﾟ",
    プ: "ﾌﾟ",
    ペ: "ﾍﾟ",
    ポ: "ﾎﾟ",
    ヴ: "ｳﾞ",
  };

  let out = "";
  for (const ch of input) {
    if (voiced[ch]) {
      out += voiced[ch];
    } else if (base[ch]) {
      out += base[ch];
    } else {
      out += ch;
    }
  }
  return out;
}
