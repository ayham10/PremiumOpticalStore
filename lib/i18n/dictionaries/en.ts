export type Dictionary = {
  nav: Record<string, string>;
  hero: Record<string, string>;
  intro: Record<string, string>;
  home: {
    hubEyebrow: string;
    scrollHint: string;
    welcomeLine: string;
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
  destinations: Record<
    string,
    {
      eyebrow: string;
      title: string;
      lead: string;
      body: string;
      highlights: Array<{ title: string; text: string }>;
      primaryCta: string;
      secondaryCta: string;
    }
  >;
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
    home: "Home",
    services: "Services",
    exam: "Eye Exam",
    shop: "Shop",
    book: "Book Exam",
    gallery: "Gallery",
    about: "About",
    contact: "Contact",
    admin: "Admin",
    bookCta: "Book Exam",
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
    hubEyebrow: "Premium Navigation",
    scrollHint: "Scroll",
    welcomeLine: "Premium Eyewear • Eye Examinations • Sunglasses",
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
        subtitle: "Explore our collection",
        cta: "Shop Now",
      },
      exams: {
        title: "Eye Exams",
        subtitle: "Professional Eye Care & Vision Testing",
        cta: "Book Now",
      },
      sunglasses: {
        title: "Sunglasses",
        subtitle: "Timeless style",
        cta: "Shop Now",
      },
      contacts: {
        title: "Contact Lenses",
        subtitle: "Comfort • Daily & Monthly Lenses • Crystal Clear Vision",
        cta: "Learn More",
      },
      promotions: {
        title: "Promotions",
        subtitle: "Special offers",
        cta: "View Offers",
      },
      booking: {
        title: "Book Appointment",
        subtitle: "Schedule your visit",
        cta: "Book Now",
      },
      contact: {
        title: "Contact",
        subtitle: "Visit & Reach Us",
        cta: "Get Directions",
      },
      about: {
        title: "About",
        subtitle: "Our Atelier",
        cta: "Our Story",
      },
      shop: {
        title: "Shop",
        subtitle: "Full Collection",
        cta: "Browse Shop",
      },
    },
  },
  destinations: {
    frames: {
      eyebrow: "Eyewear",
      title: "Premium Frames",
      lead: "Curated silhouettes in acetate, titanium, and metal — fitted with quiet precision.",
      body: "Explore frames selected for balance, comfort, and lasting craft. Every piece can be paired with prescription lenses shaped to your vision and daily rhythm.",
      highlights: [
        { title: "Personal fitting", text: "Face shape, bridge fit, and everyday comfort — measured with care." },
        { title: "Prescription ready", text: "Single vision, progressive, and blue-filter options available in-store." },
        { title: "Quiet luxury", text: "An edited collection — never overcrowded, always considered." },
      ],
      primaryCta: "Shop frames",
      secondaryCta: "Book a fitting",
    },
    exams: {
      eyebrow: "Clinical Care",
      title: "Eye Exams",
      lead: "Unhurried examinations with modern diagnostics and clear recommendations.",
      body: "Book a comprehensive eye exam with our specialists. We assess vision clarity, eye health, and the lenses that will serve you best — without rushing the appointment.",
      highlights: [
        { title: "Full diagnostics", text: "Precise refraction and eye-health screening in a calm clinical setting." },
        { title: "Specialist guidance", text: "Leave with a clear plan for glasses, contacts, or follow-up care." },
        { title: "Easy booking", text: "Choose your doctor, date, and time online in minutes." },
      ],
      primaryCta: "Book eye exam",
      secondaryCta: "View all services",
    },
    sunglasses: {
      eyebrow: "Sun Collection",
      title: "Sunglasses",
      lead: "Polarized protection and refined design for bright days and travel.",
      body: "Discover sunglasses that protect and elevate — polarized lenses, UV coverage, and frames that feel as considered as your everyday eyewear.",
      highlights: [
        { title: "Polarized clarity", text: "Reduce glare for driving, coastline light, and city brightness." },
        { title: "Prescription options", text: "Many styles can be prepared with your prescription." },
        { title: "Travel ready", text: "Lightweight builds and durable finishes for daily wear." },
      ],
      primaryCta: "Shop sunglasses",
      secondaryCta: "Book consultation",
    },
    contacts: {
      eyebrow: "Lenses",
      title: "Contact Lenses",
      lead: "Daily and monthly lenses fitted for comfort, clarity, and eye health.",
      body: "Whether you prefer dailies or longer-wear options, we help you find lenses that feel natural — with guidance on care, fit, and when glasses remain the better choice.",
      highlights: [
        { title: "Comfort first", text: "Trial fittings and brand guidance tailored to your eyes." },
        { title: "Daily or monthly", text: "Flexible options for lifestyle, travel, and sensitivity." },
        { title: "Clinical support", text: "Follow-ups available if comfort or clarity needs adjusting." },
      ],
      primaryCta: "Explore lenses",
      secondaryCta: "Book contact fitting",
    },
    promotions: {
      eyebrow: "Offers",
      title: "Promotions",
      lead: "Limited seasonal offers on exams, frames, and complete pairs.",
      body: "Explore current LUMINA promotions. Offers change with the season — book early or visit the boutique for the latest pairs and exam packages.",
      highlights: [
        { title: "Seasonal value", text: "Thoughtful packages without compromising clinical quality." },
        { title: "Complete pairs", text: "Look for frame + lens offers when available." },
        { title: "Easy next step", text: "Book online or message us to reserve your visit." },
      ],
      primaryCta: "Book now",
      secondaryCta: "Contact us",
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
