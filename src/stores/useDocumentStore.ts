import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  DEFAULT_CANCELLATION_POLICY,
  DEFAULT_LETTERHEAD,
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_VAT_RATE,
  DOCUMENT_PREFIX_MAP,
} from "@/components/documents/constants";
import type {
  DocumentFormData,
  DocumentLineItem,
  DocumentPricing,
  DocumentType,
  LetterheadConfig,
} from "@/components/documents/types";
import { toManilaDateString } from "@/lib/timezone";

// ============================================
// TYPES
// ============================================

type PreviewMode = "form" | "preview" | "split";

interface DocumentStore {
  // Persisted state
  letterhead: LetterheadConfig;
  documentCounter: number;

  // Transient state
  formData: DocumentFormData;
  isGenerating: boolean;
  previewMode: PreviewMode;

  // Letterhead actions
  updateLetterhead: (partial: Partial<LetterheadConfig>) => void;
  resetLetterhead: () => void;

  // Form actions
  setFormData: (partial: Partial<DocumentFormData>) => void;
  setDocumentType: (type: DocumentType) => void;
  setRecipientField: (field: string, value: string) => void;

  // Line item actions
  addLineItem: (item: DocumentLineItem) => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, partial: Partial<DocumentLineItem>) => void;

  // Pricing actions
  recalculatePricing: () => void;
  setDiscountAmount: (amount: number) => void;
  setDiscountLabel: (label: string) => void;
  setVatRate: (rate: number) => void;

  // Document number
  generateDocumentNumber: (type: DocumentType) => string;

  // UI state
  setIsGenerating: (value: boolean) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  resetForm: () => void;
}

// ============================================
// HELPERS
// ============================================

function calculatePricing(
  lineItems: DocumentLineItem[],
  discountAmount: number,
  vatRate: number,
  discountLabel?: string
): DocumentPricing {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const vatAmount = taxableAmount * vatRate;
  const totalAmount = taxableAmount + vatAmount;

  return {
    subtotal,
    discount_label: discountLabel,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total_amount: totalAmount,
  };
}

function createInitialFormData(): DocumentFormData {
  return {
    document_type: "quotation",
    document_date: toManilaDateString(new Date()),
    valid_until: "",
    recipient: {
      name: "",
      email: "",
      phone: "",
      address: "",
      company_name: "",
      tin: "",
    },
    line_items: [],
    pricing: {
      subtotal: 0,
      discount_label: "",
      discount_amount: 0,
      taxable_amount: 0,
      vat_rate: DEFAULT_VAT_RATE,
      vat_amount: 0,
      total_amount: 0,
    },
    notes: "",
    payment_terms: DEFAULT_PAYMENT_TERMS,
    cancellation_policy: DEFAULT_CANCELLATION_POLICY,
  };
}

// ============================================
// STORE
// ============================================

export const useDocumentStore = create<DocumentStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Persisted state
        letterhead: { ...DEFAULT_LETTERHEAD },
        documentCounter: 0,

        // Transient state
        formData: createInitialFormData(),
        isGenerating: false,
        previewMode: "split" as PreviewMode,

        // Letterhead actions
        updateLetterhead: (partial) =>
          set(
            (state) => ({ letterhead: { ...state.letterhead, ...partial } }),
            false,
            "updateLetterhead"
          ),

        resetLetterhead: () =>
          set({ letterhead: { ...DEFAULT_LETTERHEAD } }, false, "resetLetterhead"),

        // Form actions
        setFormData: (partial) =>
          set(
            (state) => ({
              formData: { ...state.formData, ...partial },
            }),
            false,
            "setFormData"
          ),

        setDocumentType: (type) =>
          set(
            (state) => ({
              formData: { ...state.formData, document_type: type },
            }),
            false,
            "setDocumentType"
          ),

        setRecipientField: (field, value) =>
          set(
            (state) => ({
              formData: {
                ...state.formData,
                recipient: { ...state.formData.recipient, [field]: value },
              },
            }),
            false,
            "setRecipientField"
          ),

        // Line item actions
        addLineItem: (item) =>
          set(
            (state) => {
              const newItems = [...state.formData.line_items, item];
              const pricing = calculatePricing(
                newItems,
                state.formData.pricing.discount_amount,
                state.formData.pricing.vat_rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, line_items: newItems, pricing },
              };
            },
            false,
            "addLineItem"
          ),

        removeLineItem: (id) =>
          set(
            (state) => {
              const newItems = state.formData.line_items.filter((item) => item.id !== id);
              const pricing = calculatePricing(
                newItems,
                state.formData.pricing.discount_amount,
                state.formData.pricing.vat_rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, line_items: newItems, pricing },
              };
            },
            false,
            "removeLineItem"
          ),

        updateLineItem: (id, partial) =>
          set(
            (state) => {
              const newItems = state.formData.line_items.map((item) => {
                if (item.id !== id) return item;
                const updated = { ...item, ...partial };
                updated.amount = updated.quantity * updated.unit_price;
                return updated;
              });
              const pricing = calculatePricing(
                newItems,
                state.formData.pricing.discount_amount,
                state.formData.pricing.vat_rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, line_items: newItems, pricing },
              };
            },
            false,
            "updateLineItem"
          ),

        // Pricing actions
        recalculatePricing: () =>
          set(
            (state) => {
              const pricing = calculatePricing(
                state.formData.line_items,
                state.formData.pricing.discount_amount,
                state.formData.pricing.vat_rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, pricing },
              };
            },
            false,
            "recalculatePricing"
          ),

        setDiscountAmount: (amount) =>
          set(
            (state) => {
              const pricing = calculatePricing(
                state.formData.line_items,
                amount,
                state.formData.pricing.vat_rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, pricing },
              };
            },
            false,
            "setDiscountAmount"
          ),

        setDiscountLabel: (label) =>
          set(
            (state) => ({
              formData: {
                ...state.formData,
                pricing: { ...state.formData.pricing, discount_label: label },
              },
            }),
            false,
            "setDiscountLabel"
          ),

        setVatRate: (rate) =>
          set(
            (state) => {
              const pricing = calculatePricing(
                state.formData.line_items,
                state.formData.pricing.discount_amount,
                rate,
                state.formData.pricing.discount_label
              );
              return {
                formData: { ...state.formData, pricing },
              };
            },
            false,
            "setVatRate"
          ),

        // Document number
        generateDocumentNumber: (type) => {
          const state = get();
          const nextCounter = state.documentCounter + 1;
          set({ documentCounter: nextCounter }, false, "incrementCounter");
          const prefix = DOCUMENT_PREFIX_MAP[type];
          const year = new Date().getFullYear();
          const padded = String(nextCounter).padStart(4, "0");
          return `${prefix}-${year}-${padded}`;
        },

        // UI state
        setIsGenerating: (value) => set({ isGenerating: value }, false, "setIsGenerating"),
        setPreviewMode: (mode) => set({ previewMode: mode }, false, "setPreviewMode"),

        resetForm: () =>
          set(
            {
              formData: createInitialFormData(),
              isGenerating: false,
            },
            false,
            "resetForm"
          ),
      }),
      {
        name: "document-storage",
        partialize: (state) => ({
          letterhead: state.letterhead,
          documentCounter: state.documentCounter,
        }),
      }
    ),
    { name: "DocumentStore" }
  )
);
