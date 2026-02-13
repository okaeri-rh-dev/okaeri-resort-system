// Document Generator Type Definitions

export type DocumentType = "quotation" | "invoice";
export type DocumentStatus = "draft" | "final";
export type LineItemType = "accommodation" | "service" | "fee" | "custom";

export interface LetterheadConfig {
  resort_name: string;
  tagline?: string;
  logo_base64?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province: string;
  zip_code: string;
  phone: string;
  email: string;
  website?: string;
  tin?: string;
}

export interface DocumentRecipient {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  tin?: string;
}

export interface DocumentLineItem {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unit_label: string;
  unit_price: number;
  amount: number;
}

export interface DocumentPricing {
  subtotal: number;
  discount_label?: string;
  discount_amount: number;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
}

export interface DocumentFormData {
  document_type: DocumentType;
  document_date: string;
  valid_until?: string;
  recipient: DocumentRecipient;
  line_items: DocumentLineItem[];
  pricing: DocumentPricing;
  notes?: string;
  payment_terms?: string;
  cancellation_policy?: string;
}

export interface GeneratedDocument {
  metadata: {
    document_number: string;
    document_type: DocumentType;
    document_date: string;
    valid_until?: string;
  };
  letterhead: LetterheadConfig;
  recipient: DocumentRecipient;
  line_items: DocumentLineItem[];
  pricing: DocumentPricing;
  notes?: string;
  payment_terms?: string;
  cancellation_policy?: string;
}
