export type UserRole = "admin" | "employee" | "receptionist";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rescheduled";

export type ProductCategory =
  | "Prescription Glasses"
  | "Sunglasses"
  | "Contact Lenses"
  | "Frames"
  | "Accessories"
  | "Cleaning Products";

/** Categories that can have an Admin-configured default/fallback image. */
export type CategoryDefaultImageKey = "Frames" | "Sunglasses" | "Contact Lenses";

export type CategoryDefaultImages = Partial<
  Record<CategoryDefaultImageKey, string>
>;

export type ProductStatus = "active" | "draft" | "archived" | "out_of_stock";

export type ServiceType =
  | "Eye Examination"
  | "Prescription Glasses"
  | "Sunglasses Fitting"
  | "Contact Lenses"
  | "Eyeglass Frames"
  | "Vision Consultation"
  | "Lens Fitting";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  title: string;
  bio?: string;
  image?: string;
  specialties: ServiceType[];
  active: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayHoursPeriod {
  open: string; // "09:00"
  close: string; // "13:30"
}

export interface WorkingHours {
  day: number; // 0=Sun ... 6=Sat
  open: string; // legacy / first period start
  close: string; // legacy / last period end
  closed?: boolean;
  /** Up to 3 non-overlapping periods; drives booking when present */
  periods?: DayHoursPeriod[];
}

/** One continuous working period on a calendar day (expanded to bookable slots). */
export interface WorkingPeriod {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  enabled: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  allDay: boolean;
}

export interface StaffAvailability {
  staffId: string;
  workingHours: WorkingHours[];
  unavailableDates: string[];
}

export interface Appointment {
  id: string;
  service: ServiceType;
  staffId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  manageToken: string;
  createdAt: string;
  updatedAt: string;
}

export type EyeExamAppointmentStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show";

/** Clinic slot booking types that share the eye-exam calendar system */
export type ClinicAppointmentType = string;

export interface BookingService {
  id: string;
  /** Stable slug used in URLs and stored on appointments (e.g. eye_exam) */
  key: string;
  name: LocalizedContent;
  description: LocalizedContent;
  icon: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EyeExamTimeSlot {
  id: string;
  time: string; // HH:mm Asia/Jerusalem wall clock
  isEnabled: boolean;
}

export interface EyeExamAvailability {
  id: string;
  date: string; // YYYY-MM-DD (business calendar date, Asia/Jerusalem)
  isOpen: boolean;
  slots: EyeExamTimeSlot[];
  /** Editable working periods for this date (UI). Expanded into slots for booking. */
  periods?: WorkingPeriod[];
  /**
   * When true, settings opening-hours sync will not overwrite this day.
   * Manual close/reopen, period edits, and copy create exceptions.
   */
  isException?: boolean;
  /**
   * Which services may book this day.
   * Undefined / empty / both types = shared slots (any booking blocks the time).
   * A single type = separate calendar day for that service only.
   */
  services?: ClinicAppointmentType[];
  createdAt: string;
  updatedAt: string;
}

export interface EyeExamAppointment {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  appointmentType: ClinicAppointmentType;
  status: EyeExamAppointmentStatus;
  language: "en" | "he" | "ar";
  /** Optional internal admin note (not shown to customers) */
  notes?: string;
  smsStatus: "queued" | "sent" | "failed" | "simulated" | "pending";
  smsError?: string;
  /** SHA-256 hex of the WhatsApp management token. Never store the raw token. */
  manageTokenHash?: string;
  manageTokenExpiresAt?: string;
  manageTokenRevokedAt?: string | null;
  /**
   * Admin-only silent manage-flow fixture. Never send WhatsApp/SMS.
   * Excluded from public availability and dashboard stats.
   */
  silentTest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  brand: string;
  frameType?: string;
  lensType?: string;
  /** e.g. Daily / Monthly — shown for contact lenses when provided */
  replacementSchedule?: string;
  /** Lenses per box — shown for contact lenses when provided */
  packageQuantity?: number;
  barcode?: string;
  sku: string;
  description: string;
  images: string[];
  purchasePrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minimumStock: number;
  supplierId?: string;
  status: ProductStatus;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export type PromotionScope =
  | "all"
  | "sunglasses"
  | "frames"
  | "specific";

export type DiscountType = "percentage" | "fixed";

export interface Promotion {
  id: string;
  title: string;
  description: string;
  /** Display badge text (e.g. "20%" or "₪50") — kept for backwards compatibility */
  discount: string;
  discountType?: DiscountType;
  discountValue?: number;
  scope?: PromotionScope;
  productIds?: string[];
  couponCode?: string;
  image?: string;
  startDate: string;
  endDate: string;
  homepageVisible: boolean;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video";
  alt?: string;
  folder: "gallery" | "hero" | "products" | "promotions" | "general";
  createdAt: string;
}

export interface Review {
  id: string;
  name: string;
  image?: string;
  rating: number;
  text: string;
  featured: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface SmsLog {
  id: string;
  to: string;
  body: string;
  type:
    | "appointment_confirmation"
    | "appointment_reminder"
    | "appointment_cancellation"
    | "appointment_rescheduled"
    | "custom";
  status: "queued" | "sent" | "failed" | "simulated";
  provider: string;
  appointmentId?: string;
  error?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  detail?: string;
  createdAt: string;
}

export interface LocalizedContent {
  en?: string;
  ar?: string;
  he?: string;
}

export interface BrandingColors {
  primaryAccent: string;
  secondaryAccent: string;
  gold: string;
  button: string;
  buttonHover: string;
  text: string;
  textSecondary: string;
  background: string;
  card: string;
  border: string;
}

export interface BrandingTypography {
  headingFont: string;
  bodyFont: string;
  /** 0.85 – 1.35 relative scale */
  fontScale: number;
}

export interface BrandingStoreNameStyle {
  color: string;
  fontWeight: number;
  letterSpacing: string;
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  goldGradient: boolean;
  glow: boolean;
  underline: boolean;
  showLogo: boolean;
}

export interface BrandingSettings {
  storeNameEn: string;
  storeNameAr: string;
  storeNameHe?: string;
  logo?: string;
  favicon?: string;
  colors: BrandingColors;
  typography: BrandingTypography;
  storeNameStyle: BrandingStoreNameStyle;
}

export type BookingMessageProvider = "twilio" | "meta" | "console";

export type CustomerConfirmationMode = "original" | "new";

export interface BookingMessagesSettings {
  provider: BookingMessageProvider;
  customerConfirmation: {
    enabled: boolean;
    templateName: string;
    body: string;
    /**
     * original = existing working confirmation (no manage CTA).
     * new = approved HE/AR manage templates. Missing defaults to original.
     */
    confirmationMode?: CustomerConfirmationMode;
    /** Pending Twilio CTA template. Off until Meta approval. */
    manageTemplateName?: string;
    manageTemplateEnabled?: boolean;
    /** Twilio Content SID (HX…). Configured after Meta approval; never hardcode secrets. */
    manageTemplateContentSid?: string;
  };
  ownerNotification: {
    enabled: boolean;
    ownerWhatsApp: string;
    templateName: string;
    body: string;
    /** Temporary owner test destination. Never overwrites ownerWhatsApp. */
    testDestinationEnabled?: boolean;
    testWhatsApp?: string;
  };
  appointmentReminder: {
    enabled: boolean;
    minutesBefore: number;
    templateName: string;
    body: string;
  };
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logo?: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  whatsapp: string;
  googleMapsEmbedUrl: string;
  googleMapsLink: string;
  openingHours: WorkingHours[];
  social: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
  /** Optional homepage / hero overrides (leave blank to use built-in translations) */
  content?: {
    heroTitle?: LocalizedContent;
    heroLine?: LocalizedContent;
    brandSuffix?: LocalizedContent;
  };
  /** Admin-editable brand, colors, typography (no code changes needed) */
  branding?: BrandingSettings;
  smtp: {
    host?: string;
    port?: number;
    user?: string;
    from?: string;
  };
  sms: {
    provider: "twilio" | "messagebird" | "custom" | "console";
    fromNumber?: string;
    enabled: boolean;
  };
  bookingMessages: BookingMessagesSettings;
  appointmentSlotMinutes: number;
  bookingLeadDays: number;
  currency: string;
  currencySymbol: string;
  /** Optional per-admin display name overrides (account settings) */
  adminDisplayNames?: Record<string, string>;
  /** Fallback product photos by category when a product has no images of its own. */
  categoryDefaultImages?: CategoryDefaultImages;
  /** Owner-editable Homepage / Eye Exam / Contact Lenses page copy. */
  servicePages?: ServicePagesSettings;
}

export interface ServicePageFeature {
  title: string;
  description: string;
  /** Whitelisted Lucide icon id from lib/service-page-icons. */
  icon?: string;
}

export interface EyeExamServicePage {
  eyebrow: string;
  title: string;
  description: string;
  bookingButtonText: string;
  features: ServicePageFeature[];
  benefitsTitle: string;
  benefits: string[];
  /** Shared hero override. Empty/undefined keeps the built-in default media. */
  heroMedia?: CustomPageMediaRef | null;
}

export interface ContactLensesServicePage {
  eyebrow: string;
  title: string;
  description: string;
  bookingButtonText: string;
  features: ServicePageFeature[];
  warningTitle?: string;
  warningText: string;
  /** Shared hero override. Empty/undefined keeps the built-in default media. */
  heroMedia?: CustomPageMediaRef | null;
}

export interface CatalogServicePage {
  title?: string;
  lead?: string;
  /**
   * Catalog `/shop` is image-only. Sunglasses and Frames also accept video.
   * Empty/undefined keeps the built-in default media.
   */
  heroMedia?: CustomPageMediaRef | null;
}

/** Sunglasses `/sunglasses` and Frames `/frames` editorial copy. Stored independently. */
export type CategoryCatalogServicePage = CatalogServicePage;

export interface HomepageHeroContent {
  title: string;
  /** Optional dedicated subtitle. Empty means the public page joins serviceLabels. */
  subtitle?: string;
  serviceLabels: string[];
  bookingButtonText: string;
  shopButtonText: string;
}

export interface HomepageServicePage {
  hero: HomepageHeroContent;
}

export interface FooterServiceContent {
  tagline: string;
  hoursLabel: string;
  locationLabel: string;
  address: string;
}

export type ServicePagesLocale = "ar" | "he" | "en";

/** One language's editable Homepage / Eye Exam / Contact Lenses / Footer / Catalog copy. */
export interface ServicePagesLocaleBundle {
  eyeExam: EyeExamServicePage;
  contactLenses: ContactLensesServicePage;
  homepage?: HomepageServicePage;
  footer?: FooterServiceContent;
  catalog?: CatalogServicePage;
  sunglasses?: CategoryCatalogServicePage;
  frames?: CategoryCatalogServicePage;
  /**
   * Admin accordion labels keyed by stable section id.
   * Never rendered on the public website.
   */
  adminSectionNames?: Record<string, string>;
}

export const CUSTOM_SECTION_TYPES = [
  "heroMedia",
  "featureGrid",
  "benefitsList",
  "notice",
  "valuesStrip",
  "bookingCta",
  "gallery",
  "products",
] as const;

export const CUSTOM_CTA_KINDS = [
  "booking",
  "book",
  "internal",
  "external",
] as const;

export type CustomPageCtaKind = (typeof CUSTOM_CTA_KINDS)[number];

export type CustomSectionType = (typeof CUSTOM_SECTION_TYPES)[number];

export const CUSTOM_ARTICLE_ALIGNS = ["right", "center", "left"] as const;
export const CUSTOM_ARTICLE_POSITIONS = ["before", "after"] as const;

export type CustomArticleAlign = (typeof CUSTOM_ARTICLE_ALIGNS)[number];
export type CustomArticlePosition = (typeof CUSTOM_ARTICLE_POSITIONS)[number];

export interface CustomSectionArticleCopy {
  heading: string;
  body: string;
}

/** Optional article belonging to one custom-page section. Shared align/position. */
export interface CustomSectionArticle {
  align: CustomArticleAlign;
  position: CustomArticlePosition;
  locales?: Partial<Record<ServicePagesLocale, CustomSectionArticleCopy>>;
}

/** Gallery stays in CUSTOM_SECTION_TYPES for existing pages but cannot be added. */
export const ADDABLE_CUSTOM_SECTION_TYPES = CUSTOM_SECTION_TYPES.filter(
  (type) => type !== "gallery",
) as Exclude<CustomSectionType, "gallery">[];

export type CustomPageTemplate = "eye-exam" | "contact-lenses";

export type CustomPageStatus = "draft" | "published";

export interface CustomPageSection {
  id: string;
  type: CustomSectionType;
  hidden?: boolean;
  /** Admin accordion name only. Never shown on the public website. */
  adminLabel?: string;
  /** Optional per-section article. Absent on existing pages. */
  article?: CustomSectionArticle;
}

export interface ImageFocalPoint {
  x: number;
  y: number;
  zoom: number;
}

export interface CustomPageMediaRef {
  kind: "image" | "video";
  url: string;
  mediaId?: string;
  desktopUrl?: string;
  mobileUrl?: string;
  desktopFocal?: ImageFocalPoint;
  mobileFocal?: ImageFocalPoint;
  fit?: "cover" | "contain";
}

/** Per-language copy. `complete` is computed on save; never trust the client flag. */
export interface CustomPageCopy {
  complete: boolean;
  eyebrow: string;
  title: string;
  description: string;
  bookingButtonText: string;
  features: ServicePageFeature[];
  benefitsTitle: string;
  benefits: string[];
  warningTitle: string;
  warningText: string;
  valuesTitle: string;
  valuesText: string;
  privacyText: string;
  homeTitle: string;
  homeSubtitle: string;
}

export interface CustomServicePage {
  id: string;
  slug: string;
  name: string;
  status: CustomPageStatus;
  template: CustomPageTemplate;
  showOnHome: boolean;
  homeSort: number;
  homeImage?: string;
  homeMedia?: CustomPageMediaRef;
  /** When true, the gold CTA is rendered inside the hero with no extra empty gap when off. */
  showHeroButton: boolean;
  /** How the page button navigates. Shared across languages. */
  ctaKind: CustomPageCtaKind;
  bookingType?: string | null;
  /** Internal path or external https URL, depending on `ctaKind`. */
  ctaHref?: string;
  sections: CustomPageSection[];
  heroMedia?: CustomPageMediaRef;
  gallery?: CustomPageMediaRef[];
  /** Catalog product ids shown on this page. Removing an id does not delete the product. */
  productIds?: string[];
  locales: Partial<Record<ServicePagesLocale, CustomPageCopy>>;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export type CustomPageOp =
  | {
      op: "create";
      name: string;
      slug: string;
      /** Kept for stored-page compatibility. New pages no longer pick a category. */
      template?: CustomPageTemplate;
    }
  | {
      op: "update";
      id: string;
      expectedRevision: number;
      name?: string;
      slug?: string;
      status?: CustomPageStatus;
      showOnHome?: boolean;
      homeSort?: number;
      homeImage?: string | null;
      homeMedia?: CustomPageMediaRef | null;
      showHeroButton?: boolean;
      ctaKind?: CustomPageCtaKind;
      bookingType?: string | null;
      ctaHref?: string | null;
      sections?: CustomPageSection[];
      heroMedia?: CustomPageMediaRef | null;
      gallery?: CustomPageMediaRef[];
      productIds?: string[];
      locale?: ServicePagesLocale;
      copy?: CustomPageCopy;
    }
  | {
      op: "delete";
      id: string;
      expectedRevision: number;
    };

/**
 * Site copy. Legacy root fields are Arabic (backward compatible).
 * Per-language edits live in `locales` and are saved independently.
 * Owner-created pages live in `customPages` (additive).
 */
export interface ServicePagesSettings extends ServicePagesLocaleBundle {
  locales?: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>>;
  customPages?: CustomServicePage[];
  customPageOp?: CustomPageOp;
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type LensInventorySign = "minus" | "plus";

export interface LensInventoryCell {
  type: LensInventorySign;
  sph: string;
  cyl: string;
  currentStock: number;
  desiredStock: number;
  updatedAt: string;
}

export interface AppData {
  version: number;
  products: Product[];
  appointments: Appointment[];
  customers: Customer[];
  staff: StaffMember[];
  suppliers: Supplier[];
  promotions: Promotion[];
  media: MediaItem[];
  reviews: Review[];
  contactMessages: ContactMessage[];
  smsLogs: SmsLog[];
  activityLogs: ActivityLog[];
  holidays: Holiday[];
  availability: StaffAvailability[];
  eyeExamAvailability: EyeExamAvailability[];
  eyeExamAppointments: EyeExamAppointment[];
  /**
   * Legacy unused field. Preview fixtures live in a dedicated lumina_store
   * row. Production silent tests are flagged rows inside `eyeExamAppointments`.
   */
  previewManageTestAppointments?: EyeExamAppointment[];
  bookingServices: BookingService[];
  lensInventory: LensInventoryCell[];
  settings: StoreSettings;
  updatedAt: string;
}

export interface DashboardRecentBooking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  service: string;
  appointmentType: ClinicAppointmentType | string;
  date: string;
  dateLabel: string;
  startTime: string;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  inventoryItems: number;
  lowStockAlerts: number;
  totalCustomers: number;
  recentBookings: DashboardRecentBooking[];
  appointmentsByDay: { date: string; dateLabel: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}
