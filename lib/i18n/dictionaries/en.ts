export type Dictionary = {
  nav: Record<string, string>;
  hero: Record<string, string>;
  intro: Record<string, string>;
  home: {
    categoriesEyebrow: string;
    categoriesTitle: string;
    categoriesLead: string;
    cards: Record<string, { title: string; subtitle: string; cta: string }>;
    featuredEyebrow: string;
    featuredTitle: string;
    featuredLead: string;
    featuredCta: string;
    offersEyebrow: string;
    offersTitle: string;
    offersCta: string;
    testimonialsEyebrow: string;
    testimonialsTitle: string;
    visitEyebrow: string;
    visitTitle: string;
    visitHours: string;
    gateway: Record<string, { title: string; subtitle: string; cta: string }>;
  };
  servicesPage: {
    eyebrow: string;
    title: string;
    lead: string;
    bookCta: string;
    items: Record<string, { title: string; description: string }>;
  };
  shop: {
    eyebrow: string;
    title: string;
    lead: string;
    search: string;
    empty: string;
    view: string;
    all: string;
    categories: Record<string, string>;
  };
  product: Record<string, string>;
  book: {
    eyebrow: string;
    title: string;
    lead: string;
    loading: string;
    steps: Record<string, string>;
    chooseService: string;
    chooseDoctor: string;
    chooseDate: string;
    chooseTime: string;
    yourDetails: string;
    continue: string;
    back: string;
    confirm: string;
    submitting: string;
    noSlots: string;
    fields: Record<string, string>;
    successTitle: string;
    successLead: string;
    manageBooking: string;
    bookAnother: string;
    when: string;
    specialist: string;
    errorLoad: string;
    errorSubmit: string;
    required: string;
  };
  manage: Record<string, string>;
  contact: Record<string, string>;
  about: Record<string, string>;
  gallery: Record<string, string>;
  footer: Record<string, string>;
  common: Record<string, string>;
  validation: Record<string, string>;
  admin: {
    brand: string;
    logout: string;
    loginTitle: string;
    loginLead: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
    demoHint: string;
    sidebar: Record<string, string>;
    dashboard: Record<string, string>;
    common: Record<string, string>;
  };
  days: Record<string, string>;
};

const en: Dictionary = {
  nav: {
    services: "Services",
    shop: "Shop",
    book: "Book Exam",
    gallery: "Gallery",
    about: "About",
    contact: "Contact",
    admin: "Admin",
    bookCta: "Book Eye Exam",
    menu: "Menu",
    close: "Close",
    language: "Language",
  },
  hero: {
    brand: "LUMINA",
    title: "SEE LIFE IN FOCUS",
    line1: "Premium Eyewear.",
    line2: "Advanced Eye Care.",
    line3: "Perfect Vision.",
    line4: "Everyday.",
    ctaBook: "Book Eye Exam",
    ctaShop: "Shop Collection",
  },
  intro: {
    optical: "OPTICAL",
    tagline: "SEE LIFE IN FOCUS",
  },
  home: {
    categoriesEyebrow: "Explore",
    categoriesTitle: "Everything your vision needs",
    categoriesLead:
      "From precision eye exams to curated frames and lenses — discover care and style in one place.",
    cards: {
      eyewear: {
        title: "Premium Eyewear",
        subtitle: "Luxury Frames",
        cta: "Shop Now",
      },
      exam: {
        title: "Eye Examination",
        subtitle: "Clinical Precision",
        cta: "Book Appointment",
      },
      contacts: {
        title: "Contact Lenses",
        subtitle: "Comfort & Clarity",
        cta: "Explore",
      },
      sunglasses: {
        title: "Sunglasses",
        subtitle: "Polarized Protection",
        cta: "View Collection",
      },
      kids: {
        title: "Kids Vision",
        subtitle: "Gentle Care",
        cta: "Learn More",
      },
      care: {
        title: "Eye Care Services",
        subtitle: "Full Optical Care",
        cta: "See Services",
      },
    },
    featuredEyebrow: "Collection",
    featuredTitle: "Featured frames & lenses",
    featuredLead: "An edited selection of prescription-ready pieces and daily essentials.",
    featuredCta: "View all",
    offersEyebrow: "Offers",
    offersTitle: "Current promotions",
    offersCta: "Book now",
    testimonialsEyebrow: "Reviews",
    testimonialsTitle: "Trusted by our patients",
    visitEyebrow: "Visit",
    visitTitle: "Find LUMINA",
    visitHours: "Hours",
    gateway: {
      frames: {
        title: "Premium Frames",
        subtitle: "Luxury Eyewear",
        cta: "Shop Frames",
      },
      exams: {
        title: "Eye Exams",
        subtitle: "Clinical Precision",
        cta: "Book Appointment",
      },
      sunglasses: {
        title: "Sunglasses",
        subtitle: "Polarized Protection",
        cta: "View Collection",
      },
      contacts: {
        title: "Contact Lenses",
        subtitle: "Comfort & Clarity",
        cta: "Explore Lenses",
      },
      promotions: {
        title: "Promotions",
        subtitle: "Limited Offers",
        cta: "See Offers",
      },
      booking: {
        title: "Book Appointment",
        subtitle: "Your Visit",
        cta: "Start Booking",
      },
      contact: {
        title: "Visit Us",
        subtitle: "Contact",
        cta: "Get Directions",
      },
    },
  },
  servicesPage: {
    eyebrow: "Services",
    title: "Professional eye care",
    lead:
      "Comprehensive examinations, precision fittings, and personal guidance for every stage of your vision journey.",
    bookCta: "Book this service",
    items: {
      "Eye Examination": {
        title: "Eye Exams",
        description:
          "Comprehensive vision testing with modern diagnostics and unhurried clinical attention.",
      },
      "Prescription Glasses": {
        title: "Prescription Glasses",
        description:
          "Tailored lenses matched to frames that feel effortless from morning to night.",
      },
      "Contact Lenses": {
        title: "Contact Lenses",
        description:
          "Daily and monthly lenses fitted for lasting comfort, clarity, and eye health.",
      },
      "Sunglasses Fitting": {
        title: "Sunglasses",
        description:
          "Polarized UV protection with curated silhouettes for bright days and travel.",
      },
      "Eyeglass Frames": {
        title: "Frames",
        description:
          "Acetate, titanium, and metal frames edited for silhouette, balance, and longevity.",
      },
      "Vision Consultation": {
        title: "Vision Consultation",
        description:
          "Personal guidance for progressive, office, sport, and specialty vision needs.",
      },
      "Kids Eye Exams": {
        title: "Kids Eye Exams",
        description:
          "Gentle pediatric assessments designed for clear learning and comfortable wear.",
      },
      "Repairs & Adjustments": {
        title: "Repairs & Adjustments",
        description:
          "Precision adjustments, temple tuning, and on-the-spot care for lasting comfort.",
      },
    },
  },
  shop: {
    eyebrow: "Shop",
    title: "Glasses & optical care",
    lead:
      "Explore prescription frames, sunglasses, contact lenses, and daily essentials from the LUMINA edit.",
    search: "Search frames, brands, SKU…",
    empty: "No products match your filters.",
    view: "View",
    all: "All",
    categories: {
      "Prescription Glasses": "Prescription Glasses",
      Sunglasses: "Sunglasses",
      "Contact Lenses": "Contact Lenses",
      Frames: "Frames",
      Accessories: "Accessories",
      "Cleaning Products": "Cleaning Products",
    },
  },
  product: {
    shop: "Shop",
    outOfStock: "Out of stock",
    inStore: "In store",
    frame: "Frame",
    lens: "Lens",
    sku: "SKU",
    availability: "Availability",
    bookConsultation: "Book consultation",
    whatsapp: "WhatsApp inquire",
    related: "Related pieces",
  },
  book: {
    eyebrow: "Appointments",
    title: "Book your visit",
    lead:
      "Reserve an eye exam or optical consultation in a few calm steps. Confirmations and easy rescheduling included.",
    loading: "Loading booking…",
    steps: {
      service: "Service",
      doctor: "Doctor",
      date: "Date",
      time: "Time",
      details: "Details",
    },
    chooseService: "Choose a service",
    chooseDoctor: "Choose your specialist",
    chooseDate: "Select a date",
    chooseTime: "Select a time",
    yourDetails: "Your details",
    continue: "Continue",
    back: "Back",
    confirm: "Confirm booking",
    submitting: "Booking…",
    noSlots: "No open times for this day. Try another date.",
    fields: {
      name: "Full name",
      phone: "Phone",
      email: "Email",
      notes: "Notes (optional)",
    },
    successTitle: "You’re booked",
    successLead: "We’ve reserved your appointment. Save your manage link to reschedule or cancel.",
    manageBooking: "Manage booking",
    bookAnother: "Book another",
    when: "When",
    specialist: "Specialist",
    errorLoad: "Unable to load booking options",
    errorSubmit: "Unable to complete booking",
    required: "Please complete all required fields",
  },
  manage: {
    eyebrow: "Appointments",
    title: "Manage your booking",
    lead: "Enter your booking code to view, reschedule, or cancel.",
    token: "Booking code",
    find: "Find booking",
    loading: "Loading…",
    notFound: "Booking not found",
    cancel: "Cancel booking",
    reschedule: "Reschedule",
    confirmCancel: "Cancel this appointment?",
    status: "Status",
    save: "Save changes",
  },
  contact: {
    eyebrow: "Contact",
    title: "We’re here to help",
    lead: "Ask about exams, frames, lenses, or visit us in store.",
    name: "Name",
    email: "Email",
    phone: "Phone",
    subject: "Subject",
    message: "Message",
    send: "Send message",
    sending: "Sending…",
    sent: "Message sent. We’ll reply shortly.",
    hours: "Opening hours",
    closed: "Closed",
    whatsapp: "Chat on WhatsApp",
    maps: "Open in Maps",
    bookCta: "Book Eye Exam",
  },
  about: {
    eyebrow: "About",
    title: "Precision vision. Quiet luxury.",
    lead:
      "LUMINA is an optical atelier devoted to clinical accuracy and beautiful eyewear — never rushed, never ordinary.",
    storyTitle: "Our approach",
    story:
      "Every visit balances thorough examination with considered styling. We measure carefully, explain clearly, and help you choose frames and lenses that feel inevitable.",
    craftTitle: "What we stand for",
    craft1: "Clinical precision without compromise",
    craft2: "Curated frames with lasting craftsmanship",
    craft3: "Personal fittings and honest guidance",
    teamTitle: "Meet the team",
    ctaBook: "Book an exam",
    ctaShop: "Browse frames",
  },
  gallery: {
    eyebrow: "Gallery",
    title: "Light, frames, atmosphere",
    lead: "A glimpse inside the atelier — fittings, finishes, and the quiet details of optical craft.",
    view: "View",
    previous: "Previous",
    next: "Next",
    close: "Close",
  },
  footer: {
    tagline:
      "Premium optical care — precise examinations, curated frames, and effortless appointments.",
    visit: "Visit",
    explore: "Explore",
    copyright: "© {year} LUMINA Optical.",
    short: "Precision vision. Quiet luxury.",
  },
  common: {
    loading: "Loading…",
    retry: "Retry",
    backHome: "Back home",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    search: "Search",
    actions: "Actions",
    yes: "Yes",
    no: "No",
    close: "Close",
    open: "Open",
    details: "Details",
    status: "Status",
    notes: "Notes",
    phone: "Phone",
    email: "Email",
    name: "Name",
    date: "Date",
    time: "Time",
    price: "Price",
    brand: "Brand",
    category: "Category",
  },
  validation: {
    required: "This field is required",
    email: "Enter a valid email address",
    phone: "Enter a valid phone number",
    generic: "Something went wrong. Please try again.",
  },
  admin: {
    brand: "LUMINA Admin",
    logout: "Logout",
    loginTitle: "Staff sign in",
    loginLead: "Secure access to appointments, inventory, and store settings.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    demoHint: "Demo: admin@lumina.optics / lumina2024",
    sidebar: {
      dashboard: "Dashboard",
      appointments: "Appointments",
      calendar: "Calendar",
      customers: "Customers",
      inventory: "Inventory",
      promotions: "Promotions",
      media: "Media",
      staff: "Staff",
      settings: "Settings",
    },
    dashboard: {
      title: "Dashboard",
      today: "Today’s appointments",
      week: "This week",
      inventory: "Inventory items",
      lowStock: "Low stock alerts",
      customers: "Total customers",
      recent: "Recent bookings",
      chart: "Appointments this week",
    },
    common: {
      add: "Add",
      create: "Create",
      update: "Update",
      duplicate: "Duplicate",
      filter: "Filter",
      allStatuses: "All statuses",
      print: "Print",
      sendSms: "Send SMS",
      reschedule: "Reschedule",
      noResults: "No results",
    },
  },
  days: {
    0: "Sun",
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
  },
};

export default en;
