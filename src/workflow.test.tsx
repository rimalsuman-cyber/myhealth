// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
afterEach(cleanup);
describe("Demo workflows", () => {
  it("adds multiple later PDFs, replaces one, edits its caption and deletes it without recreating the visit", async () => {
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL() {
          return "blob:test-" + Math.random();
        }
        static revokeObjectURL() {}
      },
    );
    const u = userEvent.setup();
    render(<App />);
    await u.click(
      screen.getAllByRole("button", { name: /Seasonal check-in/ })[0],
    );
    await u.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Upload document",
      }),
    );
    let dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText(/Name \/ title/),
      "Certificates",
    );
    await u.selectOptions(
      within(dialog).getByLabelText("Category"),
      "Sick-leave certificate",
    );
    await u.upload(within(dialog).getByLabelText("Choose files"), [
      new File(["%PDF-1.4 first"], "first.pdf", { type: "application/pdf" }),
      new File(["%PDF-1.4 second"], "second.pdf", { type: "application/pdf" }),
    ]);
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await u.click(
      screen.getAllByRole("button", { name: /Seasonal check-in/ })[0],
    );
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("first.pdf")).toBeTruthy();
    expect(within(dialog).getByText("second.pdf")).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: /first.pdf/ }));
    await u.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }),
    );
    dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Choose files") as HTMLInputElement)
        .multiple,
    ).toBe(false);
    await u.type(
      within(dialog).getByLabelText("Caption"),
      "Updated certificate",
    );
    await u.upload(
      within(dialog).getByLabelText("Choose files"),
      new File(["%PDF-1.4 replacement"], "replacement.pdf", {
        type: "application/pdf",
      }),
    );
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await u.click(
      screen.getAllByRole("button", { name: /Seasonal check-in/ })[0],
    );
    await u.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /first.pdf/,
      }),
    );
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Updated certificate")).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: "Delete" }));
    const dialogs = screen.getAllByRole("dialog");
    await u.click(
      within(dialogs[dialogs.length - 1]).getByRole("button", {
        name: "Delete",
      }),
    );
    await u.click(
      screen.getAllByRole("button", { name: /Seasonal check-in/ })[0],
    );
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("first.pdf")).toBeNull();
    expect(within(dialog).getByText("second.pdf")).toBeTruthy();
    vi.unstubAllGlobals();
  });
  it("saves a visit, preserves diagnosis exactly, finds and edits it later", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Add visit" }));
    let dialog = screen.getByRole("dialog");
    await u.type(
      within(dialog).getByLabelText(/Name \/ title/),
      "Annual review",
    );
    await u.type(
      within(dialog).getByLabelText("Diagnosis"),
      "My exact diagnosis Ä",
    );
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    await screen.findByText("Annual review", { selector: ".record-title" });
    await u.type(screen.getByPlaceholderText("Search your diary…"), "Annual");
    await u.click(screen.getAllByRole("button", { name: /Annual review/ })[0]);
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("My exact diagnosis Ä")).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: "Edit" }));
    dialog = screen.getByRole("dialog");
    const title = within(dialog).getByLabelText(/Name \/ title/);
    await u.clear(title);
    await u.type(title, "Annual review updated");
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Annual review updated", {
        selector: ".record-title",
      }),
    ).toBeTruthy();
  });
  it("records sent status only after a deliberate save", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: /Recovery leave/ }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("4 calendar days")).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: "Mark as sent" }));
    dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Status") as HTMLSelectElement).value,
    ).toBe("Sent");
    expect(within(dialog).getByText(/does not send an email/)).toBeTruthy();
    await u.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Sent", { selector: ".badge" }),
    ).toBeTruthy();
  });
  it("opens later uploads on a saved medicine and allows multiple file selection", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: /Example medicine A/ }));
    await u.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Upload document",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByLabelText("Linked medicine") as HTMLSelectElement)
        .value,
    ).toBe("medicine-1");
    const files = within(dialog).getByLabelText(
      "Choose files",
    ) as HTMLInputElement;
    expect(files.multiple).toBe(true);
    expect(within(dialog).getByLabelText("Caption")).toBeTruthy();
    expect(
      within(dialog).getByLabelText("Take photo").getAttribute("capture"),
    ).toBe("environment");
  });
  it("blocks deletion of a parent with linked health records", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(
      screen.getAllByRole("button", { name: /Seasonal check-in/ })[0],
    );
    await u.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    const dialogs = screen.getAllByRole("dialog");
    await u.click(
      within(dialogs[dialogs.length - 1]).getByRole("button", {
        name: "Delete",
      }),
    );
    expect(
      await screen.findByText("Remove linked records first."),
    ).toBeTruthy();
  });
});
