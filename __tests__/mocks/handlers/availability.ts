/**
 * MSW Handlers for Public Availability API Endpoints
 *
 * Mocks the public availability calendar endpoints for testing.
 */

import { http, HttpResponse } from "msw";

// Mock API response for availability
const mockAvailabilityResponse = {
  totalUnits: 3,
  dateRange: {
    start: "2025-01-01",
    end: "2025-01-31",
  },
  availability: [
    { date: "2025-01-01", availableCount: 3, status: "full" },
    { date: "2025-01-15", availableCount: 2, status: "moderate" },
    { date: "2025-01-20", availableCount: 1, status: "limited" },
    { date: "2025-01-25", availableCount: 0, status: "booked" },
  ],
  metadata: {
    generatedAt: "2025-01-15T12:00:00Z",
    cacheMaxAge: 300,
    version: "v1",
  },
};

export const availabilityHandlers = [
  // GET /api/public/v1/availability - Get availability for a date range
  http.get("*/api/public/v1/availability", ({ request }) => {
    const url = new URL(request.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    // Validate query parameters
    if (!startParam || !endParam) {
      return HttpResponse.json(
        {
          error: "Missing required parameters",
          details: "start and end dates are required",
        },
        { status: 400 }
      );
    }

    // Parse dates
    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return HttpResponse.json(
        {
          error: "Invalid date format",
          details: "Dates must be in ISO format (YYYY-MM-DD)",
        },
        { status: 400 }
      );
    }

    if (endDate <= startDate) {
      return HttpResponse.json(
        {
          error: "Invalid date range",
          details: "End date must be after start date",
        },
        { status: 400 }
      );
    }

    // Generate availability data for the date range
    const availability = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const day = currentDate.getDate();

      // Vary availability based on day of month (for testing)
      let availableCount = 3;
      let status = "full";

      if (day % 5 === 0) {
        availableCount = 0;
        status = "booked";
      } else if (day % 4 === 0) {
        availableCount = 1;
        status = "limited";
      } else if (day % 3 === 0) {
        availableCount = 2;
        status = "moderate";
      }

      availability.push({
        date: dateStr,
        availableCount,
        status,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return HttpResponse.json({
      totalUnits: 3,
      dateRange: {
        start: startParam,
        end: endParam,
      },
      availability,
      metadata: {
        generatedAt: new Date().toISOString(),
        cacheMaxAge: 300,
        version: "v1",
      },
    });
  }),
];
