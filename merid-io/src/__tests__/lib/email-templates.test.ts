/**
 * Tests for src/lib/email-templates.ts — HTML email template builders
 */

import {
  buildTenantWelcomeHtml,
  buildSignupRejectionHtml,
} from "@/lib/email-templates";

describe("buildTenantWelcomeHtml", () => {
  it("should contain the reset URL with token", () => {
    const html = buildTenantWelcomeHtml(
      "Jean",
      "Acme Corp",
      "abc123token",
      "jean@acme.com"
    );

    expect(html).toContain("/reset-password?token=abc123token");
    expect(html).toContain("Bienvenue sur Meridio");
    expect(html).toContain("Jean");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("jean@acme.com");
    expect(html).toContain("24 heures");
  });

  it("should escape HTML in user-supplied values", () => {
    const html = buildTenantWelcomeHtml(
      '<script>alert("xss")</script>',
      "Comp<b>any",
      "token",
      "test@test.com"
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>any");
    expect(html).toContain("&lt;b&gt;any");
  });

  it("should include Meridio branding", () => {
    const html = buildTenantWelcomeHtml("A", "B", "t", "e@e.com");
    expect(html).toContain("Halley-Technologies");
    expect(html).toContain("Meridio");
  });
});

describe("buildSignupRejectionHtml", () => {
  it("should contain rejection message", () => {
    const html = buildSignupRejectionHtml("Marie", "Test Corp");

    expect(html).toContain("Marie");
    expect(html).toContain("Test Corp");
    expect(html).toContain("pas en mesure de l'accepter");
    expect(html).toContain("Nous contacter");
  });

  it("should include admin notes when provided", () => {
    const html = buildSignupRejectionHtml(
      "Pierre",
      "BigCo",
      "Votre domaine ne correspond pas"
    );

    expect(html).toContain("Commentaire");
    expect(html).toContain("Votre domaine ne correspond pas");
  });

  it("should not include notes block when notes are null", () => {
    const html = buildSignupRejectionHtml("Ana", "SmallCo", null);

    expect(html).not.toContain("Commentaire");
  });

  it("should escape HTML in notes", () => {
    const html = buildSignupRejectionHtml(
      "Bob",
      "Co",
      '<img src=x onerror=alert(1)>'
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
