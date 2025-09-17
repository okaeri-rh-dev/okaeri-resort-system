/**
 * Mock API Handler
 *
 * Intercepts API calls that don't have server implementations yet
 * and returns mock data to keep the frontend functional during development.
 */

import type { Project, Property, Booking, Expense, User, PaginatedResponse } from "@/types/common";

// Mock data generators
function generateMockProject(id: string): Project {
  return {
    id,
    name: `Resort Project ${id}`,
    description: "A beautiful resort in La Union, Philippines",
    currency: "PHP",
    timezone: "Asia/Manila",
    status: "active",
    members: [],
    properties: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateMockProperty(projectId: string, propertyId: string): Property {
  return {
    id: propertyId,
    projectId,
    name: `Property ${propertyId}`,
    type: "room",
    status: "available",
    capacity: 4,
    basePrice: 5000,
    description: "Comfortable room with ocean view",
    amenities: ["AC", "WiFi", "TV", "Mini Bar"],
    images: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateMockBooking(projectId: string, bookingId: string): Booking {
  return {
    id: bookingId,
    projectId,
    propertyId: "prop-1",
    bookingCode: `BK${bookingId.slice(0, 8).toUpperCase()}`,
    guestName: "Juan Dela Cruz",
    guestEmail: "juan@example.com",
    guestPhone: "+639123456789",
    checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    guests: 2,
    status: "confirmed",
    source: "direct",
    totalAmount: 15000,
    paidAmount: 15000,
    paymentMethod: "cash",
    paymentStatus: "paid",
    notes: "",
    specialRequests: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateMockExpense(projectId: string, expenseId: string): Expense {
  return {
    id: expenseId,
    projectId,
    category: "utilities",
    amount: 2500,
    description: "Electricity bill",
    date: new Date().toISOString(),
    vendor: "Meralco",
    status: "approved",
    paymentMethod: "bank_transfer",
    receiptUrl: "",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateMockDashboardStats(projectId: string) {
  return {
    totalBookings: 45,
    totalRevenue: 675000,
    occupancyRate: 78.5,
    averageRate: 5000,
    totalExpenses: 185000,
    netProfit: 490000,
    upcomingCheckIns: 3,
    upcomingCheckOuts: 2,
    currentGuests: 8,
  };
}

// Mock API responses
export class MockApiHandler {
  private static delay(ms: number = 300): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async handleRequest(method: string, endpoint: string, data?: any): Promise<any> {
    await this.delay();

    // Parse endpoint to extract IDs
    const pathParts = endpoint.split("/").filter(Boolean);

    // Projects endpoints
    if (endpoint === "/projects" && method === "GET") {
      return [
        generateMockProject("proj-1"),
        generateMockProject("proj-2"),
        generateMockProject("proj-3"),
      ];
    }

    if (endpoint.match(/^\/projects\/[^/]+$/) && method === "GET") {
      const projectId = pathParts[1];
      return generateMockProject(projectId);
    }

    if (endpoint === "/projects" && method === "POST") {
      return generateMockProject(`proj-${Date.now()}`);
    }

    // Properties endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/properties$/) && method === "GET") {
      const projectId = pathParts[1];
      return {
        items: [
          generateMockProperty(projectId, "prop-1"),
          generateMockProperty(projectId, "prop-2"),
          generateMockProperty(projectId, "prop-3"),
        ],
        total: 3,
        limit: 10,
        offset: 0,
      } as PaginatedResponse<Property>;
    }

    if (endpoint.match(/^\/projects\/[^/]+\/properties\/[^/]+$/) && method === "GET") {
      const projectId = pathParts[1];
      const propertyId = pathParts[3];
      return generateMockProperty(projectId, propertyId);
    }

    // Bookings endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/bookings$/) && method === "GET") {
      const projectId = pathParts[1];
      return {
        items: [
          generateMockBooking(projectId, "book-1"),
          generateMockBooking(projectId, "book-2"),
          generateMockBooking(projectId, "book-3"),
        ],
        total: 3,
        limit: 10,
        offset: 0,
      } as PaginatedResponse<Booking>;
    }

    if (endpoint.match(/^\/projects\/[^/]+\/bookings\/recent$/) && method === "GET") {
      const projectId = pathParts[1];
      return [generateMockBooking(projectId, "book-1"), generateMockBooking(projectId, "book-2")];
    }

    if (endpoint.match(/^\/projects\/[^/]+\/bookings\/[^/]+$/) && method === "GET") {
      const projectId = pathParts[1];
      const bookingId = pathParts[3];
      return generateMockBooking(projectId, bookingId);
    }

    if (endpoint.match(/^\/projects\/[^/]+\/bookings$/) && method === "POST") {
      const projectId = pathParts[1];
      return generateMockBooking(projectId, `book-${Date.now()}`);
    }

    // Expenses endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/expenses$/) && method === "GET") {
      const projectId = pathParts[1];
      return {
        items: [
          generateMockExpense(projectId, "exp-1"),
          generateMockExpense(projectId, "exp-2"),
          generateMockExpense(projectId, "exp-3"),
        ],
        total: 3,
        limit: 10,
        offset: 0,
      } as PaginatedResponse<Expense>;
    }

    if (endpoint.match(/^\/projects\/[^/]+\/expenses\/recent$/) && method === "GET") {
      const projectId = pathParts[1];
      return [generateMockExpense(projectId, "exp-1"), generateMockExpense(projectId, "exp-2")];
    }

    if (endpoint.match(/^\/projects\/[^/]+\/expenses\/[^/]+$/) && method === "GET") {
      const projectId = pathParts[1];
      const expenseId = pathParts[3];
      return generateMockExpense(projectId, expenseId);
    }

    if (endpoint.match(/^\/projects\/[^/]+\/expenses$/) && method === "POST") {
      const projectId = pathParts[1];
      return generateMockExpense(projectId, `exp-${Date.now()}`);
    }

    if (endpoint.match(/^\/projects\/[^/]+\/expenses\/categories$/) && method === "GET") {
      return [
        { id: "utilities", name: "Utilities", budget: 50000 },
        { id: "supplies", name: "Supplies", budget: 30000 },
        { id: "maintenance", name: "Maintenance", budget: 20000 },
        { id: "salaries", name: "Salaries", budget: 150000 },
      ];
    }

    // Dashboard & Stats endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/dashboard\/stats$/) && method === "GET") {
      const projectId = pathParts[1];
      return generateMockDashboardStats(projectId);
    }

    // Reports endpoints
    if (
      endpoint.match(/^\/projects\/[^/]+\/reports\/(financial|summary|[^/]+)$/) &&
      method === "GET"
    ) {
      return {
        reportType: pathParts[3],
        period: "monthly",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        totalRevenue: 675000,
        totalExpenses: 185000,
        netProfit: 490000,
        metrics: {
          occupancyRate: 78.5,
          averageRate: 5000,
          revPAR: 3925,
        },
        data: [],
      };
    }

    // Team endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/team$/) && method === "GET") {
      return [
        {
          id: "user-1",
          name: "Admin User",
          email: "admin@resort.com",
          role: "owner",
          joinedAt: new Date().toISOString(),
        },
        {
          id: "user-2",
          name: "Staff User",
          email: "staff@resort.com",
          role: "member",
          joinedAt: new Date().toISOString(),
        },
      ];
    }

    // Settings endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/settings$/) && method === "GET") {
      return {
        projectId: pathParts[1],
        general: {
          name: "Okaeri Resort",
          timezone: "Asia/Manila",
          currency: "PHP",
          language: "en",
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          bookingAlerts: true,
          paymentAlerts: true,
        },
        billing: {
          vatRate: 12,
          serviceChargeRate: 10,
          invoicePrefix: "INV",
        },
      };
    }

    // Integrations endpoints
    if (endpoint.match(/^\/projects\/[^/]+\/integrations$/) && method === "GET") {
      return {
        airbnb: { connected: false, lastSync: null },
        bookingCom: { connected: false, lastSync: null },
        gcash: { connected: true, accountId: "09123456789" },
        googleCalendar: { connected: false, lastSync: null },
      };
    }

    // Default response for unhandled endpoints
    console.log(`[MockAPI] Unhandled request: ${method} ${endpoint}`);
    return null;
  }

  /**
   * Intercept fetch to handle mock responses
   * This should be called once during app initialization
   */
  static interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === "string" ? input : input.toString();

      // Only intercept API calls to our backend
      if (!url.includes("/api/") && !url.includes("/projects/")) {
        return originalFetch(input, init);
      }

      // Extract the path after /api
      const apiPath = url.includes("/api/")
        ? url.split("/api")[1]
        : "/" + url.split("/").slice(3).join("/");

      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      try {
        const mockData = await MockApiHandler.handleRequest(method, apiPath, body);

        if (mockData !== null) {
          // Return mock response
          return new Response(JSON.stringify({ success: true, data: mockData }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        console.error("[MockAPI] Error handling mock request:", error);
      }

      // Fallback to original fetch for non-mocked endpoints
      return originalFetch(input, init);
    };

    console.log("[MockAPI] Fetch interceptor installed - API calls will return mock data");
  }
}

// Auto-install in development mode
if (typeof window !== "undefined" && import.meta.env.DEV) {
  MockApiHandler.interceptFetch();
}

export default MockApiHandler;
