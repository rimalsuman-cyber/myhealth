export type Kind =
  "visit" | "medicine" | "leave" | "doctor" | "attachment" | "reminder";
export type Entry = {
  id: string;
  kind: Kind;
  data: Record<string, string>;
  created_at: string;
  user_id?: string;
};
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(
    new Date(),
  );
export function calendarDays(start: string, end: string) {
  const a = Date.parse(start + "T00:00:00Z"),
    b = Date.parse(end + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    new Date(a).toISOString().slice(0, 10) !== start ||
    new Date(b).toISOString().slice(0, 10) !== end ||
    b < a
  )
    throw new Error("End date must be on or after start date.");
  return Math.round((b - a) / 86400000) + 1;
}
export function validateFile(file: Pick<File, "type" | "size">) {
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    )
  )
    throw new Error("Choose a JPG, PNG, WebP or PDF.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Maximum file size is 20 MB.");
  if (!file.size) throw new Error("The file is empty.");
}
export function validateEntry(kind: Kind, d: Record<string, string>) {
  if (!d.title?.trim()) throw new Error("Please enter a name or title.");
  if (kind === "visit" && !d.date) throw new Error("Visit date is required.");
  if (
    kind === "medicine" &&
    d.times &&
    d.frequency !== "As needed" &&
    !d.times
      .split(",")
      .every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim()))
  )
    throw new Error("Use 24-hour times, for example 08:00, 20:00.");
  if (kind === "leave") {
    calendarDays(d.start, d.end);
    if (+d.percentage < 1 || +d.percentage > 100)
      throw new Error("Work incapacity must be between 1 and 100%.");
    if (!d.visit) throw new Error("Select a visit.");
    if (d.status !== "Not sent" && !d.sent)
      throw new Error("Enter the date sent.");
  }
  if (kind === "medicine" && d.end && d.start && d.end < d.start)
    throw new Error("End date must be on or after start date.");
}
export function updateHR(
  d: Record<string, string>,
  status: string,
  sent: string,
): Record<string, string> {
  if (!["Not sent", "Sent", "Acknowledged"].includes(status))
    throw new Error("Invalid status");
  if (status !== "Not sent" && !sent) throw new Error("Enter the date sent.");
  return { ...d, status, sent: status === "Not sent" ? "" : sent };
}
export function attachmentPath(user: string, id: string, type: string) {
  if (!/^[a-z0-9-]+$/i.test(user) || !/^[a-z0-9-]+$/i.test(id))
    throw new Error("Invalid path");
  return `${user}/${id}.${type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"}`;
}
const demo = (id: string, kind: Kind, data: Record<string, string>): Entry => ({
  id,
  kind,
  data,
  created_at: "2026-11-17T08:00:00Z",
});
export const sample: Entry[] = [
  demo("doctor-1", "doctor", {
    title: "Dr. Anna Keller",
    specialty: "General practitioner",
    clinic: "Seefeld Medical Practice",
    address: "Seefeldstrasse 45, Zürich",
  }),
  demo("doctor-2", "doctor", {
    title: "Dr. Lukas Weber",
    specialty: "Dermatologist",
    clinic: "Hautzentrum Zürich",
  }),
  demo("visit-1", "visit", {
    title: "Seasonal check-in",
    date: "2026-11-16",
    time: "09:30",
    doctor: "doctor-1",
    specialty: "General practitioner",
    clinic: "Seefeld Medical Practice",
    reason: "Sore throat and fatigue",
    diagnosis: "Upper respiratory tract infection",
    advice: "Rest and stay hydrated. Follow the prescribed instructions.",
    followup: "2026-11-23",
    notes: "Fictional sample record.",
  }),
  demo("visit-2", "visit", {
    title: "Skin consultation",
    date: "2026-11-05",
    time: "14:00",
    doctor: "doctor-2",
    diagnosis: "Contact dermatitis",
    reason: "Dry skin on hands",
    clinic: "Hautzentrum Zürich",
  }),
  demo("visit-3", "visit", {
    title: "Follow-up appointment",
    date: "2026-11-23",
    time: "10:00",
    doctor: "doctor-1",
    clinic: "Seefeld Medical Practice",
    reason: "Recovery check-in",
  }),
  demo("medicine-1", "medicine", {
    title: "Example medicine A",
    strength: "5 mg",
    dose: "One tablet",
    form: "Tablet",
    frequency: "Daily",
    times: "08:00",
    start: "2026-11-16",
    end: "2026-11-22",
    status: "Active",
    visit: "visit-1",
    doctor: "doctor-1",
    instructions: "Fictional example only — not a prescription.",
  }),
  demo("medicine-2", "medicine", {
    title: "Example skin cream",
    strength: "1%",
    dose: "As prescribed",
    form: "Cream",
    frequency: "As needed",
    start: "2026-11-05",
    status: "Active",
    visit: "visit-2",
    doctor: "doctor-2",
    instructions: "Fictional example only.",
  }),
  demo("leave-1", "leave", {
    title: "Recovery leave",
    visit: "visit-1",
    start: "2026-11-16",
    end: "2026-11-19",
    percentage: "100",
    status: "Not sent",
    return: "2026-11-20",
    remind: "2026-11-17",
  }),
];
