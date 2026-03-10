import {
  skillCreateSchema,
  skillSelfUpdateSchema,
  skillManagerUpdateSchema,
  objectiveCreateSchema,
  objectiveManagerUpdateSchema,
  objectiveSelfCommentSchema,
} from "@/lib/validators";

// ─── skillCreateSchema ───

describe("skillCreateSchema", () => {
  const valid = {
    name: "React",
    type: "TECHNICAL" as const,
    selfLevel: "INTERMEDIATE" as const,
    description: "Strong React skills",
    evidence: "https://cert.example.com",
  };

  it("should accept valid input with all fields", () => {
    expect(skillCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("should accept minimal input (name + type only)", () => {
    expect(skillCreateSchema.safeParse({ name: "React", type: "TECHNICAL" }).success).toBe(true);
  });

  it("should accept all skill types", () => {
    for (const type of ["TECHNICAL", "SOFT", "BEHAVIORAL", "OTHER"]) {
      expect(skillCreateSchema.safeParse({ name: "Skill", type }).success).toBe(true);
    }
  });

  it("should accept all skill levels", () => {
    for (const level of ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]) {
      expect(skillCreateSchema.safeParse({ name: "Skill", type: "TECHNICAL", selfLevel: level }).success).toBe(true);
    }
  });

  it("should accept null/empty selfLevel", () => {
    expect(skillCreateSchema.safeParse({ name: "Skill", type: "TECHNICAL", selfLevel: null }).success).toBe(true);
  });

  it("should accept empty string description and evidence", () => {
    expect(skillCreateSchema.safeParse({ name: "Skill", type: "TECHNICAL", description: "", evidence: "" }).success).toBe(true);
  });

  it("should reject empty name", () => {
    expect(skillCreateSchema.safeParse({ name: "", type: "TECHNICAL" }).success).toBe(false);
  });

  it("should reject name exceeding 100 chars", () => {
    expect(skillCreateSchema.safeParse({ name: "a".repeat(101), type: "TECHNICAL" }).success).toBe(false);
  });

  it("should reject invalid skill type", () => {
    expect(skillCreateSchema.safeParse({ name: "React", type: "INVALID" }).success).toBe(false);
  });

  it("should reject invalid skill level", () => {
    expect(skillCreateSchema.safeParse({ name: "React", type: "TECHNICAL", selfLevel: "MASTER" }).success).toBe(false);
  });

  it("should reject description exceeding 500 chars", () => {
    expect(skillCreateSchema.safeParse({ name: "React", type: "TECHNICAL", description: "a".repeat(501) }).success).toBe(false);
  });

  it("should reject evidence exceeding 500 chars", () => {
    expect(skillCreateSchema.safeParse({ name: "React", type: "TECHNICAL", evidence: "a".repeat(501) }).success).toBe(false);
  });
});

// ─── skillSelfUpdateSchema ───

describe("skillSelfUpdateSchema", () => {
  it("should accept valid self-assessment", () => {
    expect(skillSelfUpdateSchema.safeParse({ selfLevel: "ADVANCED" }).success).toBe(true);
  });

  it("should accept with optional evidence", () => {
    expect(skillSelfUpdateSchema.safeParse({ selfLevel: "EXPERT", evidence: "cert-link" }).success).toBe(true);
  });

  it("should accept empty evidence", () => {
    expect(skillSelfUpdateSchema.safeParse({ selfLevel: "BEGINNER", evidence: "" }).success).toBe(true);
  });

  it("should reject missing selfLevel", () => {
    expect(skillSelfUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("should reject invalid level", () => {
    expect(skillSelfUpdateSchema.safeParse({ selfLevel: "MASTER" }).success).toBe(false);
  });
});

// ─── skillManagerUpdateSchema ───

describe("skillManagerUpdateSchema", () => {
  it("should accept valid manager assessment", () => {
    for (const level of ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]) {
      expect(skillManagerUpdateSchema.safeParse({ managerLevel: level }).success).toBe(true);
    }
  });

  it("should reject missing managerLevel", () => {
    expect(skillManagerUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("should reject invalid level", () => {
    expect(skillManagerUpdateSchema.safeParse({ managerLevel: "GODLIKE" }).success).toBe(false);
  });

  it("should ignore extra fields (selfLevel not accepted)", () => {
    const result = skillManagerUpdateSchema.safeParse({ managerLevel: "EXPERT", selfLevel: "BEGINNER" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("selfLevel");
    }
  });
});

// ─── objectiveCreateSchema ───

describe("objectiveCreateSchema", () => {
  const valid = {
    title: "Improve code quality",
    description: "Reduce bug count by 50%",
    deadline: "2026-12-31",
  };

  it("should accept valid objective", () => {
    expect(objectiveCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("should accept with optional status and progress", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, status: "IN_PROGRESS", progress: 25 }).success).toBe(true);
  });

  it("should accept all valid statuses", () => {
    for (const status of ["IN_PROGRESS", "ACHIEVED", "PARTIALLY_ACHIEVED", "NOT_ACHIEVED", "CANCELLED"]) {
      expect(objectiveCreateSchema.safeParse({ ...valid, status }).success).toBe(true);
    }
  });

  it("should accept progress at boundary values (0, 100)", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: 0 }).success).toBe(true);
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: 100 }).success).toBe(true);
  });

  it("should accept null progress", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: null }).success).toBe(true);
  });

  it("should reject empty title", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("should reject title exceeding 200 chars", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, title: "a".repeat(201) }).success).toBe(false);
  });

  it("should reject empty description", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("should reject description exceeding 2000 chars", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, description: "a".repeat(2001) }).success).toBe(false);
  });

  it("should reject empty deadline", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, deadline: "" }).success).toBe(false);
  });

  it("should reject invalid status", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, status: "PENDING" }).success).toBe(false);
  });

  it("should reject progress > 100", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: 101 }).success).toBe(false);
  });

  it("should reject progress < 0", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: -1 }).success).toBe(false);
  });

  it("should reject non-integer progress", () => {
    expect(objectiveCreateSchema.safeParse({ ...valid, progress: 50.5 }).success).toBe(false);
  });
});

// ─── objectiveManagerUpdateSchema ───

describe("objectiveManagerUpdateSchema", () => {
  it("should accept partial updates (title only)", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ title: "Updated title" }).success).toBe(true);
  });

  it("should accept partial updates (status + progress)", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ status: "ACHIEVED", progress: 100 }).success).toBe(true);
  });

  it("should accept empty manager comment (clear)", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ managerComment: "" }).success).toBe(true);
  });

  it("should accept null manager comment", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ managerComment: null }).success).toBe(true);
  });

  it("should reject manager comment exceeding 2000 chars", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ managerComment: "a".repeat(2001) }).success).toBe(false);
  });

  it("should reject empty title if provided", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("should reject invalid status", () => {
    expect(objectiveManagerUpdateSchema.safeParse({ status: "DONE" }).success).toBe(false);
  });
});

// ─── objectiveSelfCommentSchema ───

describe("objectiveSelfCommentSchema", () => {
  it("should accept valid comment", () => {
    expect(objectiveSelfCommentSchema.safeParse({ selfComment: "I completed the task" }).success).toBe(true);
  });

  it("should accept empty comment", () => {
    expect(objectiveSelfCommentSchema.safeParse({ selfComment: "" }).success).toBe(true);
  });

  it("should reject comment exceeding 2000 chars", () => {
    expect(objectiveSelfCommentSchema.safeParse({ selfComment: "a".repeat(2001) }).success).toBe(false);
  });

  it("should reject missing selfComment", () => {
    expect(objectiveSelfCommentSchema.safeParse({}).success).toBe(false);
  });
});
