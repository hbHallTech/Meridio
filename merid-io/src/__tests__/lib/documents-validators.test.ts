import {
  documentCreateSchema,
  documentUpdateSchema,
  documentListQuerySchema,
  templateCreateSchema,
  templateUpdateSchema,
} from "@/lib/validators";

// ═══════════════════════════════════════════════════════════
// Document Create Schema
// ═══════════════════════════════════════════════════════════

describe("documentCreateSchema", () => {
  const validDoc = {
    userId: "user-123",
    name: "Fiche_Paie_02-2026.pdf",
    type: "FICHE_PAIE" as const,
  };

  it("should validate a correct document create input", () => {
    const result = documentCreateSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it("should accept optional metadata with mois and annee", () => {
    const result = documentCreateSchema.safeParse({
      ...validDoc,
      metadata: { mois: "02", annee: "2026" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept all valid document types", () => {
    const types = [
      "FICHE_PAIE",
      "ATTESTATION_TRAVAIL",
      "CERTIFICAT_TRAVAIL",
      "CONTRAT",
      "AUTRE",
    ];
    for (const type of types) {
      const result = documentCreateSchema.safeParse({ ...validDoc, type });
      expect(result.success).toBe(true);
    }
  });

  it("should reject missing userId", () => {
    const result = documentCreateSchema.safeParse({
      name: "doc.pdf",
      type: "FICHE_PAIE",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty name", () => {
    const result = documentCreateSchema.safeParse({
      ...validDoc,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid document type", () => {
    const result = documentCreateSchema.safeParse({
      ...validDoc,
      type: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Document Update Schema
// ═══════════════════════════════════════════════════════════

describe("documentUpdateSchema", () => {
  it("should validate status update to OUVERT", () => {
    const result = documentUpdateSchema.safeParse({ status: "OUVERT" });
    expect(result.success).toBe(true);
  });

  it("should validate status update to ARCHIVE", () => {
    const result = documentUpdateSchema.safeParse({ status: "ARCHIVE" });
    expect(result.success).toBe(true);
  });

  it("should validate name update", () => {
    const result = documentUpdateSchema.safeParse({ name: "new_name.pdf" });
    expect(result.success).toBe(true);
  });

  it("should validate type update", () => {
    const result = documentUpdateSchema.safeParse({ type: "CONTRAT" });
    expect(result.success).toBe(true);
  });

  it("should validate metadata update", () => {
    const result = documentUpdateSchema.safeParse({
      metadata: { mois: "03", annee: "2026" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = documentUpdateSchema.safeParse({ status: "DELETED" });
    expect(result.success).toBe(false);
  });

  it("should reject empty name", () => {
    const result = documentUpdateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should accept empty update (all optional)", () => {
    const result = documentUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Document List Query Schema
// ═══════════════════════════════════════════════════════════

describe("documentListQuerySchema", () => {
  it("should validate with no filters", () => {
    const result = documentListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate with type filter", () => {
    const result = documentListQuerySchema.safeParse({ type: "FICHE_PAIE" });
    expect(result.success).toBe(true);
  });

  it("should validate with status filter", () => {
    const result = documentListQuerySchema.safeParse({ status: "NOUVEAU" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid type filter", () => {
    const result = documentListQuerySchema.safeParse({ type: "INVALID" });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Template Schemas
// ═══════════════════════════════════════════════════════════

describe("templateCreateSchema", () => {
  const validTemplate = {
    name: "Fiche de paie standard",
    type: "FICHE_PAIE" as const,
    content: "<p>Template content with {{employee_name}}</p>",
  };

  it("should validate a correct template", () => {
    const result = templateCreateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
  });

  it("should accept optional subject and variables", () => {
    const result = templateCreateSchema.safeParse({
      ...validTemplate,
      subject: "Your payslip",
      variables: ["employee_name", "month", "year"],
      isActive: true,
      isDefault: false,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = templateCreateSchema.safeParse({
      ...validTemplate,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty content", () => {
    const result = templateCreateSchema.safeParse({
      ...validTemplate,
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid document type", () => {
    const result = templateCreateSchema.safeParse({
      ...validTemplate,
      type: "UNKNOWN_TYPE",
    });
    expect(result.success).toBe(false);
  });
});

describe("templateUpdateSchema", () => {
  it("should validate partial update", () => {
    const result = templateUpdateSchema.safeParse({
      id: "tpl-123",
      name: "Updated name",
    });
    expect(result.success).toBe(true);
  });

  it("should accept update without id (id is passed separately via API route)", () => {
    const result = templateUpdateSchema.safeParse({
      name: "Updated without id in body",
    });
    expect(result.success).toBe(true);
  });

  it("should validate isDefault toggle", () => {
    const result = templateUpdateSchema.safeParse({
      id: "tpl-123",
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });
});
