import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/product-images";
import type { CustomPageProductCard } from "@/components/services/CustomPageProductsCarousel";
import type { CustomPageCopy, ServicePagesLocale } from "@/lib/types";

type PlaceholderCopy = Pick<
  CustomPageCopy,
  | "eyebrow"
  | "title"
  | "description"
  | "bookingButtonText"
  | "benefitsTitle"
  | "benefits"
  | "warningTitle"
  | "warningText"
  | "valuesTitle"
  | "valuesText"
  | "privacyText"
> & {
  features: Array<{ title: string; description: string }>;
  products: Array<{ name: string; category: CustomPageProductCard["category"] }>;
};

const SAMPLE: Record<ServicePagesLocale, PlaceholderCopy> = {
  ar: {
    eyebrow: "عناية احترافية بالعين",
    title: "عنوان الخدمة يظهر هنا",
    description:
      "أضيفوا وصفاً واضحاً لهذه الخدمة. سيظهر النص هنا بنفس تنسيق الصفحة العامة.",
    bookingButtonText: "احجز موعدك",
    features: [
      { title: "ميزة أولى", description: "شرح قصير يوضح قيمة هذه الميزة للزائر." },
      { title: "ميزة ثانية", description: "جملة واحدة عن الجهاز أو الخبرة أو الراحة." },
      { title: "ميزة ثالثة", description: "تفاصيل مختصرة تساعد الزائر على اتخاذ قرار." },
      { title: "ميزة رابعة", description: "يمكن استبدال هذا النص بالمحتوى الحقيقي لاحقاً." },
    ],
    benefitsTitle: "لماذا تختارون هذه الخدمة؟",
    benefits: [
      "فائدة واضحة تظهر في قائمة مرتبة",
      "نقطة ثانية بأسلوب العيادة الذهبي",
      "نقطة ثالثة مختصرة وسهلة القراءة",
    ],
    warningTitle: "معلومة مهمة",
    warningText:
      "سيظهر هنا تنبيه أو معلومة يريد الزائر قراءتها قبل الحجز أو الشراء.",
    valuesTitle: "الدقة والعناية",
    valuesText: "جملة قصيرة عن قيم العيادة كما تظهر في صفحة فحص النظر.",
    privacyText: "نحترم خصوصية بياناتكم الطبية ولا نشاركها.",
    products: [
      { name: "إطار تجريبي أول", category: "Frames" },
      { name: "عدسات تجريبية", category: "Contact Lenses" },
      { name: "نظارة شمسية تجريبية", category: "Sunglasses" },
    ],
  },
  he: {
    eyebrow: "טיפול מקצועי בעיניים",
    title: "כותרת השירות תופיע כאן",
    description:
      "הוסיפו תיאור ברור לשירות. הטקסט יופיע כאן באותו פריסת העמוד הציבורי.",
    bookingButtonText: "קביעת תור",
    features: [
      { title: "יתרון ראשון", description: "הסבר קצר על הערך למבקר." },
      { title: "יתרון שני", description: "משפט אחד על ציוד, ניסיון או נוחות." },
      { title: "יתרון שלישי", description: "פרטים קצרים שעוזרים להחליט." },
      { title: "יתרון רביעי", description: "אפשר להחליף את הטקסט בתוכן אמיתי." },
    ],
    benefitsTitle: "למה לבחור בשירות הזה?",
    benefits: [
      "יתרון ברור ברשימה מסודרת",
      "נקודה שנייה בסגנון הזהב של המרפאה",
      "נקודה שלישית קצרה וקריאה",
    ],
    warningTitle: "מידע חשוב",
    warningText: "כאן תופיע הערה או אזהרה שהמבקר צריך לקרוא לפני הזמנה.",
    valuesTitle: "דיוק וטיפול",
    valuesText: "משפט קצר על ערכי המרפאה כמו בעמוד בדיקת הראייה.",
    privacyText: "אנחנו מכבדים את פרטיות המידע הרפואי שלכם.",
    products: [
      { name: "מסגרת לדוגמה", category: "Frames" },
      { name: "עדשות לדוגמה", category: "Contact Lenses" },
      { name: "משקפי שמש לדוגמה", category: "Sunglasses" },
    ],
  },
  en: {
    eyebrow: "Professional eye care",
    title: "Service title appears here",
    description:
      "Add a clear description for this service. The copy will use the same public page layout.",
    bookingButtonText: "Book your visit",
    features: [
      { title: "First highlight", description: "A short line that shows this feature’s value." },
      { title: "Second highlight", description: "One sentence about equipment, expertise, or comfort." },
      { title: "Third highlight", description: "Brief detail that helps a visitor decide." },
      { title: "Fourth highlight", description: "Replace this sample text with real content later." },
    ],
    benefitsTitle: "Why choose this service?",
    benefits: [
      "A clear benefit in a structured list",
      "A second point in the clinic’s gold style",
      "A short third point that stays easy to read",
    ],
    warningTitle: "Important note",
    warningText:
      "A caution or information block the visitor should read before booking.",
    valuesTitle: "Precision and care",
    valuesText: "A short values line, matching the eye-exam page treatment.",
    privacyText: "We respect the privacy of your medical information.",
    products: [
      { name: "Sample frame", category: "Frames" },
      { name: "Sample lenses", category: "Contact Lenses" },
      { name: "Sample sunglasses", category: "Sunglasses" },
    ],
  },
};

function fillText(value: string, fallback: string): string {
  return value.trim() ? value : fallback;
}

export function previewPlaceholderCopy(
  locale: ServicePagesLocale,
): PlaceholderCopy {
  return SAMPLE[locale] || SAMPLE.ar;
}

export function withPreviewPlaceholders(
  copy: CustomPageCopy,
  locale: ServicePagesLocale,
): CustomPageCopy {
  const sample = previewPlaceholderCopy(locale);
  return {
    ...copy,
    complete: copy.complete,
    eyebrow: fillText(copy.eyebrow, sample.eyebrow),
    title: fillText(copy.title, sample.title),
    description: fillText(copy.description, sample.description),
    bookingButtonText: fillText(copy.bookingButtonText, sample.bookingButtonText),
    benefitsTitle: fillText(copy.benefitsTitle, sample.benefitsTitle),
    warningTitle: fillText(copy.warningTitle, sample.warningTitle),
    warningText: fillText(copy.warningText, sample.warningText),
    valuesTitle: fillText(copy.valuesTitle, sample.valuesTitle),
    valuesText: fillText(copy.valuesText, sample.valuesText),
    privacyText: fillText(copy.privacyText, sample.privacyText),
    features: copy.features.map((feature, index) => {
      const fallback = sample.features[index] || sample.features[0]!;
      return {
        ...feature,
        title: fillText(feature.title, fallback.title),
        description: fillText(feature.description, fallback.description),
      };
    }),
    benefits: copy.benefits.map((item, index) =>
      fillText(item, sample.benefits[index] || sample.benefits[0] || ""),
    ),
  };
}

export function previewPlaceholderProducts(
  locale: ServicePagesLocale,
): CustomPageProductCard[] {
  return previewPlaceholderCopy(locale).products.map((item, index) => ({
    id: `preview-placeholder-${index + 1}`,
    slug: `preview-placeholder-${index + 1}`,
    name: item.name,
    category: item.category,
    sellingPrice: 0,
    status: "active",
    images: [PLACEHOLDER_PRODUCT_IMAGE],
  }));
}

export function copyFieldIsPlaceholder(
  value: string | undefined,
  locale: ServicePagesLocale,
  field: keyof Omit<PlaceholderCopy, "features" | "products" | "benefits">,
): boolean {
  const sample = previewPlaceholderCopy(locale);
  return !String(value || "").trim() && Boolean(sample[field]);
}
