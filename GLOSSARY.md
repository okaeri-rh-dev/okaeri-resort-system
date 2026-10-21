# Okaeri Resort

A small family-run resort's booking and internal bookkeeping system. Staff record stays and the money received for them; there is no front desk.

## Language

### Stays

**Booking**:
A guest's reserved stay for one or more units over a check-in to check-out date range, with an agreed total price.
_Avoid_: Reservation, order

**Check-in day**:
The Manila calendar day a booking's stay starts. Every date in the app is a Manila day.
_Avoid_: Arrival time, check-in time (the stored 14:00 is a storage detail, see ADR 0002)

**Check-out day**:
The Manila calendar day a booking's stay ends.
_Avoid_: Departure time, check-out time

**Night**:
One Manila day from the check-in day up to, but not including, the check-out day. A booking's night count is the number of these days.
_Avoid_: Day (when counting a stay)

**Unit**:
A rentable accommodation (cabin or room) that a booking occupies. Guests and staff call units "cabins", so screen copy says "cabin"; the model says unit.
_Avoid_: Room, property

### Money received

**Payment**:
Money received from a guest toward one booking, with an amount, method, date and optional proof.
_Avoid_: Transaction, receipt, deposit

**Payment proof**:
The screenshot of a GCash or bank transfer that a guest attaches when booking online, so staff can match it to money received. Screen copy calls it a "payment screenshot".
_Avoid_: Receipt

**Soft-deleted payment**:
A payment marked as deleted: kept for history but no longer counted as money received.
_Avoid_: Voided payment, removed payment

**Refunded payment**:
A payment returned to the guest; it no longer counts as money received.

**Booking payment status**:
How much of a booking's total has been received: Pending (nothing), Partial, Completed (all of it), or Refunded (only refunded payments). Always derived from the booking's payments, never set by hand.
_Avoid_: Paid flag, verification status

**Outstanding balance**:
A booking's total price minus its counted payments.
_Avoid_: Remaining amount, due

### Reaching the resort

**Contact channel**:
One way a guest can reach the resort, one of: mobile number, Viber, WhatsApp, Messenger, email, Facebook or Instagram. Each has an optional label and can be hidden from guests without being deleted. The resort keeps an ordered list of them.
_Avoid_: Contact details, contact info, social link, contact (alone, which means a guest's own phone or email)
