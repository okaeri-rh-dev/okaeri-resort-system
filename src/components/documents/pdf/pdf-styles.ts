import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
    lineHeight: 1.5,
  },

  // Letterhead
  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 12,
    marginBottom: 20,
  },
  letterheadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 50,
    height: 50,
    objectFit: "contain",
  },
  resortName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  tagline: {
    fontSize: 8,
    fontStyle: "italic",
    color: "#888",
    marginTop: 2,
  },
  letterheadRight: {
    textAlign: "right",
    fontSize: 8,
    color: "#666",
    lineHeight: 1.6,
  },

  // Document header
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  docTypeTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    color: "#1a1a1a",
  },
  docNumber: {
    fontSize: 9,
    fontFamily: "Courier",
    color: "#666",
    marginTop: 4,
  },
  docMeta: {
    textAlign: "right",
    fontSize: 9,
  },
  docMetaLabel: {
    color: "#888",
  },

  // Recipient
  recipientBox: {
    backgroundColor: "#f9f9f9",
    border: "1pt solid #e0e0e0",
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
  },
  recipientLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: "#999",
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  recipientDetail: {
    fontSize: 9,
    color: "#666",
    marginTop: 1,
  },

  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 5,
  },
  tableRowAlt: {
    backgroundColor: "#f9f9f9",
  },
  colNum: {
    width: 25,
    fontSize: 9,
    color: "#888",
  },
  colDesc: {
    flex: 1,
    fontSize: 9,
  },
  colQty: {
    width: 40,
    textAlign: "right",
    fontSize: 9,
  },
  colUnit: {
    width: 45,
    textAlign: "center",
    fontSize: 9,
    color: "#888",
  },
  colPrice: {
    width: 75,
    textAlign: "right",
    fontSize: 9,
  },
  colAmount: {
    width: 75,
    textAlign: "right",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  thText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666",
  },

  // Pricing summary
  pricingContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  pricingBox: {
    width: 200,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    fontSize: 9,
  },
  pricingLabel: {
    color: "#888",
  },
  pricingDiscount: {
    color: "#dc2626",
  },
  pricingTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    paddingTop: 4,
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },

  // Terms & notes
  termsSection: {
    borderTopWidth: 0.5,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
    marginTop: 10,
  },
  termsBlock: {
    marginBottom: 8,
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#444",
    marginBottom: 2,
  },
  termsText: {
    fontSize: 8,
    color: "#666",
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
    marginTop: 20,
    textAlign: "center",
    fontSize: 7,
    fontStyle: "italic",
    color: "#aaa",
  },

  // Page number
  pageNumber: {
    position: "absolute",
    bottom: 20,
    right: 40,
    fontSize: 7,
    color: "#aaa",
  },
});
