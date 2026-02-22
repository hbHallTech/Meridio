import { parsePayslipText, extractTextFromPdf } from "@/lib/document-import";

// ═══════════════════════════════════════════════════════════
// parsePayslipText — Metadata extraction from French payslips
// ═══════════════════════════════════════════════════════════

describe("parsePayslipText", () => {
  describe("document type detection", () => {
    it("should detect FICHE_PAIE from 'bulletin de paie'", () => {
      const result = parsePayslipText("Bulletin de Paie\njanv-26\nEmployé: DUPONT Jean");
      expect(result.documentType).toBe("FICHE_PAIE");
    });

    it("should detect FICHE_PAIE from 'fiche de paie'", () => {
      const result = parsePayslipText("Fiche de paie mensuelle\nfévr-2026");
      expect(result.documentType).toBe("FICHE_PAIE");
    });

    it("should detect FICHE_PAIE from 'bulletin de salaire'", () => {
      const result = parsePayslipText("Bulletin de salaire de janvier 2026");
      expect(result.documentType).toBe("FICHE_PAIE");
    });

    it("should detect ATTESTATION_TRAVAIL", () => {
      const result = parsePayslipText("Attestation de travail\nDélivrée à M. Dupont");
      expect(result.documentType).toBe("ATTESTATION_TRAVAIL");
    });

    it("should detect ATTESTATION_TRAVAIL from 'attestation d'emploi'", () => {
      const result = parsePayslipText("Attestation d'emploi pour Jean Dupont");
      expect(result.documentType).toBe("ATTESTATION_TRAVAIL");
    });

    it("should detect CERTIFICAT_TRAVAIL", () => {
      const result = parsePayslipText("Certificat de travail\nNous certifions que...");
      expect(result.documentType).toBe("CERTIFICAT_TRAVAIL");
    });

    it("should detect CONTRAT from 'contrat de travail'", () => {
      const result = parsePayslipText("Contrat de travail à durée indéterminée");
      expect(result.documentType).toBe("CONTRAT");
    });

    it("should detect CONTRAT from 'contrat d'embauche'", () => {
      const result = parsePayslipText("Contrat d'embauche\nEntre les soussignés");
      expect(result.documentType).toBe("CONTRAT");
    });

    it("should default to FICHE_PAIE when no keyword found", () => {
      const result = parsePayslipText("Some random document text with no keywords");
      expect(result.documentType).toBe("FICHE_PAIE");
    });
  });

  describe("month/year extraction", () => {
    it("should extract from 'janv-26' format", () => {
      const result = parsePayslipText("Bulletin de paie janv-26");
      expect(result.month).toBe("01");
      expect(result.year).toBe("2026");
    });

    it("should extract from 'février-2026' format", () => {
      const result = parsePayslipText("Bulletin de paie février-2026");
      expect(result.month).toBe("02");
      expect(result.year).toBe("2026");
    });

    it("should extract from 'mars/2026' format", () => {
      const result = parsePayslipText("Fiche de paie mars/2026");
      expect(result.month).toBe("03");
      expect(result.year).toBe("2026");
    });

    it("should extract from 'décembre-25' format", () => {
      const result = parsePayslipText("Bulletin de paie décembre-25");
      expect(result.month).toBe("12");
      expect(result.year).toBe("2025");
    });

    it("should extract from 'MM/YYYY' format", () => {
      const result = parsePayslipText("Période: 02/2026");
      expect(result.month).toBe("02");
      expect(result.year).toBe("2026");
    });

    it("should extract from 'Période du DD/MM/YYYY' pattern", () => {
      const result = parsePayslipText("Période du 01/03/2026 au 31/03/2026");
      expect(result.month).toBe("03");
      expect(result.year).toBe("2026");
    });

    it("should handle accented month names", () => {
      const result = parsePayslipText("Bulletin de paie févr-26");
      expect(result.month).toBe("02");
      expect(result.year).toBe("2026");
    });

    it("should handle 'août' with accent", () => {
      const result = parsePayslipText("Fiche de paie août-2026");
      expect(result.month).toBe("08");
      expect(result.year).toBe("2026");
    });

    it("should return null when no date found", () => {
      const result = parsePayslipText("Just some text without dates");
      expect(result.month).toBeNull();
      expect(result.year).toBeNull();
    });
  });

  describe("employee name extraction", () => {
    it("should extract name from 'Employé: NOM Prénom' pattern", () => {
      const result = parsePayslipText("Employé: DUPONT Jean\nBulletin de paie");
      expect(result.employeeName).toBe("DUPONT Jean");
    });

    it("should extract name from 'Salarié : NOM Prénom' pattern", () => {
      const result = parsePayslipText("Salarié : MARTIN Marie\nFiche de paie");
      expect(result.employeeName).toBe("MARTIN Marie");
    });

    it("should extract name from 'M. NOM Prénom' pattern", () => {
      const result = parsePayslipText("M. Dupont Jean travaille ici depuis longtemps");
      expect(result.employeeName).toBe("Dupont Jean");
    });

    it("should extract name from 'Mme NOM Prénom' pattern", () => {
      const result = parsePayslipText("Mme Martin Sophie est employée");
      expect(result.employeeName).toBe("Martin Sophie");
    });

    it("should extract ALLCAPS LASTNAME Firstname fallback", () => {
      const result = parsePayslipText("Some header\nDUPONT Jean\nSome footer");
      expect(result.employeeName).toBe("DUPONT Jean");
    });

    it("should return null when no name found", () => {
      const result = parsePayslipText("Document without any name pattern");
      expect(result.employeeName).toBeNull();
    });
  });

  describe("email extraction", () => {
    it("should extract email address", () => {
      const result = parsePayslipText("Contact: jean.dupont@company.com for details");
      expect(result.employeeEmail).toBe("jean.dupont@company.com");
    });

    it("should lowercase extracted email", () => {
      const result = parsePayslipText("Email: Jean.Dupont@Company.COM");
      expect(result.employeeEmail).toBe("jean.dupont@company.com");
    });

    it("should return null when no email found", () => {
      const result = parsePayslipText("No email in this document");
      expect(result.employeeEmail).toBeNull();
    });
  });

  describe("full payslip scenario", () => {
    it("should parse a realistic French payslip text", () => {
      const text = `
        HALLEY TECHNOLOGIES
        Bulletin de Paie
        Période : 01/01/2026 - 31/01/2026

        Employé: DUPONT Jean
        Email: jean.dupont@halley-technologies.ch

        Salaire brut: 6'500.00 CHF
        Net à payer: 5'234.00 CHF
      `;

      const result = parsePayslipText(text);
      expect(result.documentType).toBe("FICHE_PAIE");
      expect(result.month).toBe("01");
      expect(result.year).toBe("2026");
      expect(result.employeeName).toBe("DUPONT Jean");
      expect(result.employeeEmail).toBe("jean.dupont@halley-technologies.ch");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// extractTextFromPdf — skipped in unit tests (requires Tesseract.js
// worker download + network access). Covered by integration tests.
// ═══════════════════════════════════════════════════════════

describe("extractTextFromPdf", () => {
  it("should be exported as a function", () => {
    expect(typeof extractTextFromPdf).toBe("function");
  });
});
