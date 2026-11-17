import { describe, it, expect } from "vitest";
import {
  calendarDays,
  validateEntry,
  validateFile,
  updateHR,
  attachmentPath,
} from "./domain";
describe("Inclusive calendar days", () => {
  it("counts same-day and leap-year leave", () => {
    expect(calendarDays("2026-11-17", "2026-11-17")).toBe(1);
    expect(calendarDays("2024-02-28", "2024-03-01")).toBe(3);
  });
  it("does not lose a day at Swiss DST changes", () => {
    expect(calendarDays("2026-03-28", "2026-03-30")).toBe(3);
    expect(calendarDays("2026-10-24", "2026-10-26")).toBe(3);
  });
  it("rejects reversed and invalid dates", () => {
    expect(() => calendarDays("2026-11-19", "2026-11-16")).toThrow();
    expect(() => calendarDays("", "2026-11-16")).toThrow();
  });
});
describe("Record and HR validation", () => {
  const leave = {
    title: "Recovery",
    visit: "visit-1",
    start: "2026-11-16",
    end: "2026-11-19",
    percentage: "50",
    status: "Not sent",
  };
  it("validates leave with inclusive dates and fractional incapacity", () =>
    expect(() => validateEntry("leave", leave)).not.toThrow());
  it("requires date sent and keeps diagnosis unmodified", () => {
    expect(() => updateHR(leave, "Sent", "")).toThrow();
    const changed = updateHR(
      { ...leave, diagnosis: "Exact Text Ä" },
      "Sent",
      "2026-11-17",
    );
    expect(changed.status).toBe("Sent");
    expect(changed.diagnosis).toBe("Exact Text Ä");
    expect(changed.sent).toBe("2026-11-17");
  });
  it("rejects invalid status, empty title and missing visit", () => {
    expect(() => updateHR(leave, "Emailed", "2026-11-17")).toThrow();
    expect(() => validateEntry("visit", { title: "" })).toThrow();
    expect(() => validateEntry("leave", { ...leave, visit: "" })).toThrow();
  });
  it("requires sent date during save too", () =>
    expect(() =>
      validateEntry("leave", { ...leave, status: "Acknowledged" }),
    ).toThrow());
  it("keeps strength and dose independent and accepts as needed", () => {
    const med = {
      title: "Example",
      strength: "5 mg",
      dose: "One tablet",
      frequency: "As needed",
    };
    expect(() => validateEntry("medicine", med)).not.toThrow();
    expect(med.strength).not.toBe(med.dose);
  });
});
describe("Attachments", () => {
  it("accepts supported readable documents", () =>
    expect(() =>
      validateFile({ type: "application/pdf", size: 1000 }),
    ).not.toThrow());
  it("rejects executable types, empty and oversized files", () => {
    expect(() => validateFile({ type: "text/html", size: 100 })).toThrow();
    expect(() => validateFile({ type: "image/png", size: 0 })).toThrow();
    expect(() =>
      validateFile({ type: "image/jpeg", size: 21 * 1024 * 1024 }),
    ).toThrow();
  });
  it("uses an owner-scoped path and disallows traversal", () => {
    expect(attachmentPath("user-a", "file-1", "application/pdf")).toBe(
      "user-a/file-1.pdf",
    );
    expect(() => attachmentPath("../other", "file", "image/png")).toThrow();
  });
});
