import { generateAttestationPdf, type AttestationData } from "@/lib/pdf-generator";

const baseData: AttestationData = {
  employeeFirstName: "Jean",
  employeeLastName: "Dupont",
  employeeEmail: "jean.dupont@halley-technologies.ch",
  hireDate: new Date("2022-03-15"),
  officeName: "Bureau de Genève",
  officeCity: "Genève",
  officeCountry: "CH",
  companyName: "Halley Technologies",
  companyAddress: "Rue du Rhône 42",
  companyPostalCode: "1204",
  companyCity: "Genève",
  companyCountry: "CH",
  companyLegalForm: " (Sàrl)",
  contactFirstName: "Hassan",
  contactLastName: "Bourhim",
  companyLogoUrl: null,
  documentType: "ATTESTATION_TRAVAIL",
  templateContent: null,
  generatedDate: new Date("2026-02-22"),
};

describe("generateAttestationPdf", () => {
  it("should generate a valid PDF for ATTESTATION_TRAVAIL", async () => {
    const pdfBytes = await generateAttestationPdf(baseData);

    // Should return a Uint8Array
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    // Should be a non-trivial size (at least 1KB for a simple PDF)
    expect(pdfBytes.length).toBeGreaterThan(1000);
    // Should start with PDF magic bytes %PDF
    expect(pdfBytes[0]).toBe(0x25); // %
    expect(pdfBytes[1]).toBe(0x50); // P
    expect(pdfBytes[2]).toBe(0x44); // D
    expect(pdfBytes[3]).toBe(0x46); // F
  });

  it("should generate a valid PDF for CERTIFICAT_TRAVAIL", async () => {
    const data: AttestationData = {
      ...baseData,
      documentType: "CERTIFICAT_TRAVAIL",
    };

    const pdfBytes = await generateAttestationPdf(data);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    // Valid PDF header
    expect(pdfBytes[0]).toBe(0x25);
    expect(pdfBytes[1]).toBe(0x50);
  });

  it("should use custom template content when provided", async () => {
    const data: AttestationData = {
      ...baseData,
      templateContent: "CUSTOM ATTESTATION\n\nEmployee: {{employee_name}}\nCompany: {{company_name}}\nDate: {{date}}",
    };

    const pdfBytes = await generateAttestationPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });

  it("should handle missing optional company data", async () => {
    const data: AttestationData = {
      ...baseData,
      companyAddress: null,
      companyPostalCode: null,
      companyCity: null,
      companyLegalForm: null,
      contactFirstName: null,
      contactLastName: null,
      companyLogoUrl: null,
    };

    const pdfBytes = await generateAttestationPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });

  it("should handle HTML template content (strips tags)", async () => {
    const data: AttestationData = {
      ...baseData,
      templateContent: "<h1>ATTESTATION</h1><p>Employee: <strong>{{employee_name}}</strong></p><p>&nbsp;</p><p>Company: {{company_name}}</p>",
    };

    const pdfBytes = await generateAttestationPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });

  it("should substitute all template variables", async () => {
    const data: AttestationData = {
      ...baseData,
      templateContent: [
        "{{document_type}}",
        "Employee: {{employee_name}} ({{employee_email}})",
        "Company: {{company_name}} {{company_legal_form}}",
        "Address: {{company_address}}",
        "Hired: {{hire_date}}",
        "Office: {{office_name}}, {{office_city}}",
        "Date: {{date}}",
        "Month: {{month}}, Year: {{year}}",
        "Contact: {{contact_name}}",
      ].join("\n"),
    };

    // Should not throw — all variables should be substituted
    const pdfBytes = await generateAttestationPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
  });

  it("should produce different output for different employees", async () => {
    const data1 = { ...baseData };
    const data2 = {
      ...baseData,
      employeeFirstName: "Marie",
      employeeLastName: "Martin",
    };

    const pdf1 = await generateAttestationPdf(data1);
    const pdf2 = await generateAttestationPdf(data2);

    // Both valid
    expect(pdf1.length).toBeGreaterThan(500);
    expect(pdf2.length).toBeGreaterThan(500);
    // Different content (byte length may differ due to different names)
    expect(Buffer.from(pdf1).equals(Buffer.from(pdf2))).toBe(false);
  });

  it("should handle logo URL gracefully when fetch fails", async () => {
    const data: AttestationData = {
      ...baseData,
      companyLogoUrl: "https://invalid-domain-that-does-not-exist.test/logo.png",
    };

    // Should not throw — logo fetch failure is handled gracefully
    const pdfBytes = await generateAttestationPdf(data);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
  });
});
