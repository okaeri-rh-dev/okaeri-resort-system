import { BookingCalendar } from "@/features/booking/components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test-booking")({
  component: TestBooking,
});

function TestBooking() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="text-foreground mb-4 text-3xl font-bold">
          Phase 3 Booking Component Verification
        </h1>
        <p className="text-muted-foreground mb-6">
          Testing the implemented booking calendar to verify actual functionality.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold">BookingCalendar Component</h2>
        <BookingCalendar
          projectId="test-project-001"
          availabilityData={{
            "2025-01-01": {
              totalRooms: 5,
              availableRooms: 3,
              bookings: [
                {
                  id: "b1",
                  guestName: "John Doe",
                  status: "confirmed",
                  checkIn: "2025-01-01",
                  checkOut: "2025-01-03",
                },
              ],
              maintenanceBlocks: [],
            },
            "2025-01-15": {
              totalRooms: 5,
              availableRooms: 0,
              bookings: [
                {
                  id: "b2",
                  guestName: "Jane Smith",
                  status: "confirmed",
                  checkIn: "2025-01-15",
                  checkOut: "2025-01-17",
                },
              ],
              maintenanceBlocks: [],
            },
          }}
          onDateSelect={(date) => {
            console.log("Date selected:", date);
            alert(`Selected date: ${date.toLocaleDateString()}`);
          }}
          onRangeSelect={(range) => {
            console.log("Range selected:", range);
            alert(
              `Selected range: ${range.start.toLocaleDateString()} to ${range.end.toLocaleDateString()}`
            );
          }}
        />
      </div>

      <div className="bg-muted mt-8 rounded-lg p-4">
        <h3 className="mb-2 font-semibold">Verification Checklist:</h3>
        <ul className="space-y-1 text-sm">
          <li>• Calendar displays current month with proper grid layout</li>
          <li>• Navigation buttons work (previous/next month)</li>
          <li>• Clicking dates triggers selection events (check console/alerts)</li>
          <li>• Today's date is highlighted</li>
          <li>• Week headers show (Sun-Sat)</li>
          <li>• No console errors or missing component warnings</li>
        </ul>
      </div>
    </div>
  );
}
