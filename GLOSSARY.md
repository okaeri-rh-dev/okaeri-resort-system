# Okaeri Resort

A small family-run resort's booking and internal bookkeeping system. Staff record stays and the money received for them; there is no front desk.

## Language

### Stays

**Booking**:
A guest's reserved stay for one or more units over a check-in to check-out date range, with an agreed total price.
_Avoid_: Reservation, order

**Unit**:
A rentable accommodation (cabin or room) that a booking occupies.
_Avoid_: Cabin (as a general term), room, property

### Money received

**Payment**:
Money received from a guest toward one booking, with an amount, method, date and optional proof.
_Avoid_: Transaction, receipt, deposit

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
