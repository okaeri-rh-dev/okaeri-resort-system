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

import { PublicAvailabilityCalendar } from "@/components/calendar/PublicAvailabilityCalendar";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar as CalendarIcon } from "lucide-react";
import { useEffect } from "react";

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Add structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CalendarIcon className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Okaeri Availability Calendar</h1>
            <p className="text-lg text-gray-600">
              Check real-time availability for our 3 beachfront units in Taboc, La Union
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PublicAvailabilityCalendar />

        {/* Information Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>View-Only Calendar:</strong> This calendar shows real-time availability for
            planning purposes only. To make a booking, please contact us through our main website.
            Our manager will confirm availability, discuss pricing and requirements, and guide you
            through the booking process.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-gray-100 border-t border-gray-200">
        <div className="container mx-auto px-4 max-w-4xl text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} Okaeri Resort. All rights reserved.</p>
          <p className="mt-1">
            <a href="/" className="text-blue-600 hover:underline">
              Home
            </a>
            {" • "}
            <a href="/contact" className="text-blue-600 hover:underline">
              Contact
            </a>
            {" • "}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
