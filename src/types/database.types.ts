// Generated types from database.generated.ts (`npm run gen:types`) with
// text columns narrowed to the values their CHECK constraints allow.
// Import database types from this module, not from database.generated.ts.

import type { AppRoleName } from "./app-role";
import type { BookingStatus } from "./booking-status";
import type { Database as GeneratedDatabase } from "./database.generated";

export type { Json } from "./database.generated";
export { Constants } from "./database.generated";

type GeneratedPublic = GeneratedDatabase["public"];

// bookings and app_roles have the CHECKs; the two availability relations copy
// their status from bookings. bookings_conflict_backup is a snapshot with no
// constraint and stays string.
type NarrowedColumns = {
  bookings: { booking_status: BookingStatus };
  booking_unit_availability: { booking_status: BookingStatus };
  public_unit_availability: { booking_status: BookingStatus };
  app_roles: { role: AppRoleName };
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

export type Enums<Name extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][Name];

export type CompositeTypes<Name extends keyof PublicSchema["CompositeTypes"]> =
  PublicSchema["CompositeTypes"][Name];
