/**
 * Project Data Seeder
 * Creates realistic Philippine resort projects with proper configuration
 */

import type { Project, ProjectMembership } from "@/types/common";
import { ProjectType, ProjectStatus, ProjectRole } from "@/types/common";
import { DEFAULT_PROJECT_CONFIG } from "../schema";
import { testUsers } from "./users";

export const projectSeeds: Project[] = [
  // Main Okaeri Resort
  {
    id: "project_okaeri_001",
    name: "Okaeri Beach Resort",
    slug: "okaeri-beach-resort",
    description:
      "Premium beachfront resort in Boracay Station 2, offering luxury accommodations with Filipino hospitality and modern amenities.",
    type: ProjectType.RESORT,
    status: ProjectStatus.ACTIVE,
    ownerId: testUsers.owner.id,
    config: {
      ...DEFAULT_PROJECT_CONFIG,
      currency: "PHP",
      timezone: "Asia/Manila",
      locale: "en-PH",
      fiscalYearStart: "01-01",
      features: {
        bookings: true,
        expenses: true,
        reports: true,
        analytics: true,
        googleSheets: true,
        csvImport: true,
        apiAccess: true,
      },
      limits: {
        maxProperties: 25,
        maxBookings: 2000,
        maxUsers: 15,
        maxFileStorage: 1000, // 1GB
      },
      customFields: {
        businessPermitNumber: "BP-2024-001",
        dtiRegistration: "DTI-20240001",
        birTinNumber: "123-456-789-000",
        dohAccreditation: "DOH-ACC-2024-001",
        tourismpermit: "DOT-PHP-2024-001",
        addressDetails: {
          street: "Station 2, White Beach",
          barangay: "Balabag",
          municipality: "Malay",
          province: "Aklan",
          region: "Western Visayas",
          zipCode: "5608",
        },
        contactInfo: {
          landline: "+63-36-288-1234",
          mobile: "+63-917-123-4567",
          fax: "+63-36-288-1235",
          website: "https://okaeriresort.ph",
          facebook: "OkaeriBeachResort",
          instagram: "@okaeriresort",
        },
        operationalDetails: {
          checkInTime: "15:00",
          checkOutTime: "12:00",
          businessHours: "24/7",
          seasonalRates: true,
          peakSeason: ["December", "January", "April", "May"],
          lowSeason: ["June", "July", "August", "September"],
        },
      },
    },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-15T10:30:00.000Z",
  },

  // Sister Property in Palawan
  {
    id: "project_okaeri_002",
    name: "Okaeri Island Retreat",
    slug: "okaeri-island-retreat",
    description:
      "Eco-luxury island retreat in El Nido, Palawan, focusing on sustainable tourism and pristine natural beauty.",
    type: ProjectType.RESORT,
    status: ProjectStatus.ACTIVE,
    ownerId: testUsers.owner.id,
    config: {
      ...DEFAULT_PROJECT_CONFIG,
      currency: "PHP",
      timezone: "Asia/Manila",
      locale: "en-PH",
      fiscalYearStart: "01-01",
      features: {
        bookings: true,
        expenses: true,
        reports: true,
        analytics: false, // Limited analytics for smaller property
        googleSheets: false,
        csvImport: true,
        apiAccess: false,
      },
      limits: {
        maxProperties: 10,
        maxBookings: 500,
        maxUsers: 8,
        maxFileStorage: 500, // 500MB
      },
      customFields: {
        businessPermitNumber: "BP-2024-002",
        dtiRegistration: "DTI-20240002",
        birTinNumber: "123-456-789-001",
        dohAccreditation: "DOH-ACC-2024-002",
        tourismpermit: "DOT-PHP-2024-002",
        addressDetails: {
          street: "Bacuit Bay",
          barangay: "Corong-Corong",
          municipality: "El Nido",
          province: "Palawan",
          region: "MIMAROPA",
          zipCode: "5313",
        },
        contactInfo: {
          mobile: "+63-917-123-4568",
          website: "https://okaeriisland.ph",
          facebook: "OkaeriIslandRetreat",
          instagram: "@okaeriisland",
        },
        operationalDetails: {
          checkInTime: "14:00",
          checkOutTime: "11:00",
          businessHours: "06:00-22:00",
          seasonalRates: true,
          peakSeason: ["December", "January", "March", "April"],
          lowSeason: ["June", "July", "August", "September", "October"],
        },
      },
    },
    createdAt: "2024-01-05T00:00:00.000Z",
    updatedAt: "2024-01-15T14:20:00.000Z",
  },

  // Urban Hotel in Manila
  {
    id: "project_okaeri_003",
    name: "Okaeri City Hotel",
    slug: "okaeri-city-hotel",
    description:
      "Modern business hotel in Makati CBD, catering to corporate travelers and urban tourists.",
    type: ProjectType.HOTEL,
    status: ProjectStatus.ACTIVE,
    ownerId: testUsers.owner.id,
    config: {
      ...DEFAULT_PROJECT_CONFIG,
      currency: "PHP",
      timezone: "Asia/Manila",
      locale: "en-PH",
      fiscalYearStart: "01-01",
      features: {
        bookings: true,
        expenses: true,
        reports: true,
        analytics: true,
        googleSheets: true,
        csvImport: true,
        apiAccess: true,
      },
      limits: {
        maxProperties: 50,
        maxBookings: 3000,
        maxUsers: 20,
        maxFileStorage: 2000, // 2GB
      },
      customFields: {
        businessPermitNumber: "BP-2024-003",
        dtiRegistration: "DTI-20240003",
        birTinNumber: "123-456-789-002",
        dohAccreditation: "DOH-ACC-2024-003",
        tourismpermit: "DOT-PHP-2024-003",
        addressDetails: {
          street: "Ayala Avenue",
          barangay: "Poblacion",
          municipality: "Makati City",
          province: "Metro Manila",
          region: "National Capital Region",
          zipCode: "1200",
        },
        contactInfo: {
          landline: "+63-2-8123-4567",
          mobile: "+63-917-123-4569",
          fax: "+63-2-8123-4568",
          website: "https://okaeriticity.ph",
          facebook: "OkaeriCityHotel",
          instagram: "@okaeritcity",
          linkedin: "okaeri-city-hotel",
        },
        operationalDetails: {
          checkInTime: "15:00",
          checkOutTime: "12:00",
          businessHours: "24/7",
          seasonalRates: false, // Urban hotels typically have consistent rates
          corporateRates: true,
          meetingRooms: 5,
          conferenceCapacity: 200,
        },
      },
    },
    createdAt: "2024-01-10T00:00:00.000Z",
    updatedAt: "2024-01-15T16:45:00.000Z",
  },

  // Test/Demo Project
  {
    id: "project_demo_001",
    name: "Demo Resort",
    slug: "demo-resort",
    description: "Demo project for testing and training purposes.",
    type: ProjectType.RESORT,
    status: ProjectStatus.TRIAL,
    ownerId: testUsers.manager.id, // Managed by Juan Dela Cruz
    config: {
      ...DEFAULT_PROJECT_CONFIG,
      features: {
        bookings: true,
        expenses: false, // Limited features for demo
        reports: false,
        analytics: false,
        googleSheets: false,
        csvImport: false,
        apiAccess: false,
      },
      limits: {
        maxProperties: 5,
        maxBookings: 50,
        maxUsers: 3,
        maxFileStorage: 100, // 100MB
      },
    },
    createdAt: "2024-01-12T00:00:00.000Z",
    updatedAt: "2024-01-15T09:15:00.000Z",
  },
];

export const projectMembershipSeeds: ProjectMembership[] = [
  // Okaeri Beach Resort memberships
  {
    id: "membership_001",
    projectId: projectSeeds[0].id, // Okaeri Beach Resort
    userId: testUsers.owner.id,
    role: ProjectRole.OWNER,
    permissions: [
      { resource: "*", actions: ["*"] }, // All permissions
    ],
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "membership_002",
    projectId: projectSeeds[0].id,
    userId: testUsers.manager.id,
    role: ProjectRole.ADMIN,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update", "delete"] },
      { resource: "expenses", actions: ["create", "read", "update", "approve"] },
      { resource: "reports", actions: ["read", "export"] },
      { resource: "users", actions: ["read", "update"] },
    ],
    joinedAt: "2024-01-02T00:00:00.000Z",
  },
  {
    id: "membership_003",
    projectId: projectSeeds[0].id,
    userId: testUsers.assistantManager.id,
    role: ProjectRole.MANAGER,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update"] },
      { resource: "expenses", actions: ["create", "read"] },
      { resource: "reports", actions: ["read"] },
    ],
    joinedAt: "2024-01-08T00:00:00.000Z",
  },
  {
    id: "membership_004",
    projectId: projectSeeds[0].id,
    userId: testUsers.frontDesk.id,
    role: ProjectRole.MEMBER,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update"] },
      { resource: "guests", actions: ["create", "read", "update"] },
    ],
    joinedAt: "2024-01-03T00:00:00.000Z",
  },
  {
    id: "membership_005",
    projectId: projectSeeds[0].id,
    userId: testUsers.finance.id,
    role: ProjectRole.MEMBER,
    permissions: [
      { resource: "expenses", actions: ["create", "read", "update"] },
      { resource: "reports", actions: ["read", "export"] },
      { resource: "bookings", actions: ["read"] },
    ],
    joinedAt: "2024-01-06T00:00:00.000Z",
  },
  {
    id: "membership_006",
    projectId: projectSeeds[0].id,
    userId: testUsers.housekeeping.id,
    role: ProjectRole.MEMBER,
    permissions: [
      { resource: "bookings", actions: ["read"] },
      { resource: "properties", actions: ["read", "update"] },
    ],
    joinedAt: "2024-01-05T00:00:00.000Z",
  },
  {
    id: "membership_007",
    projectId: projectSeeds[0].id,
    userId: testUsers.guestRelations.id,
    role: ProjectRole.MEMBER,
    permissions: [
      { resource: "bookings", actions: ["read", "update"] },
      { resource: "guests", actions: ["create", "read", "update"] },
    ],
    joinedAt: "2024-01-07T00:00:00.000Z",
  },
  {
    id: "membership_008",
    projectId: projectSeeds[0].id,
    userId: testUsers.viewer.id,
    role: ProjectRole.VIEWER,
    permissions: [
      { resource: "bookings", actions: ["read"] },
      { resource: "reports", actions: ["read"] },
    ],
    joinedAt: "2024-01-10T00:00:00.000Z",
  },

  // Okaeri Island Retreat memberships (smaller team)
  {
    id: "membership_009",
    projectId: projectSeeds[1].id, // Okaeri Island Retreat
    userId: testUsers.owner.id,
    role: ProjectRole.OWNER,
    permissions: [{ resource: "*", actions: ["*"] }],
    joinedAt: "2024-01-05T00:00:00.000Z",
  },
  {
    id: "membership_010",
    projectId: projectSeeds[1].id,
    userId: testUsers.assistantManager.id,
    role: ProjectRole.ADMIN,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update", "delete"] },
      { resource: "expenses", actions: ["create", "read", "update"] },
      { resource: "reports", actions: ["read"] },
    ],
    joinedAt: "2024-01-08T00:00:00.000Z",
  },
  {
    id: "membership_011",
    projectId: projectSeeds[1].id,
    userId: testUsers.operations.id,
    role: ProjectRole.MEMBER,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update"] },
      { resource: "properties", actions: ["read", "update"] },
    ],
    joinedAt: "2024-01-04T00:00:00.000Z",
  },

  // Okaeri City Hotel memberships (larger corporate team)
  {
    id: "membership_012",
    projectId: projectSeeds[2].id, // Okaeri City Hotel
    userId: testUsers.owner.id,
    role: ProjectRole.OWNER,
    permissions: [{ resource: "*", actions: ["*"] }],
    joinedAt: "2024-01-10T00:00:00.000Z",
  },
  {
    id: "membership_013",
    projectId: projectSeeds[2].id,
    userId: testUsers.manager.id,
    role: ProjectRole.ADMIN,
    permissions: [
      { resource: "bookings", actions: ["create", "read", "update", "delete"] },
      { resource: "expenses", actions: ["create", "read", "update", "approve"] },
      { resource: "reports", actions: ["read", "export"] },
      { resource: "users", actions: ["read", "update"] },
    ],
    joinedAt: "2024-01-10T00:00:00.000Z",
  },

  // Demo Resort memberships
  {
    id: "membership_014",
    projectId: projectSeeds[3].id, // Demo Resort
    userId: testUsers.manager.id,
    role: ProjectRole.OWNER,
    permissions: [{ resource: "*", actions: ["*"] }],
    joinedAt: "2024-01-12T00:00:00.000Z",
  },
];

/**
 * Quick access to specific projects for testing
 */
export const testProjects = {
  mainResort: projectSeeds[0], // Okaeri Beach Resort
  islandRetreat: projectSeeds[1], // Okaeri Island Retreat
  cityHotel: projectSeeds[2], // Okaeri City Hotel
  demo: projectSeeds[3], // Demo Resort
};
