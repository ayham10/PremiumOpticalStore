import {
  addDaysIso,
  buildDefaultSlots,
  todayInJerusalem,
  weekdayUtc,
} from "@/lib/eye-exam";
import { newId } from "@/lib/auth";
import type {
  AppData,
  EyeExamAvailability,
  Product,
  Promotion,
  Review,
  StaffMember,
  StoreSettings,
} from "@/lib/types";

const now = () => new Date().toISOString();

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "LUMINA",
  tagline: "Precision vision. Quiet luxury.",
  address: "Main Street",
  city: "Deir Hanna",
  phone: "+972-52-123-4567",
  email: "hello@lumina.optics",
  whatsapp: "972521234567",
  googleMapsEmbedUrl:
    "https://maps.google.com/maps?q=Deir%20Hanna&t=&z=14&ie=UTF8&iwloc=&output=embed",
  googleMapsLink: "https://maps.google.com/?q=Deir+Hanna",
  openingHours: [
    { day: 0, open: "10:00", close: "16:00" },
    { day: 1, open: "09:00", close: "19:00" },
    { day: 2, open: "09:00", close: "19:00" },
    { day: 3, open: "09:00", close: "19:00" },
    { day: 4, open: "09:00", close: "19:00" },
    { day: 5, open: "09:00", close: "14:00" },
    { day: 6, open: "00:00", close: "00:00", closed: true },
  ],
  social: {
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
  },
  seo: {
    title: "LUMINA — Premium Optical Store & Eye Examinations",
    description:
      "Book eye exams, discover prescription glasses, sunglasses, and contact lenses. Premium optical care with precise fittings.",
    keywords:
      "optical store, eye exam, prescription glasses, sunglasses, contact lenses, optometrist",
  },
  smtp: {},
  sms: {
    provider: "console",
    enabled: true,
  },
  appointmentSlotMinutes: 30,
  bookingLeadDays: 45,
  currency: "ILS",
  currencySymbol: "₪",
};

export const SEED_STAFF: StaffMember[] = [
  {
    id: "staff-maya",
    name: "Dr. Maya Cohen",
    email: "maya@lumina.optics",
    phone: "+972-50-111-2200",
    role: "admin",
    title: "Lead Optometrist",
    bio: "Specialist in comprehensive eye examinations and progressive lens fitting.",
    specialties: ["Eye Examination", "Vision Consultation", "Lens Fitting"],
    active: true,
    color: "#1a4a6b",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "staff-noah",
    name: "Noah Levi",
    email: "noah@lumina.optics",
    phone: "+972-50-111-2201",
    role: "employee",
    title: "Optical Specialist",
    bio: "Frame styling, sunglasses curation, and precision measurements.",
    specialties: [
      "Prescription Glasses",
      "Sunglasses Fitting",
      "Eyeglass Frames",
    ],
    active: true,
    color: "#6b4f3a",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "staff-lina",
    name: "Lina Haddad",
    email: "lina@lumina.optics",
    phone: "+972-50-111-2202",
    role: "receptionist",
    title: "Patient Concierge",
    bio: "Appointments, fittings coordination, and patient care.",
    specialties: ["Contact Lenses", "Vision Consultation"],
    active: true,
    color: "#2f6f5e",
    createdAt: now(),
    updatedAt: now(),
  },
];

const IMG = {
  frames:
    "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=900&q=80",
  sun:
    "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80",
  contacts:
    "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=900&q=80",
  classic:
    "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=900&q=80",
  modern:
    "https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=900&q=80",
  clean:
    "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=900&q=80",
  store:
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80",
  exam:
    "https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1400&q=80",
};

export const SEED_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    slug: "aurelia-acetate-frame",
    name: "Aurelia Acetate",
    category: "Frames",
    brand: "LUMINA Atelier",
    frameType: "Rectangle",
    lensType: "Prescription Ready",
    sku: "LUM-FR-001",
    barcode: "8901001001001",
    description:
      "Hand-polished Italian acetate with sculpted temples and a quiet champagne finish.",
    images: [IMG.frames],
    purchasePrice: 180,
    sellingPrice: 420,
    stockQuantity: 14,
    minimumStock: 4,
    status: "active",
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-2",
    slug: "nordic-titanium-rim",
    name: "Nordic Titanium",
    category: "Prescription Glasses",
    brand: "Nordic Line",
    frameType: "Round",
    lensType: "Blue-light / Progressive",
    sku: "LUM-PG-014",
    barcode: "8901001001002",
    description:
      "Featherweight titanium for all-day clarity. Engineered for progressive lenses.",
    images: [IMG.classic],
    purchasePrice: 220,
    sellingPrice: 560,
    stockQuantity: 9,
    minimumStock: 3,
    status: "active",
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-3",
    slug: "solstice-polarized",
    name: "Solstice Polarized",
    category: "Sunglasses",
    brand: "Horizon",
    frameType: "Aviator",
    lensType: "Polarized UV400",
    sku: "LUM-SG-022",
    barcode: "8901001001003",
    description:
      "Mirror-grade polarized lenses with a brushed metal silhouette for bright days.",
    images: [IMG.sun],
    purchasePrice: 140,
    sellingPrice: 380,
    stockQuantity: 18,
    minimumStock: 5,
    status: "active",
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-4",
    slug: "clarity-daily-lenses",
    name: "Clarity Daily",
    category: "Contact Lenses",
    brand: "Clarity",
    lensType: "Daily Disposable",
    sku: "LUM-CL-031",
    barcode: "8901001001004",
    description:
      "Breathable daily lenses with hydration support for effortless all-day wear.",
    images: [IMG.contacts],
    purchasePrice: 45,
    sellingPrice: 120,
    stockQuantity: 40,
    minimumStock: 12,
    status: "active",
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-5",
    slug: "atelier-slim-metal",
    name: "Atelier Slim Metal",
    category: "Frames",
    brand: "LUMINA Atelier",
    frameType: "Square",
    lensType: "Prescription Ready",
    sku: "LUM-FR-008",
    barcode: "8901001001005",
    description: "Minimal metal architecture with soft bevel edges and adjustable pads.",
    images: [IMG.modern],
    purchasePrice: 160,
    sellingPrice: 390,
    stockQuantity: 6,
    minimumStock: 4,
    status: "active",
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-8",
    slug: "noir-acetate-square",
    name: "Noir Acetate Square",
    category: "Frames",
    brand: "LUMINA Atelier",
    frameType: "Square",
    lensType: "Prescription Ready",
    sku: "LUM-FR-012",
    barcode: "8901001001008",
    description: "Deep black acetate with softened corners and a matte temple finish.",
    images: [IMG.classic],
    purchasePrice: 150,
    sellingPrice: 360,
    stockQuantity: 11,
    minimumStock: 4,
    status: "active",
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-9",
    slug: "coastal-clear-rim",
    name: "Coastal Clear Rim",
    category: "Frames",
    brand: "Horizon",
    frameType: "Oval",
    lensType: "Prescription Ready",
    sku: "LUM-FR-018",
    barcode: "8901001001009",
    description: "Translucent crystal acetate with subtle coastal-blue accents.",
    images: [IMG.frames],
    purchasePrice: 135,
    sellingPrice: 340,
    stockQuantity: 8,
    minimumStock: 3,
    status: "active",
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-10",
    slug: "lineage-gold-wire",
    name: "Lineage Gold Wire",
    category: "Frames",
    brand: "Nordic Line",
    frameType: "Round",
    lensType: "Prescription Ready",
    sku: "LUM-FR-021",
    barcode: "8901001001010",
    description: "Fine gold-tone wire with adjustable nose pads and classic round lenses.",
    images: [IMG.modern],
    purchasePrice: 170,
    sellingPrice: 410,
    stockQuantity: 7,
    minimumStock: 3,
    status: "active",
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-6",
    slug: "optic-care-kit",
    name: "Optic Care Kit",
    category: "Cleaning Products",
    brand: "LUMINA",
    sku: "LUM-AC-003",
    barcode: "8901001001006",
    description:
      "Microfiber cloth, anti-fog spray, and travel case — the daily ritual essentials.",
    images: [IMG.clean],
    purchasePrice: 12,
    sellingPrice: 49,
    stockQuantity: 55,
    minimumStock: 15,
    status: "active",
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "prod-7",
    slug: "velvet-case-accessory",
    name: "Velvet Hard Case",
    category: "Accessories",
    brand: "LUMINA",
    sku: "LUM-AC-011",
    description: "Soft-touch hard case with magnetic closure and microfiber lining.",
    images: [IMG.clean],
    purchasePrice: 8,
    sellingPrice: 39,
    stockQuantity: 2,
    minimumStock: 8,
    status: "active",
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
];

export const SEED_PROMOTIONS: Promotion[] = [
  {
    id: "promo-1",
    title: " complimentary Lens Upgrade",
    description:
      "Book a comprehensive eye exam this month and receive a complimentary anti-reflective coating.",
    discount: "Free AR Coating",
    couponCode: "CLEARVIEW",
    image: IMG.exam,
    startDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10),
    homepageVisible: true,
    priority: 1,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "promo-2",
    title: "Second Pair, Half Price",
    description: "Choose any second pair of frames at 50% off when you buy prescription lenses.",
    discount: "50% Off",
    couponCode: "SECOND50",
    image: IMG.frames,
    startDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    homepageVisible: true,
    priority: 2,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

export const SEED_REVIEWS: Review[] = [
  {
    id: "rev-1",
    name: "Elena M.",
    rating: 5,
    text: "The most refined optical experience I've had. Precise exam, beautiful frames, quiet luxury.",
    featured: true,
    image: "",
    createdAt: now(),
  },
  {
    id: "rev-2",
    name: "Daniel K.",
    rating: 5,
    text: "Booked online in minutes. Progressive lenses fitted perfectly — crystal clarity.",
    featured: true,
    createdAt: now(),
  },
  {
    id: "rev-3",
    name: "Sara A.",
    rating: 5,
    text: "Stunning curation and attentive styling. Felt like a private atelier, not a clinic.",
    featured: true,
    createdAt: now(),
  },
];

export const GALLERY_IMAGES = [
  IMG.store,
  IMG.frames,
  IMG.sun,
  IMG.exam,
  IMG.classic,
  IMG.modern,
];

function createSeedEyeExamAvailability(): EyeExamAvailability[] {
  const timestamp = now();
  const today = todayInJerusalem();
  const days: EyeExamAvailability[] = [];
  let offset = 1;
  while (days.length < 8 && offset < 28) {
    const date = addDaysIso(today, offset);
    offset += 1;
    const weekday = weekdayUtc(date);
    if (weekday === 6) continue; // Saturday closed by default
    const slots = buildDefaultSlots(DEFAULT_SETTINGS.appointmentSlotMinutes).map(
      (slot) => {
        const minutes =
          Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3));
        // Seed a practical clinic window; admin can expand later.
        const enabled = minutes >= 9 * 60 && minutes <= 18 * 60;
        return { ...slot, isEnabled: enabled };
      }
    );
    days.push({
      id: newId("exa"),
      date,
      isOpen: true,
      slots,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return days;
}

export function createSeedData(): AppData {
  const timestamp = now();
  return {
    version: 2,
    products: SEED_PRODUCTS,
    appointments: [],
    customers: [],
    staff: SEED_STAFF,
    suppliers: [
      {
        id: "sup-1",
        name: "Atelier Optical Supply",
        email: "orders@atelier-supply.com",
        phone: "+972-3-700-1000",
      },
      {
        id: "sup-2",
        name: "Horizon Lens Lab",
        email: "lab@horizonlens.com",
      },
    ],
    promotions: SEED_PROMOTIONS,
    media: GALLERY_IMAGES.map((url, i) => ({
      id: `media-${i + 1}`,
      url,
      type: "image" as const,
      alt: `LUMINA gallery ${i + 1}`,
      folder: "gallery" as const,
      createdAt: timestamp,
    })),
    reviews: SEED_REVIEWS,
    contactMessages: [],
    smsLogs: [],
    activityLogs: [],
    holidays: [],
    availability: SEED_STAFF.map((s) => ({
      staffId: s.id,
      workingHours: DEFAULT_SETTINGS.openingHours,
      unavailableDates: [],
    })),
    eyeExamAvailability: createSeedEyeExamAvailability(),
    eyeExamAppointments: [],
    settings: DEFAULT_SETTINGS,
    updatedAt: timestamp,
  };
}

export const SERVICES = [
  {
    key: "Eye Examination" as const,
    title: "Eye Examination",
    description: "Comprehensive vision testing with precision diagnostics.",
    image: IMG.exam,
    icon: "eye",
  },
  {
    key: "Prescription Glasses" as const,
    title: "Prescription Glasses",
    description: "Tailored lenses matched to frames that feel effortless.",
    image: IMG.classic,
    icon: "glasses",
  },
  {
    key: "Sunglasses Fitting" as const,
    title: "Sunglasses",
    description: "Polarized protection with a curated luxury silhouette.",
    image: IMG.sun,
    icon: "sun",
  },
  {
    key: "Contact Lenses" as const,
    title: "Contact Lenses",
    description: "Daily and monthly lenses fitted for comfort and clarity.",
    image: IMG.contacts,
    icon: "droplet",
  },
  {
    key: "Eyeglass Frames" as const,
    title: "Eyeglass Frames",
    description: "Acetate, titanium, and metal frames from our atelier edit.",
    image: IMG.frames,
    icon: "frame",
  },
  {
    key: "Vision Consultation" as const,
    title: "Vision Consultation",
    description: "Personal guidance for progressive, office, and sport vision.",
    image: IMG.store,
    icon: "spark",
  },
];
