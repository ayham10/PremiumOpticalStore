/** Visual RTL for jsPDF (LTR drawing). Hebrew is reversed; Arabic is shaped then reversed. */

const ARABIC_LETTER =
  /[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]/;

type JoinForm = {
  isolated: string;
  final: string;
  initial: string;
  medial: string;
};

const FORMS: Record<string, JoinForm> = {
  ا: { isolated: "ا", final: "ﺎ", initial: "ا", medial: "ﺎ" },
  أ: { isolated: "أ", final: "ﺄ", initial: "أ", medial: "ﺄ" },
  إ: { isolated: "إ", final: "ﺈ", initial: "إ", medial: "ﺈ" },
  آ: { isolated: "آ", final: "ﺂ", initial: "آ", medial: "ﺂ" },
  ب: { isolated: "ﺏ", final: "ﺐ", initial: "ﺑ", medial: "ﺒ" },
  ت: { isolated: "ﺕ", final: "ﺖ", initial: "ﺗ", medial: "ﺘ" },
  ث: { isolated: "ﺙ", final: "ﺚ", initial: "ﺛ", medial: "ﺜ" },
  ج: { isolated: "ﺝ", final: "ﺞ", initial: "ﺟ", medial: "ﺠ" },
  ح: { isolated: "ﺡ", final: "ﺢ", initial: "ﺣ", medial: "ﺤ" },
  خ: { isolated: "ﺥ", final: "ﺦ", initial: "ﺧ", medial: "ﺨ" },
  د: { isolated: "د", final: "ﺪ", initial: "د", medial: "ﺪ" },
  ذ: { isolated: "ذ", final: "ﺬ", initial: "ذ", medial: "ﺬ" },
  ر: { isolated: "ر", final: "ﺮ", initial: "ر", medial: "ﺮ" },
  ز: { isolated: "ز", final: "ﺰ", initial: "ز", medial: "ﺰ" },
  س: { isolated: "ﺱ", final: "ﺲ", initial: "ﺳ", medial: "ﺴ" },
  ش: { isolated: "ﺵ", final: "ﺶ", initial: "ﺷ", medial: "ﺸ" },
  ص: { isolated: "ﺹ", final: "ﺺ", initial: "ﺻ", medial: "ﺼ" },
  ض: { isolated: "ﺽ", final: "ﺾ", initial: "ﺿ", medial: "ﻀ" },
  ط: { isolated: "ﻁ", final: "ﻂ", initial: "ﻃ", medial: "ﻄ" },
  ظ: { isolated: "ﻅ", final: "ﻆ", initial: "ﻇ", medial: "ﻈ" },
  ع: { isolated: "ﻉ", final: "ﻊ", initial: "ﻋ", medial: "ﻌ" },
  غ: { isolated: "ﻍ", final: "ﻎ", initial: "ﻏ", medial: "ﻐ" },
  ف: { isolated: "ﻑ", final: "ﻒ", initial: "ﻓ", medial: "ﻔ" },
  ق: { isolated: "ﻕ", final: "ﻖ", initial: "ﻗ", medial: "ﻘ" },
  ك: { isolated: "ﻙ", final: "ﻚ", initial: "ﻛ", medial: "ﻜ" },
  ل: { isolated: "ﻝ", final: "ﻞ", initial: "ﻟ", medial: "ﻠ" },
  م: { isolated: "ﻡ", final: "ﻢ", initial: "ﻣ", medial: "ﻤ" },
  ن: { isolated: "ﻥ", final: "ﻦ", initial: "ﻧ", medial: "ﻨ" },
  ه: { isolated: "ﻩ", final: "ﻪ", initial: "ﻫ", medial: "ﻬ" },
  و: { isolated: "و", final: "ﻮ", initial: "و", medial: "ﻮ" },
  ي: { isolated: "ﻱ", final: "ﻲ", initial: "ﻳ", medial: "ﻴ" },
  ى: { isolated: "ى", final: "ﻰ", initial: "ى", medial: "ﻰ" },
  ة: { isolated: "ة", final: "ﺔ", initial: "ة", medial: "ﺔ" },
  ئ: { isolated: "ﺉ", final: "ﺊ", initial: "ﺋ", medial: "ﺌ" },
  ء: { isolated: "ء", final: "ء", initial: "ء", medial: "ء" },
};

const DUAL_JOINING = new Set("بتثجحخسشصضطظعغفقكلمنهيئ");

function isArabicLetter(char: string): boolean {
  return ARABIC_LETTER.test(char);
}

function canJoinAfter(char: string): boolean {
  return DUAL_JOINING.has(char);
}

function reshapeArabic(text: string): string {
  const ligatured = text
    .replaceAll("لا", "ﻻ")
    .replaceAll("لأ", "ﻷ")
    .replaceAll("لإ", "ﻹ")
    .replaceAll("لآ", "ﻵ");
  const chars = [...ligatured];
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;
    const form = FORMS[char];
    if (!form) {
      out += char;
      continue;
    }
    const prev = chars[i - 1] ?? "";
    const next = chars[i + 1] ?? "";
    const joinsPrev = isArabicLetter(prev) && canJoinAfter(prev);
    const joinsNext = isArabicLetter(next) && canJoinAfter(char);
    if (joinsPrev && joinsNext) out += form.medial;
    else if (joinsPrev) out += form.final;
    else if (joinsNext) out += form.initial;
    else out += form.isolated;
  }
  return out;
}

export function pdfRtlText(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) {
    return [...reshapeArabic(text)].reverse().join("");
  }
  if (/[\u0590-\u05FF]/.test(text)) {
    return [...text].reverse().join("");
  }
  return text;
}
