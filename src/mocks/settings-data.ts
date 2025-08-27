/**
 * Mock data for settings pages
 * Centralized mock data for development and testing
 */

export const mockUserProfile = {
  name: "Juan Cruz",
  email: "juan.cruz@resort.ph",
  phone: "+639123456789",
  avatar: null,
};

export const mockLoginSessions = [
  {
    id: "1",
    device: "Chrome on Windows",
    location: "Manila, Philippines",
    lastActive: "2 minutes ago",
    current: true,
  },
  {
    id: "2",
    device: "Safari on iPhone",
    location: "Cebu, Philippines",
    lastActive: "1 hour ago",
    current: false,
  },
  {
    id: "3",
    device: "Chrome on Android",
    location: "Davao, Philippines",
    lastActive: "2 days ago",
    current: false,
  },
];

export const mockProjectData = {
  resortInfo: {
    name: "Okaeri Beach Resort",
    description:
      "A beautiful beachfront resort offering relaxation and adventure in the heart of the Philippines",
    address: {
      street: "123 Sunset Boulevard",
      barangay: "Barangay Malawak",
      city: "Boracay",
      province: "Aklan",
      zipCode: "5608",
    },
    contactNumbers: ["+639123456789"],
    email: "info@okaeriresort.ph",
    website: "https://okaeriresort.ph",
    socialMedia: {
      facebook: "@okaeriresort",
      instagram: "@okaeriresort",
      twitter: "",
      youtube: "",
    },
  },
  businessConfig: {
    businessName: "Okaeri Beach Resort Inc.",
    tin: "123-456-789-000",
    businessPermitNumber: "BP2024-001234",
    vatRegistered: true,
    currency: "PHP",
  },
  bookingPolicies: {
    checkInTime: "15:00",
    checkOutTime: "12:00",
    advanceBookingDays: 90,
    minimumStayNights: 1,
    cancellationPolicyHours: 24,
    depositPercentage: 50,
    lateCheckoutFee: 500,
  },
  paymentMethods: {
    cash: true,
    gcash: {
      enabled: true,
      merchantNumber: "09123456789",
    },
    bankTransfer: {
      enabled: true,
      bankName: "BDO Unibank",
      accountName: "Okaeri Beach Resort Inc.",
      accountNumber: "1234567890",
    },
    creditCard: {
      enabled: false,
    },
    defaultPaymentMethod: "cash" as const,
  },
  roomAmenities: {
    roomTypes: [
      {
        name: "Standard Room",
        baseRate: 3500,
        maxGuests: 2,
        description: "Comfortable room with sea view",
      },
      {
        name: "Deluxe Room",
        baseRate: 5000,
        maxGuests: 3,
        description: "Spacious room with balcony",
      },
      {
        name: "Family Suite",
        baseRate: 8000,
        maxGuests: 4,
        description: "Large suite perfect for families",
      },
    ],
    amenities: {
      wifi: true,
      parking: true,
      pool: true,
      restaurant: true,
      spa: true,
      gym: false,
      beachAccess: true,
      laundry: true,
      conferenceRoom: false,
      petFriendly: false,
    },
  },
};

export const mockDefaultPreferences = {
  notifications: {
    email: true,
    sms: true,
    push: true,
    bookings: true,
    payments: true,
    reports: false,
  },
  theme: "system" as const,
  timezone: "Asia/Manila",
  language: "en" as const,
  dateFormat: "MM/DD/YYYY" as const,
};
