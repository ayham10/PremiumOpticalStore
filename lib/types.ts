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
  appointmentSlotMinutes: number;
  bookingLeadDays: number;
  currency: string;
  currencySymbol: string;
  /** Optional per-admin display name overrides (account settings) */
  adminDisplayNames?: Record<string, string>;
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  bookingServices: BookingService[];
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
