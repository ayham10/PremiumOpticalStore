export type Dictionary = {
  nav: Record<string, string>;
  hero: Record<string, string>;
  intro: Record<string, string>;
  home: {
    hubEyebrow: string;
    scrollHint: string;
    bookAppointment: string;
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
  product: {
    shop: string;
    outOfStock: string;
    inStore: string;
    frame: string;
    lens: string;
    sku: string;
    availability: string;
    bookConsultation: string;
    whatsapp: string;
    related: string;
    relatedSunglasses: string;
    relatedContactLenses: string;
    frameShape: string;
    lensType: string;
    polarized: string;
    uvProtection: string;
    material: string;
    colour: string;
    replacementSchedule: string;
    quantity: string;
    lensesUnit: string;
    bookContactLensFitting: string;
    previous: string;
    next: string;
    attrs: Record<string, string>;
    descriptions: Record<string, string>;
  };
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
  eyeExam: {
    eyebrow: string;
    title: string;
    description: string;
    bookCta: string;
    servicesCta: string;
    videoAlt: string;
    blurb: string;
    trust: {
      aria: string;
      professional: string;
      equipment: string;
      booking: string;
    };
    next: {
      label: string;
      cta: string;
      empty: string;
    };
    info: {
      aria: string;
      whatsapp: string;
      whatsappValue: string;
      hours: string;
      hoursValue: string;
      hoursNote: string;
      location: string;
      locationCity: string;
      locationStreet: string;
    };
    privacy: string;
    weekdays: Record<string, string>;
    formTitle: string;
    fields: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      date: string;
      time: string;
      confirm: string;
    };
    emptyDates: string;
    emptyTimes: string;
    pickDateFirst: string;
    selectedSummary: string;
    submitting: string;
    successTitle: string;
    successLead: string;
    errorLoad: string;
    errorSubmit: string;
    errors: {
      dateRequired: string;
      timeRequired: string;
    };
  };
  contactLenses: {
    eyebrow: string;
    title: string;
    description: string;
    bookCta: string;
    catalogueTitle: string;
    safety: string;
    info: {
      aria: string;
      fittingTitle: string;
      fittingText: string;
      optionsTitle: string;
      optionsText: string;
      supportTitle: string;
      supportText: string;
    };
    booking: {
      formTitle: string;
      formSubtitle: string;
      details: string;
      date: string;
      time: string;
      selected: string;
      confirm: string;
      successTitle: string;
      successLead: string;
    };
    appointmentType: string;
  };
  clinicBooking: {
    title: string;
    lead: string;
    progress: string;
    askService: string;
    selectDate: string;
    selectTime: string;
    yourDetails: string;
    changeService: string;
    changeDate: string;
    changeTime: string;
    continueReview: string;
    reviewTitle: string;
    reviewService: string;
    reviewDate: string;
    reviewTime: string;
    reviewCustomer: string;
    confirm: string;
    submitting: string;
    successTitle: string;
    successLead: string;
    backHome: string;
    emptyDates: string;
    emptyTimes: string;
    errorLoad: string;
    errorSubmit: string;
    prevMonth: string;
    nextMonth: string;
    periods: { morning: string; afternoon: string; evening: string };
    services: Record<string, string>;
    serviceHints: Record<string, string>;
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
    book: "Book",
    gallery: "Gallery",
    about: "About",
    contact: "Contact",
    admin: "Admin",
    bookCta: "Book an Appointment",
    menu: "Menu",
    close: "Close",
    language: "Language",
  },
  hero: {
    brand: "Oyon",
    brandSuffix: "OPTICAL",
    title: "SEE LIFE IN FOCUS",
    line1: "Premium Eyewear.",
    line2: "Advanced Eye Care.",
    line3: "Perfect Vision.",
    line4: "Everyday.",
    ctaBook: "Book an Appointment",
    ctaShop: "Shop Collection",
  },
  intro: {
    optical: "OPTICAL",
    tagline: "SEE LIFE IN FOCUS",
  },
  home: {
    hubEyebrow: "Premium Navigation",
    scrollHint: "Scroll",
    bookAppointment: "Book an Appointment",
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
    visitTitle: "Find Oyon",
    visitHours: "Hours",
    gateway: {
      frames: {
        title: "Premium Frames",
        subtitle: "Luxury prescription frames",
        cta: "Shop Now",
      },
      exams: {
        title: "Eye Exam",
        subtitle: "Professional eye examination",
        cta: "Book Now",
      },
      sunglasses: {
        title: "Sunglasses",
        subtitle: "Luxury sunglasses for every day",
        cta: "Shop Now",
      },
      contacts: {
        title: "Contact Lenses",
        subtitle: "Comfort and crystal-clear vision",
        cta: "Learn More",
      },
      promotions: {
        title: "Special Offers",
        subtitle: "Latest offers and discounts",
        cta: "View Offers",
      },
      booking: {
        title: "Book an Appointment",
        subtitle: "Meet with our optical specialists",
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
      title: "Eye Exam",
      lead: "Book a professional eye examination with our specialists.",
      body: "Book a professional eye examination with our specialists. Choose an available date and time that suits you.",
      highlights: [
        { title: "Professional care", text: "Examinations with clear recommendations." },
        { title: "Flexible scheduling", text: "Choose an available date and time that suits you." },
        { title: "Easy booking", text: "Confirm your visit online in minutes." },
      ],
      primaryCta: "Book Eye Exam",
      secondaryCta: "View All Services",
    },
    sunglasses: {
      eyebrow: "Sun Collection",
      title: "Sunglasses",
      lead: "Discover premium sunglasses designed for protection, comfort and effortless style.",
      body: "Discover premium sunglasses designed for protection, comfort and effortless style.",
      highlights: [
        { title: "Polarized clarity", text: "Reduce glare for driving, coastline light, and city brightness." },
        { title: "Prescription options", text: "Many styles can be prepared with your prescription." },
        { title: "Travel ready", text: "Lightweight builds and durable finishes for daily wear." },
      ],
      primaryCta: "Shop sunglasses",
      secondaryCta: "Book consultation",
    },
    contacts: {
      eyebrow: "Contact Lens Care",
      title: "Contact Lenses",
      lead: "Find comfortable contact lenses suited to your vision, lifestyle and daily routine.",
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
      body: "Explore current Oyon promotions. Offers change with the season — book early or visit the boutique for the latest pairs and exam packages.",
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
      "Explore prescription frames, sunglasses, contact lenses, and daily essentials from the Oyon edit.",
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
    bookConsultation: "Book Consultation",
    whatsapp: "WhatsApp inquire",
    related: "Related pieces",
    relatedSunglasses: "Related sunglasses",
    relatedContactLenses: "Related Contact Lenses",
    frameShape: "Frame shape",
    lensType: "Lens type",
    polarized: "Polarized",
    uvProtection: "UV protection",
    material: "Material",
    colour: "Colour",
    replacementSchedule: "Replacement schedule",
    quantity: "Quantity",
    lensesUnit: "lenses",
    bookContactLensFitting: "Book Contact Lens Fitting",
    previous: "Previous products",
    next: "Next products",
    attrs: {
      Rectangle: "Rectangle",
      Round: "Round",
      Square: "Square",
      Oval: "Oval",
      Aviator: "Aviator",
      "Prescription Ready": "Prescription Ready",
      "Blue-light / Progressive": "Blue-light / Progressive",
      "Polarized UV400": "Polarized UV400",
      "Daily Disposable": "Daily lenses",
      Daily: "Daily",
      Monthly: "Monthly",
      Polarized: "Polarized",
      "UV400": "UV400",
      Acetate: "Acetate",
      Metal: "Metal",
      Titanium: "Titanium",
      Black: "Black",
      Gold: "Gold",
      Tortoise: "Tortoise",
      Champagne: "Champagne",
    },
    descriptions: {
      "aurelia-acetate-frame":
        "Hand-polished Italian acetate with sculpted temples and a quiet champagne finish.",
      "nordic-titanium-rim":
        "Featherweight titanium for all-day clarity. Engineered for progressive lenses.",
      "solstice-polarized":
        "Mirror-grade polarized lenses with a brushed metal silhouette for bright days.",
      "clarity-daily-lenses":
        "Breathable daily lenses with hydration support for effortless all-day wear.",
      "atelier-slim-metal":
        "Minimal metal architecture with soft bevel edges and adjustable pads.",
      "noir-acetate-square":
        "Deep black acetate with softened corners and a matte temple finish.",
      "coastal-clear-rim":
        "Translucent crystal acetate with subtle coastal-blue accents.",
      "lineage-gold-wire":
        "Fine gold-tone wire with adjustable nose pads and classic round lenses.",
      "optic-care-kit":
        "Microfiber cloth, anti-fog spray, and travel case — the daily ritual essentials.",
      "velvet-case-accessory":
        "Soft-touch hard case with magnetic closure and microfiber lining.",
      "eclipse-black-aviator":
        "Matte black aviators with polarized lenses for sharp contrast in bright light.",
      "dune-acetate-wayfarer":
        "Warm tortoise acetate with soft square lines and all-day UV protection.",
      "marina-gold-rim":
        "Slim gold-tone rims with gradient lenses for coastal light and city glare.",
      "noir-mirror-square":
        "Bold square silhouette with mirror lenses and a quiet luxury finish.",
      "acuvue-oasys-1-day":
        "Daily disposable contact lenses from ACUVUE OASYS for comfortable everyday wear.",
      "dailies-total1":
        "Premium daily disposable contact lenses from DAILIES TOTAL1 for all-day comfort.",
    },
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
  eyeExam: {
    eyebrow: "Clinical Care",
    title: "Eye Exam",
    description:
      "Book a professional eye examination with our specialists. Choose an available date and time that suits you.",
    bookCta: "Book Eye Exam",
    servicesCta: "View All Services",
    videoAlt: "Patient receiving a professional eye examination",
    blurb:
      "A complete vision and eye-health assessment followed by a personalized recommendation for glasses or contact lenses.",
    trust: {
      aria: "Why choose Oyon",
      professional: "Professional Eye Exam",
      equipment: "Modern Diagnostic Equipment",
      booking: "Fast & Easy Booking",
    },
    next: {
      label: "Next available appointment",
      cta: "View available appointments",
      empty: "No open slots right now",
    },
    info: {
      aria: "Visit details",
      whatsapp: "WhatsApp",
      whatsappValue: "052-1234567",
      hours: "Opening Hours",
      hoursValue: "08:30 – 21:00",
      hoursNote: "Every day",
      location: "Location",
      locationCity: "Deir Hanna",
      locationStreet: "Main Street",
    },
    privacy: "Your privacy matters. Your information is secure.",
    weekdays: {
      "0": "Sunday",
      "1": "Monday",
      "2": "Tuesday",
      "3": "Wednesday",
      "4": "Thursday",
      "5": "Friday",
      "6": "Saturday",
    },
    formTitle: "Book Eye Exam",
    fields: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone number",
      date: "Select date",
      time: "Select time",
      confirm: "Confirm booking",
    },
    emptyDates: "No available dates at the moment. Please check back soon.",
    emptyTimes: "No available times for this date.",
    pickDateFirst: "Select a date to see available times.",
    selectedSummary: "Selected: {date} at {time}",
    submitting: "Confirming…",
    successTitle: "Your eye exam has been booked successfully.",
    successLead: "We look forward to seeing you.",
    errorLoad: "Unable to load availability. Please try again.",
    errorSubmit: "Unable to complete booking. Please try again.",
    errors: {
      dateRequired: "Please select a date",
      timeRequired: "Please select a time",
    },
  },
  contactLenses: {
    eyebrow: "Contact Lens Care",
    title: "Contact Lenses",
    description:
      "Find comfortable contact lenses suited to your vision, lifestyle and daily routine.",
    bookCta: "Book Contact Lens Fitting",
    catalogueTitle: "Contact Lens Collection",
    safety:
      "Contact lenses should be fitted professionally. Do not wear lenses longer than recommended, and stop using them if you experience pain, redness or unusual discomfort.",
    info: {
      aria: "Contact lens care highlights",
      fittingTitle: "Professional fitting",
      fittingText: "Correct measurements and lens selection for your eyes.",
      optionsTitle: "Daily or monthly options",
      optionsText: "Choose the replacement schedule that suits your lifestyle.",
      supportTitle: "Follow-up support",
      supportText: "Receive guidance on comfort, care and safe use.",
    },
    booking: {
      formTitle: "Book Contact Lens Fitting",
      formSubtitle: "Choose a date and time for your fitting appointment.",
      details: "Your details",
      date: "Select date",
      time: "Select time",
      selected: "Selected appointment: {date} at {time}",
      confirm: "Confirm booking",
      successTitle: "Your contact lens fitting has been booked successfully.",
      successLead: "We look forward to seeing you.",
    },
    appointmentType: "Contact Lens Fitting",
  },
  clinicBooking: {
    title: "Book an Appointment",
    lead: "Choose your service, pick a date and time, then confirm your visit.",
    progress: "Booking progress",
    askService: "What would you like to book?",
    selectDate: "Select a date",
    selectTime: "Select a time",
    yourDetails: "Your details",
    changeService: "Change service",
    changeDate: "Change date",
    changeTime: "Change time",
    continueReview: "Continue to review",
    reviewTitle: "Review your appointment",
    reviewService: "Service",
    reviewDate: "Date",
    reviewTime: "Time",
    reviewCustomer: "Customer details",
    confirm: "Confirm booking",
    submitting: "Confirming…",
    successTitle: "Your appointment is confirmed.",
    successLead: "We look forward to seeing you at Oyon.",
    backHome: "Back to home",
    emptyDates: "No available dates at the moment. Please check back soon.",
    emptyTimes: "No available times for this date.",
    errorLoad: "Unable to load availability. Please try again.",
    errorSubmit: "Unable to complete booking. Please try again.",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    periods: {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
    },
    services: {
      eye_exam: "Eye Exam",
      contact_lens_fitting: "Contact Lens Fitting",
      frame_consultation: "Frame Consultation",
      sunglasses_consultation: "Sunglasses Consultation",
    },
    serviceHints: {
      eye_exam: "Professional vision examination",
      contact_lens_fitting: "Fitting and guidance for contacts",
      frame_consultation: "Help choosing the right frames",
      sunglasses_consultation: "Style and sun protection advice",
    },
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
      "Oyon is an optical atelier devoted to clinical accuracy and beautiful eyewear — never rushed, never ordinary.",
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
    copyright: "© {year} Oyon Optical.",
    short: "Precision vision. Quiet luxury.",
  },
  common: {
    loading: "Loading…",
    retry: "Retry",
    back: "Back",
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
    brand: "Oyon Admin",
    logout: "Logout",
    loginTitle: "Staff sign in",
    loginLead: "Secure access to appointments, inventory, and store settings.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    demoHint: "Demo: admin@oyon.optics / oyon2024",
    sidebar: {
      dashboard: "Dashboard",
      appointments: "Appointments",
      eyeExam: "Clinic Bookings",
      calendar: "Calendar",
      customers: "Customers",
      inventory: "Inventory",
      promotions: "Promotions",
      media: "Media",
      staff: "Staff",
      website: "Website",
      branding: "Branding",
      settings: "Store Settings",
      groupAppointments: "Appointments",
      groupCatalogue: "Catalogue",
      groupSystem: "System",
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
