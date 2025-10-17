/**
 * Public Availability Calendar Route
 *
 * View-only public calendar showing real-time availability for Okaeri Resort.
 * No authentication required. No booking forms or pricing display.
 *
 * Purpose:
 * - Help guests check available dates before contacting manager
 * - Reduce "Is it available?" WhatsApp inquiries
 * - Improve SEO with indexed availability page
 *
 * Flow:
 * 1. Guest views calendar → Checks available dates
 * 2. Guest contacts manager → Via WhatsApp or phone
 * 3. Manager discusses details → Dates, pricing, requirements
 * 4. Manager sends booking link → After confirming availability
 *
 * @route /calendar
 */

import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, lazy, Suspense } from "react";

// Lazy load the calendar component for better initial page load performance
const PublicAvailabilityCalendar = lazy(() =>
  import("@/components/calendar/PublicAvailabilityCalendar").then((mod) => ({
    default: mod.PublicAvailabilityCalendar,
  }))
);

export const Route = createFileRoute("/calendar")({
  component: AvailabilityPage,
});

function AvailabilityPage() {
  // Set document title and meta tags
  useEffect(() => {
    document.title = "Okaeri Resort - Availability Calendar | Check Real-Time Availability";

    // Update or create meta tags
    const metaTags = [
      {
        name: "description",
        content:
          "Check real-time availability for Okaeri Resort in Taboc, La Union. View available dates and plan your beachfront getaway. 3 units available.",
      },
      {
        name: "keywords",
        content:
          "Okaeri Resort, La Union resort availability, beach resort calendar, Taboc accommodations, Philippines beachfront booking",
      },
      { property: "og:title", content: "Okaeri Resort Availability Calendar" },
      {
        property: "og:description",
        content: "View real-time availability for our 3 beachfront units in Taboc, La Union",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://okaeri-resort.com/calendar" },
      { property: "og:image", content: "https://okaeri-resort.com/images/calendar-og.jpg" },
      { property: "og:site_name", content: "Okaeri Resort" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Okaeri Resort Availability Calendar" },
      {
        name: "twitter:description",
        content: "View real-time availability for our 3 beachfront units",
      },
      { name: "twitter:image", content: "https://okaeri-resort.com/images/calendar-og.jpg" },
    ];

    metaTags.forEach(({ name, property, content }) => {
      const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;

      if (!meta) {
        meta = document.createElement("meta");
        if (name) meta.setAttribute("name", name);
        if (property) meta.setAttribute("property", property);
        document.head.appendChild(meta);
      }

      meta.setAttribute("content", content);
    });
  }, []);

  // JSON-LD structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: "Okaeri Resort",
    description: "Beachfront resort in Taboc, La Union with 3 available units",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Taboc",
      addressRegion: "La Union",
      addressCountry: "PH",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "16.6888962", // Replace with actual coordinates
      longitude: "120.3360697",
    },
    url: "https://okaeri-resort.com",
    image: "https://okaeri-resort.com/images/resort-main.jpg",
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Beach Access" },
      { "@type": "LocationFeatureSpecification", name: "WiFi" },
    ],
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Add structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Main Content - Fills remaining viewport space */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-3 py-2 sm:px-4 sm:py-3 max-w-7xl h-full">
          <div className="flex flex-col h-full">
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg border border-slate-200 p-8">
                  <Loader2 className="w-10 h-10 animate-spin text-slate-600 mb-4" />
                  <p className="text-slate-600">Loading availability calendar...</p>
                </div>
              }
            >
              <PublicAvailabilityCalendar />
            </Suspense>

            {/* Compact Information Notice */}
            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs sm:text-sm text-slate-700">
              <strong>View-Only:</strong> Contact us to book available dates.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
