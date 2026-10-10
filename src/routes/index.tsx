/**
 * Home Page - Public Availability Calendar
 *
 * The root route displays the public availability calendar, allowing visitors
 * to immediately see available dates without authentication.
 *
 * Purpose:
 * - Provide immediate value to visitors (availability info)
 * - Reduce "Is it available?" inquiries
 * - Improve SEO with availability content on homepage
 *
 * Flow:
 * 1. Guest lands on homepage → Sees availability calendar
 * 2. Guest checks available dates → No login required
 * 3. Guest contacts manager → Via WhatsApp or phone
 * 4. Manager sends booking link → After discussion
 *
 * @route /
 */

import { lazy, Suspense, useEffect } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// Lazy load the calendar component for better initial page load performance
const PublicAvailabilityCalendar = lazy(() =>
  import("@/components/calendar/PublicAvailabilityCalendar").then((mod) => ({
    default: mod.PublicAvailabilityCalendar,
  }))
);

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  // Set document title and meta tags
  useEffect(() => {
    document.title = "Okaeri Resort - Beachfront Accommodation in La Union | Check Availability";

    // Update or create meta tags
    const metaTags = [
      {
        name: "description",
        content:
          "Okaeri Resort offers beachfront accommodations in Taboc, La Union. Check real-time availability and plan your perfect beach getaway. 3 units available.",
      },
      {
        name: "keywords",
        content:
          "Okaeri Resort, La Union resort, beach resort, Taboc accommodations, Philippines beachfront, La Union hotels",
      },
      { property: "og:title", content: "Okaeri Resort - Beachfront Resort in La Union" },
      {
        property: "og:description",
        content:
          "Experience beachfront living at Okaeri Resort. Check availability for our 3 units in Taboc, La Union",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://okaeri-resort.com" },
      { property: "og:image", content: "https://okaeri-resort.com/images/resort-hero.jpg" },
      { property: "og:site_name", content: "Okaeri Resort" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Okaeri Resort - Beachfront Resort in La Union" },
      {
        name: "twitter:description",
        content: "Check availability for our beachfront units in Taboc, La Union",
      },
      { name: "twitter:image", content: "https://okaeri-resort.com/images/resort-hero.jpg" },
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
    "@type": "Resort",
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
      latitude: "16.6888962",
      longitude: "120.3360697",
    },
    url: "https://okaeri-resort.com",
    image: "https://okaeri-resort.com/images/resort-main.jpg",
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Beach Access" },
      { "@type": "LocationFeatureSpecification", name: "WiFi" },
      { "@type": "LocationFeatureSpecification", name: "Air Conditioning" },
      { "@type": "LocationFeatureSpecification", name: "Parking" },
    ],
    priceRange: "₱₱₱",
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Add structured data */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line no-restricted-syntax -- JSON-LD from the constant above, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Main Content - Fills remaining viewport space */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto h-full max-w-7xl px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex h-full flex-col">
            <Suspense
              fallback={
                <div className="flex h-96 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8">
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-slate-600" />
                  <p className="text-slate-600">Loading availability calendar...</p>
                </div>
              }
            >
              <PublicAvailabilityCalendar />
            </Suspense>

            {/* Compact Information Notice */}
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 sm:text-sm">
              <strong>View-Only:</strong> Contact us to book available dates. WhatsApp: +63 917 XXX
              XXXX
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
