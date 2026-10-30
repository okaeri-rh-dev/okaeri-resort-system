// Generated types from database.generated.ts (`npm run gen:types`) with
// text columns narrowed to the values their CHECK constraints allow.
// Import database types from this module, not from database.generated.ts.

import type { AppRoleName } from "./app-role";
import type { BookingStatus, PaymentStatus } from "./booking-status";
import type { ContactChannelKind } from "./contact-channel-kind";
import type { Database as GeneratedDatabase } from "./database.generated";

export type { Json } from "./database.generated";
type GeneratedPublic = GeneratedDatabase["public"];

// bookings, app_roles, contact_channels and payments have the CHECKs (payment_status is derived, docs/adr/0001); the two availability relations copy
// their status from bookings.
type NarrowedColumns = {
  bookings: {
    booking_status: BookingStatus;
    payment_status: PaymentStatus;
  };
  booking_unit_availability: { booking_status: BookingStatus };
  public_unit_availability: { booking_status: BookingStatus };
  app_roles: { role: AppRoleName };
  contact_channels: { kind: ContactChannelKind };
  payments: { kind: "manual" | "online_downpayment" };
};

type NarrowString<Column, Narrowed> = Column extends string ? Narrowed : Column;

type WithNarrowedColumns<Shape, Columns> = {
  [Key in keyof Shape]: Key extends keyof Columns
    ? NarrowString<Shape[Key], Columns[Key]>
    : Shape[Key];
};

type NarrowRelation<Relation, Columns> = {
  [Part in keyof Relation]: Part extends "Row" | "Insert" | "Update"
    ? WithNarrowedColumns<Relation[Part], Columns>
    : Relation[Part];
};

type NarrowRelations<Relations> = {
  [Name in keyof Relations]: Name extends keyof NarrowedColumns
    ? NarrowRelation<Relations[Name], NarrowedColumns[Name]>
    : Relations[Name];
};

type PublicSchema = {
  [Section in keyof GeneratedPublic]: Section extends "Tables" | "Views"
    ? NarrowRelations<GeneratedPublic[Section]>
    : GeneratedPublic[Section];
};

export type Database = {
  [Schema in keyof GeneratedDatabase]: Schema extends "public"
    ? PublicSchema
    : GeneratedDatabase[Schema];
};

type PublicRelations = PublicSchema["Tables"] & PublicSchema["Views"];

export type Tables<Name extends keyof PublicRelations> = PublicRelations[Name] extends {
  Row: infer Row;
}
  ? Row
  : never;

export type TablesInsert<Name extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][Name]["Insert"];

export type TablesUpdate<Name extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][Name]["Update"];
