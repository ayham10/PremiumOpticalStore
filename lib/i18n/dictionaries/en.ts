export type Dictionary = {
  nav: Record<string, string>;
  hero: Record<string, string>;
  intro: Record<string, string>;
  home: {
    hubEyebrow: string;
    scrollHint: string;
    bookAppointment: string;
    shopNow: string;
    welcomeLine: string;
    heroBrandLine: string;
    brandsTitle: string;
    featureCards: Record<string, { title: string; text: string }>;
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
    filterFrames: string;
    wishlist: string;
    sortLabel: string;
    sortNewest: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    categories: Record<string, string>;
  };
  offersPage: {
    title: string;
    lead: string;
    limitedTime: string;
    endsIn: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    shopOffer: string;
    activeOffers: string;
    offerProducts: string;
    newBadge: string;
    until: string;
    code: string;
    empty: string;
    trustTitle: string;
    trust: {
      shipping: string;
      authentic: string;
      returns: string;
      warranty: string;
    };
  };
  product: {
    shop: string;
    back: string;
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
    features: {
      aria: string;
      specialists: string;
      duration: string;
      equipment: string;
      comprehensive: string;
    };
    benefits: {
      title: string;
      items: string[];
    };
    values: {
      aria: string;
      precision: string;
      quality: string;
      care: string;
    };
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
    badges: {
      aria: string;
      specialists: string;
      privacy: string;
      accuracy: string;
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
    stepOf: string;
    next: string;
    askService: string;
    scheduleTitle: string;
    selectDate: string;
    selectTime: string;
    yourDetails: string;
    countryCode: string;
    phonePlaceholder: string;
    whatsappFooter: string;
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
  about: {
    eyebrow: string;
    title: string;
    lead: string;
    statement: string;
    storyTitle: string;
    story: string;
    closingTitle: string;
    closingLead: string;
    features: Record<string, { title: string; text: string }>;
    ctaBook: string;
    ctaShop: string;
  };
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
    bookings: Record<string, string>;
    availability: Record<string, string>;
    settings: Record<string, string>;
    common: Record<string, string>;
  };
  days: Record<string, string>;
};

const en: Dictionary = {
  nav: {
    home: "Home",
    services: "Services",
    exam: "Eye Exam",
    frames: "Prescription Frames",
    sunglasses: "Sunglasses",
    shop: "Store",
    book: "Book",
    gallery: "Gallery",
    about: "About Us",
    contact: "Contact",
    admin: "Admin",
    bookCta: "Book an Appointment",
    menu: "Menu",
    close: "Close",
    language: "Language",
  },
  hero: {
    brand: "OYON",
    brandSuffix: "",
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
    scrollHint: "Explore More",
    bookAppointment: "Book an Appointment",
    shopNow: "Shop Now",
    welcomeLine: "Prescription Frames • Sunglasses • Professional Eye Exam",
    heroBrandLine: "OYON",
    brandsTitle: "Leading International Brands",
    featureCards: {
      exam: {
        title: "Professional Eye Exam",
        text: "Comprehensive, precise examinations with advanced optical technology.",
      },
      frames: {
        title: "Prescription Frames",
        text: "Elegant design and lasting quality tailored to your style.",
      },
      brands: {
        title: "Premium Brands",
        text: "The latest models from the world's most luxurious eyewear houses.",
      },
    },
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
        title: "Prescription Frames",
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
    eyebrow: "Store",
    title: "Store",
    lead: "Discover our luxury collection",
    search: "Search by name, brand, or SKU…",
    empty: "No products match your filters.",
    view: "View",
    all: "All",
    filterFrames: "Prescription Frames",
    wishlist: "Save to wishlist",
    sortLabel: "Sort",
    sortNewest: "Newest",
    sortPriceAsc: "Price: Low to High",
    sortPriceDesc: "Price: High to Low",
    categories: {
      "Prescription Glasses": "Prescription Glasses",
      Sunglasses: "Sunglasses",
      "Contact Lenses": "Contact Lenses",
      Frames: "Frames",
      Accessories: "Accessories",
      "Cleaning Products": "Cleaning Products",
    },
  },
  offersPage: {
    title: "Promotions",
    lead: "Discover limited-time offers on selected eyewear",
    limitedTime: "Limited time",
    endsIn: "Offer ends in",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    shopOffer: "Shop the offer now",
    activeOffers: "Active offers",
    offerProducts: "Offer products",
    newBadge: "New",
    until: "Until",
    code: "Code",
    empty: "No active promotions right now.",
    trustTitle: "Why shop with Oyon",
    trust: {
      shipping: "Fast shipping nationwide",
      authentic: "100% authentic products",
      returns: "Easy returns within 14 days",
      warranty: "12-month warranty",
    },
  },
  product: {
    shop: "Shop",
    back: "Go back",
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
      doctor: "Specialist",
      date: "Date",
      time: "Time",
      details: "Details",
    },
    chooseService: "Choose a service",
    chooseDoctor: "Choose a time that works for you",
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
    eyebrow: "Professional Care",
    title: "Comprehensive Eye Exam",
    description:
      "Accurate examination with the latest devices and certified specialists for clearer vision and a better life.",
    bookCta: "Book Eye Exam",
    servicesCta: "View All Services",
    videoAlt: "Patient receiving a professional eye examination",
    blurb:
      "A complete vision and eye-health assessment followed by a personalized recommendation for glasses or contact lenses.",
    features: {
      aria: "Exam highlights",
      specialists: "Certified specialists",
      duration: "Only 20–30 minutes",
      equipment: "Modern, precise devices",
      comprehensive: "Full vision assessment",
    },
    benefits: {
      title: "What makes our eye exam different",
      items: [
        "Visual acuity measured for each eye separately.",
        "Eye pressure check for early glaucoma detection.",
        "Retina and optic nerve health evaluation.",
        "Eye coordination and muscle movement assessment.",
        "Clear guidance on glasses or contact lenses when needed.",
      ],
    },
    values: {
      aria: "Care standards",
      precision: "High precision results",
      quality: "Global quality standards",
      care: "Personal care for every client",
    },
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
    badges: {
      aria: "Trust assurances",
      specialists: "Certified specialists · trusted experience",
      privacy: "Full privacy · your data is secure",
      accuracy: "Accurate results · modern devices",
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
    lead: "Choose your service, then pick a time and share your details.",
    progress: "Booking progress",
    stepOf: "Step {current} of {total}",
    next: "Next",
    askService: "Select a service",
    scheduleTitle: "Choose a time and enter your details",
    selectDate: "Select a date",
    selectTime: "Select a time",
    yourDetails: "Your details",
    countryCode: "Country code",
    phonePlaceholder: "05X-XXXXXXX",
    whatsappFooter: "Contact us on WhatsApp",
    changeService: "Change service",
    changeDate: "Change date",
    changeTime: "Change time",
    continueReview: "Continue to review",
    reviewTitle: "Review your appointment",
    reviewService: "Service",
    reviewDate: "Date",
    reviewTime: "Time",
    reviewCustomer: "Customer details",
    confirm: "Book Appointment",
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
    eyebrow: "About Us",
    title: "A premium optical boutique",
    lead: "Authentic brands. Advanced eye testing. Personal guidance.",
    statement:
      "OYON is a luxury optical destination dedicated to clearer vision, refined style, and an elevated in-store experience.",
    storyTitle: "Our Approach",
    story:
      "We combine advanced eye-testing technology with carefully curated frames and lenses — then guide each guest with honest, personal recommendations.",
    closingTitle: "Clarity, crafted with care",
    closingLead:
      "From authentic premium brands to precision fittings, every detail is chosen for lasting quality and quiet confidence.",
    features: {
      precision: {
        title: "Precision",
        text: "Advanced eye-testing technology for clear, reliable results.",
      },
      quality: {
        title: "Premium Quality",
        text: "Quality frames and lenses selected for comfort and longevity.",
      },
      selection: {
        title: "Luxury Selection",
        text: "Authentic premium brands and the latest eyewear collections.",
      },
      service: {
        title: "Personal Service",
        text: "Honest, personalized guidance for every visit.",
      },
    },
    ctaBook: "Book an Appointment",
    ctaShop: "Browse the Store",
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
    tagline: "Clearer vision. Purer style. A luxury experience.",
    visit: "Visit",
    explore: "Explore",
    copyright: "© {year} OYON Optical",
    short: "Clearer vision. Purer style.",
    hours: "Hours",
    hoursValue: "08:30 – 21:00",
    phone: "Phone",
    location: "Location",
    city: "Deir Hanna",
    showLocation: "Show location",
    maps: "Maps",
    waze: "Waze",
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
      dashboard: "Home",
      appointments: "Bookings",
      eyeExam: "Bookings",
      availability: "Working Hours",
      calendar: "Calendar",
      customers: "Customers",
      inventory: "Products",
      products: "Products",
      promotions: "Offers",
      media: "Library",
      staff: "Team",
      website: "Website",
      branding: "Branding",
      settings: "Settings",
      groupAppointments: "Appointments",
      groupCatalogue: "Catalogue",
      groupSystem: "System",
      adminLabel: "Admin",
      loading: "Loading admin…",
    },
    dashboard: {
      title: "Home",
      welcome: "Home",
      overview: "Overview",
      description: "Today's schedule, customers, and stock at a glance.",
      refresh: "Refresh",
      newAppointment: "New Appointment",
      viewAll: "View all",
      today: "Today's Appointments",
      todayHint: "View schedule",
      week: "This week",
      upcoming: "Upcoming",
      inventory: "Inventory items",
      lowStock: "Low Stock",
      lowStockHint: "View products",
      customers: "Customers",
      recent: "Recent Bookings",
      chart: "Appointments this week",
      quickActions: "Quick Actions",
      emptyToday: "No appointments today",
      emptyTodayLead: "Your schedule is clear. Add a booking or adjust availability.",
      manageAvailability: "Manage Working Hours",
      products: "Products",
      offers: "Offers",
      loadError: "Unable to load dashboard",
      justNow: "Just now",
      minutesAgo: "{n}m ago",
      todayAt: "Today, {time}",
      statusPending: "Pending",
      statusConfirmed: "Confirmed",
      statusCompleted: "Completed",
      statusCancelled: "Cancelled",
      statusNoShow: "No show",
    },
    bookings: {
      title: "Bookings",
      description: "View and manage all bookings easily",
      searchPlaceholder: "Search by customer name...",
      filterStatus: "Status",
      filterService: "Service",
      filterDate: "Date",
      allStatuses: "All statuses",
      allServices: "All services",
      moreFilters: "More",
      refresh: "Refresh",
      newBooking: "New Appointment",
      edit: "Edit",
      cancel: "Cancel",
      noResults: "No bookings found",
      colWhen: "Date & time",
      colClient: "Client",
      colPhone: "Phone",
      colService: "Service",
      colNotes: "Notes",
      colStatus: "Status",
      colActions: "Actions",
      statusPending: "Pending",
      statusConfirmed: "Confirmed",
      statusCompleted: "Completed",
      statusCancelled: "Cancelled",
      statusNoShow: "No show",
      editTitle: "Edit appointment",
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      service: "Service",
      date: "Date",
      time: "Time",
      selectTime: "Select time",
      status: "Status",
      close: "Close",
      save: "Save changes",
      saving: "Saving…",
      updated: "Appointment updated",
      saved: "Appointment saved",
      created: "Booking created",
      loadError: "Failed to load",
      updateError: "Update failed",
    },
    availability: {
      title: "Working Hours",
      description: "Manage available dates and booking time slots",
      refresh: "Refresh",
      addSlot: "Add available time",
      addDate: "Add available date",
      guide: "Select a date, then manage services and slots",
      today: "Today",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      legendOpen: "Open",
      legendBookings: "Bookings",
      legendClosed: "Closed",
      legendSelected: "Selected",
      legendAvailable: "Available",
      legendBooked: "Booked",
      legendUnavailable: "Unavailable",
      noDate: "No date selected",
      noDateLead: "Pick a date on the calendar, or add a new available date.",
      selectedDate: "Selected date",
      open: "Open",
      closed: "Closed",
      services: "Services",
      selectAllShared: "Select all (shared)",
      available: "Available",
      booked: "Booked",
      unavailable: "Unavailable",
      more: "More",
      markClosed: "Mark day as closed",
      markOpen: "Open day for booking",
      copySchedule: "Copy from another day",
      copyPrevious: "Copy from another day",
      addTime: "Add time",
      addNew: "Add new",
      saveChanges: "Save changes",
      previewSite: "Site preview",
      calendarTitle: "Calendar",
      availableTimes: "Available times",
      dayOpenBanner: "This day is open for booking",
      dayOpenLead: "Customers can book the times listed below.",
      dayClosedBanner: "This day is closed",
      dayClosedLead: "Open the day to allow customers to book.",
      slotTip: "Click any time to edit it or change its status.",
      legendLimited: "Limited",
      timeLabel: "Time",
      enableAll: "Enable all default slots",
      disableAll: "Disable all slots",
      deleteDate: "Delete date",
      dateAdded: "Availability date added",
      updated: "Availability updated",
      dateRemoved: "Date removed",
      addFailed: "Failed to add date",
      deleteConfirm: "Disable/delete this date? Active bookings block deletion.",
      deleteFailed: "Delete failed",
      shared: "shared",
      servicesCount: "{n} services",
      availableCount: "{n} available",
      bookedCount: "{n} booked",
      timeSlots: "Time slots",
      sharedLead: "Shared availability — all services use the same slots.",
      separateLead: "Separate services — only selected services can book this date.",
      copyFromOptional: "Copy schedule from (optional)",
      defaultSlots: "Default slots",
      copyFrom: "Copy from",
      copyTo: "Copy to",
      selectExistingDate: "Select existing date",
      copyOverwrite: "This overwrites services, time slots, and open/closed state on the selected date.",
      confirm: "Confirm",
      confirmCopy: "Confirm copy",
      bookedSlotTitle: "Booked slot",
      bookedSlotHint:
        "This slot cannot be disabled or deleted while a booking exists. Manage the booking from Appointments.",
      gotIt: "Got it",
      customerBooking: "Customer booking",
      dateActions: "Date actions",
      overwriteConfirm: "Overwrite schedule for {target} with {source}?",
    },
    settings: {
      title: "Settings",
      description:
        "Manage store settings, appearance, communication, bookings, and more.",
      preview: "Site preview",
      save: "Save changes",
      saving: "Saving…",
      saved: "Settings saved",
      loadError: "Failed to load settings",
      saveError: "Save failed",
      loading: "Loading settings…",
      tabGeneral: "General",
      tabSocial: "Social",
      tabContact: "Contact",
      tabHours: "Working hours",
      tabBooking: "Booking",
      tabSeo: "SEO",
      identity: "Store identity",
      storeNameEn: "Store name (English)",
      storeNameAr: "Store name (Arabic)",
      storeNameHe: "Store name (Hebrew)",
      logoUrl: "Logo URL",
      storeLogo: "Store logo",
      faviconUrl: "Site icon (Favicon)",
      tagline: "Short description (Tagline)",
      changeLogo: "Change logo",
      changeFavicon: "Change icon",
      colors: "Colors",
      primaryColor: "Primary",
      secondaryColor: "Secondary",
      textColor: "Text",
      backgroundColor: "Background",
      storeInfo: "Store information",
      phone: "Phone",
      whatsapp: "WhatsApp",
      email: "Email",
      city: "City",
      address: "Address",
      currency: "Currency",
      currencyIls: "Israeli Shekel",
      mapsLink: "Google Maps link",
      mapsEmbed: "Google Maps embed URL",
      hours: "Working hours",
      day: "Day",
      from: "From",
      to: "To",
      isOpen: "Open",
      closedLabel: "Closed",
      social: "Social networks",
      seoTitle: "Title",
      seoDescription: "Description",
      seoKeywords: "Keywords",
      homepageContent: "Homepage content",
      homepageHint: "Leave blank to keep the built-in translation.",
      heroTitle: "Hero title",
      heroLine: "Hero supporting line",
      brandSuffix: "Brand suffix",
      bookingSms: "Booking & SMS",
      slotMinutes: "Slot minutes",
      leadDays: "Booking lead days",
      smsProvider: "SMS provider",
      smsFrom: "SMS from number",
      smsEnabled: "SMS notifications enabled",
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
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  },
};

export default en;
