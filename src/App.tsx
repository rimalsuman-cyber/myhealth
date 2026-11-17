import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Heart,
  Home,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Sun,
  Trash2,
  Upload,
  X,
  Pill,
  Bell,
  Camera,
  LogOut,
} from "lucide-react";
import {
  sample,
  today,
  calendarDays,
  validateEntry,
  validateFile,
  updateHR,
  type Entry,
  type Kind,
} from "./domain";
import {
  supabase,
  loadEntries,
  saveEntry,
  removeEntry,
  uploadFile,
  fileURL,
} from "./backend";
import { de } from "./i18n";
import "./style.css";
import { optimizePhoto } from "./photos";
type Field = [string, string, string?, string[]?];
const fields: Record<Kind, Field[]> = {
  visit: [
    ["title", "Name / title"],
    ["date", "Visit date", "date"],
    ["time", "Time", "time"],
    ["doctor", "Doctor", "doctor"],
    ["reason", "Reason & symptoms", "textarea"],
    ["diagnosis", "Diagnosis", "textarea"],
    ["specialty", "Specialty"],
    ["clinic", "Clinic / hospital"],
    ["contact", "Contact"],
    ["address", "Address"],
    ["advice", "Advice & treatment instructions", "textarea"],
    ["followup", "Follow-up date", "date"],
    ["notes", "Notes", "textarea"],
  ],
  medicine: [
    ["title", "Name / title"],
    ["strength", "Strength"],
    ["dose", "Dose"],
    [
      "form",
      "Form",
      "select",
      ["Tablet", "Cream", "Drops", "Injection", "Other"],
    ],
    ["frequency", "Frequency", "select", ["Daily", "As needed", "Custom"]],
    ["times", "Administration times"],
    ["start", "Start date", "date"],
    ["end", "End date", "date"],
    ["status", "Status", "select", ["Active", "Completed", "Stopped"]],
    ["visit", "Linked visit", "visit"],
    ["doctor", "Doctor", "doctor"],
    ["duration", "Duration"],
    ["instructions", "Prescription instructions", "textarea"],
    ["notes", "Notes", "textarea"],
  ],
  leave: [
    ["title", "Name / title"],
    ["visit", "Linked visit", "visit"],
    ["start", "Start date", "date"],
    ["end", "End date", "date"],
    ["percentage", "Work incapacity (%)", "number"],
    ["status", "Status", "select", ["Not sent", "Sent", "Acknowledged"]],
    ["sent", "Date sent", "date"],
    ["method", "Submission method"],
    ["recipient", "Recipient"],
    ["return", "Return-to-work date", "date"],
    ["remind", "HR reminder date", "date"],
    ["extends", "Extends sick leave", "leave"],
    ["notes", "Notes", "textarea"],
  ],
  doctor: [
    ["title", "Name / title"],
    ["specialty", "Specialty"],
    ["clinic", "Clinic / hospital"],
    ["contact", "Contact"],
    ["address", "Address"],
    ["notes", "Notes", "textarea"],
  ],
  attachment: [
    ["title", "Name / title"],
    [
      "category",
      "Category",
      "select",
      [
        "Symptoms",
        "Medicine packaging",
        "Prescription",
        "Sick-leave certificate",
        "Submission proof",
        "Report",
        "Other",
      ],
    ],
    ["date", "Date", "date"],
    ["visit", "Linked visit", "visit"],
    ["medicine", "Linked medicine", "medicine"],
    ["leave", "Linked sick leave", "leave"],
    ["caption", "Caption", "textarea"],
  ],
  reminder: [
    ["title", "Name / title"],
    ["date", "Reminder date", "date"],
    ["time", "Time", "time"],
    ["visit", "Linked visit", "visit"],
    ["medicine", "Linked medicine", "medicine"],
    ["notes", "Notes", "textarea"],
  ],
};
const kindName: Record<Kind, string> = {
  visit: "Visit",
  medicine: "Medicine",
  leave: "Sick leave",
  doctor: "Doctor",
  attachment: "Document",
  reminder: "Reminders",
};
const icons = {
  visit: Stethoscope,
  medicine: Pill,
  leave: ClipboardList,
  doctor: Stethoscope,
  attachment: FileText,
  reminder: Bell,
};
const nav = [
  ["Home", Home],
  ["Visits", CalendarDays],
  ["Medicines", Pill],
  ["Documents", FileText],
  ["More", SlidersHorizontal],
] as const;
export function App() {
  const [lang, setLang] = useState<"en" | "de">("en"),
    [dark, setDark] = useState(false),
    [page, setPage] = useState("Home"),
    [entries, setEntries] = useState<Entry[]>(supabase ? [] : sample),
    [user, setUser] = useState<string | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [doctorFilter, setDoctorFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [diagnosis, setDiagnosis] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [filters, setFilters] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null),
    [detail, setDetail] = useState<Entry | null>(null),
    [deleting, setDeleting] = useState<Entry | null>(null),
    [busy, setBusy] = useState(false),
    [files, setFiles] = useState<File[]>([]),
    [optimize, setOptimize] = useState(true),
    [progress, setProgress] = useState(""),
    [formError, setFormError] = useState(""),
    [preview, setPreview] = useState<{
      url: string;
      type: string;
      title: string;
    } | null>(null),
    [exporting, setExporting] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [privateDetails, setPrivateDetails] = useState(false),
    [hrOnly, setHrOnly] = useState(false),
    [notify, setNotify] = useState(false),
    [accountDelete, setAccountDelete] = useState(false);
  const [authMode, setAuthMode] = useState("Sign in"),
    [authMessage, setAuthMessage] = useState("");
  const sessionVersion = useRef(0);
  const blobs = useRef(new Map<string, string>()),
    fired = useRef(new Set<string>());
  const t = (s: string) => (lang === "de" ? de[s] || s : s);
  const fmt = (s?: string) =>
    s
      ? new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Europe/Zurich",
        })
          .format(new Date(s.length === 10 ? s + "T12:00:00Z" : s))
          .replaceAll("/", ".")
      : "";
  const doctors = entries.filter((e) => e.kind === "doctor");
  const doctorName = (id: string) =>
    doctors.find((d) => d.id === id)?.data.title || id || "";
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const version = sessionVersion.current;
      const loaded = await loadEntries();
      if (version === sessionVersion.current) setEntries(loaded);
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      sessionVersion.current++;
      setUser(session?.user.id || null);
      if (event === "PASSWORD_RECOVERY") setAuthMode("Update password");
      if (!session) {
        clearMemory();
        setLoading(false);
      } else setTimeout(() => void refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [lang, dark]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    if (!notify) return;
    const timer = setInterval(() => {
      const now = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      entries.forEach((e) => {
        const d = e.data;
        let due = false;
        if (e.kind === "reminder")
          due =
            d.date === now.slice(0, 10) &&
            (!d.time || d.time <= now.slice(11, 16));
        if (e.kind === "leave")
          due = d.remind === now.slice(0, 10) && d.status === "Not sent";
        if (e.kind === "visit")
          due =
            (d.date === now.slice(0, 10) && d.time === now.slice(11, 16)) ||
            d.followup === now.slice(0, 10);
        if (e.kind === "medicine")
          due =
            d.status === "Active" &&
            d.frequency !== "As needed" &&
            d.start <= now.slice(0, 10) &&
            (!d.end || d.end >= now.slice(0, 10)) &&
            d.times
              ?.split(",")
              .map((s) => s.trim())
              .includes(now.slice(11, 16));
        const key = e.id + now.slice(0, e.kind === "medicine" ? 16 : 10);
        if (due && !fired.current.has(key)) {
          fired.current.add(key);
          new Notification(t("Health reminder"), {
            body: t("Open your diary to review a reminder."),
          });
        }
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [notify, entries, lang]);
  function clearMemory() {
    blobs.current.forEach(URL.revokeObjectURL);
    blobs.current.clear();
    setEntries([]);
    setDetail(null);
    setEdit(null);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setQuery("");
    setSelected([]);
    setExporting(false);
    setNotify(false);
    fired.current.clear();
  }
  function add(kind: Kind, patch: Record<string, string> = {}) {
    setFormError("");
    setFiles([]);
    setDetail(null);
    setEdit({
      id: crypto.randomUUID(),
      kind,
      created_at: new Date().toISOString(),
      data: {
        title: "",
        ...(["visit", "attachment", "reminder"].includes(kind)
          ? { date: today() }
          : {}),
        ...(kind === "medicine"
          ? {
              start: today(),
              status: "Active",
              frequency: "Daily",
              form: "Tablet",
            }
          : {}),
        ...(kind === "leave"
          ? { start: today(), status: "Not sent", percentage: "100" }
          : {}),
        ...(kind === "attachment" ? { category: "Report" } : {}),
        ...patch,
      },
    });
  }
  async function persist(e: Entry) {
    validateEntry(e.kind, e.data);
    if (supabase && user) await saveEntry(e, user);
    setEntries((prev) => [e, ...prev.filter((r) => r.id !== e.id)]);
    setToast(t("Saved successfully"));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    setBusy(true);
    setFormError("");
    try {
      const d = {
        ...edit.data,
        ...Object.fromEntries(new FormData(event.currentTarget).entries()),
      } as Record<string, string>;
      if (edit.kind === "leave")
        Object.assign(d, updateHR(d, d.status, d.sent));
      validateEntry(edit.kind, d);
      if (edit.kind === "medicine" && d.frequency === "As needed") d.times = "";
      if (edit.kind === "attachment" && files.length) {
        files.forEach(validateFile);
        for (let i = 0; i < files.length; i++) {
          const file = optimize
              ? await optimizePhoto(files[i], d.category)
              : files[i],
            id = edit.data.filename ? edit.id : crypto.randomUUID(),
            objectId = crypto.randomUUID();
          setProgress(`${i + 1} / ${files.length}`);
          const path =
            supabase && user ? await uploadFile(file, user, objectId) : "";
          const item: Entry = {
            ...edit,
            id,
            data: {
              ...d,
              title: files.length > 1 ? file.name : d.title,
              path,
              mime: file.type,
              filename: file.name,
              size: String(file.size),
            },
          };
          try {
            await persist(item);
          } catch (err) {
            if (supabase && path)
              await supabase.storage.from("health-files").remove([path]);
            throw err;
          }
          if (!supabase) {
            const old = blobs.current.get(id);
            if (old) URL.revokeObjectURL(old);
            blobs.current.set(id, URL.createObjectURL(file));
          } else if (edit.data.path) {
            const cleanup = await supabase.storage
              .from("health-files")
              .remove([edit.data.path]);
            if (cleanup.error)
              setToast(
                lang === "de"
                  ? "Gespeichert. Alte Datei konnte nicht entfernt werden."
                  : "Saved. Old file cleanup failed; retry from Storage.",
              );
          }
          setFiles(files.slice(i + 1));
        }
      } else {
        if (edit.kind === "attachment" && !edit.data.filename)
          throw new Error(t("Choose files"));
        await persist({ ...edit, data: d });
      }
      setEdit(null);
      setFiles([]);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? t(err.message)
          : t("Something went wrong. Please try again."),
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      if (
        entries.some(
          (e) =>
            e.id !== deleting.id &&
            ["doctor", "visit", "medicine", "leave", "extends"].some(
              (key) => e.data[key] === deleting.id,
            ),
        )
      ) {
        setToast(
          lang === "de"
            ? "Zuerst verknüpfte Einträge entfernen."
            : "Remove linked records first.",
        );
        setDeleting(null);
        return;
      }
      if (supabase) await removeEntry(deleting);
      if (blobs.current.has(deleting.id)) {
        URL.revokeObjectURL(blobs.current.get(deleting.id)!);
        blobs.current.delete(deleting.id);
      }
      setEntries((v) => v.filter((x) => x.id !== deleting.id));
      setDetail(null);
      setDeleting(null);
      setToast(t("Record deleted"));
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }
  async function openFile(e: Entry, download = false) {
    try {
      const url = supabase
        ? await fileURL(e.data.path)
        : blobs.current.get(e.id);
      if (!url) throw new Error();
      if (download) {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const blob = URL.createObjectURL(await response.blob());
        const a = document.createElement("a");
        a.href = blob;
        a.download = e.data.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(blob), 1000);
      } else {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error();
        setPreview({
          url: URL.createObjectURL(await response.blob()),
          type: e.data.mime,
          title: e.data.title,
        });
      }
    } catch {
      setError(t("Something went wrong. Please try again."));
    }
  }
  function exportJSON() {
    const chosen = entries.filter(
      (e) => selected.includes(e.id) && (!hrOnly || e.kind === "leave"),
    );
    const data = chosen.map((e) => ({
      id: e.id,
      kind: e.kind,
      data: exportData(e),
    }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              exported_at: new Date().toISOString(),
              records: data,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    a.download = "health-diary-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportData(e: Entry) {
    const omit = hrOnly
      ? [
          "title",
          "notes",
          "diagnosis",
          "reason",
          "advice",
          "visit",
          "recipient",
          "extends",
          "doctor",
          "remind",
        ]
      : privateDetails
        ? []
        : [
            "notes",
            "advice",
            "reason",
            "instructions",
            "caption",
            "contact",
            "address",
          ];
    return Object.fromEntries(
      Object.entries(e.data).filter(
        ([k, v]) => v && !omit.includes(k) && !["path"].includes(k),
      ),
    );
  }
  async function exportPDF() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(20);
    doc.text(hrOnly ? t("Sick leave") : t("My Health Diary"), 16, y);
    y += 14;
    doc.setFontSize(10);
    for (const e of entries.filter(
      (x) => selected.includes(x.id) && (!hrOnly || x.kind === "leave"),
    )) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(hrOnly ? t("Sick leave") : e.data.title, 16, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      for (const [key, value] of Object.entries(exportData(e))) {
        const label = fields[e.kind].find((f) => f[0] === key)?.[1] || key;
        const val = [
          "visit",
          "medicine",
          "doctor",
          "leave",
          "extends",
        ].includes(key)
          ? entries.find((x) => x.id === value)?.data.title || value
          : value;
        for (const line of doc.splitTextToSize(`${t(label)}: ${val}`, 175)) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 16, y);
          y += 5;
        }
      }
      y += 8;
    }
    doc.save(hrOnly ? "sick-leave.pdf" : "health-diary.pdf");
  }
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      email = String(f.get("email")),
      password = String(f.get("password"));
    setBusy(true);
    setAuthMessage("");
    try {
      const result =
        authMode === "Create account"
          ? await supabase!.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: location.origin },
            })
          : authMode === "Reset password"
            ? await supabase!.auth.resetPasswordForEmail(email, {
                redirectTo: location.origin,
              })
            : authMode === "Update password"
              ? await supabase!.auth.updateUser({ password })
              : await supabase!.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setAuthMessage(
        lang === "de"
          ? "Erfolgreich. Prüfen Sie ggf. Ihr E-Mail-Postfach."
          : "Success. Check your inbox if email confirmation is required.",
      );
      if (authMode === "Update password") setAuthMode("Sign in");
    } catch {
      setAuthMessage(
        lang === "de"
          ? "Anmeldung fehlgeschlagen. Prüfen Sie Ihre Angaben und versuchen Sie es erneut."
          : "Request failed. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = entries.filter(
    (e) => e.kind === "medicine" && e.data.status === "Active",
  );
  const leaves = entries.filter((e) => e.kind === "leave");
  const pending = leaves.filter((e) => e.data.status === "Not sent");
  const current = leaves.find(
    (e) => e.data.start <= today() && e.data.end >= today(),
  );
  const upcoming = entries
    .filter((e) => e.kind === "visit" && e.data.date >= today())
    .sort((a, b) => a.data.date.localeCompare(b.data.date));
  const latest = entries
    .filter((e) => e.kind === "visit" && e.data.date <= today())
    .sort((a, b) => b.data.date.localeCompare(a.data.date))[0];
  const matches = (e: Entry) => {
    const d = e.data,
      date = d.date || d.start || e.created_at.slice(0, 10);
    return (
      (!query ||
        [...Object.values(d), doctorName(d.doctor)]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!doctorFilter || d.doctor === doctorFilter) &&
      (!typeFilter || e.kind === typeFilter) &&
      (!diagnosis ||
        d.diagnosis?.toLowerCase().includes(diagnosis.toLowerCase())) &&
      (!from || date >= from) &&
      (!until || date <= until)
    );
  };
  const list = entries
    .filter(
      (e) =>
        e.kind ===
          (page === "Visits"
            ? "visit"
            : page === "Medicines"
              ? "medicine"
              : page === "Documents"
                ? "attachment"
                : page === "Sick leave"
                  ? "leave"
                  : page === "Doctors"
                    ? "doctor"
                    : page === "Reminders"
                      ? "reminder"
                      : e.kind) &&
        (page === "Home" ? !["doctor", "attachment"].includes(e.kind) : true) &&
        matches(e),
    )
    .sort((a, b) =>
      (b.data.date || b.data.start || b.created_at).localeCompare(
        a.data.date || a.data.start || a.created_at,
      ),
    );
  function renderField([key, label, type = "text", options]: Field) {
    const value = edit!.data[key] || "";
    if (
      edit!.kind === "medicine" &&
      key === "times" &&
      edit!.data.frequency === "As needed"
    )
      return null;
    const required =
      key === "title" ||
      (edit!.kind === "visit" && key === "date") ||
      (edit!.kind === "leave" &&
        ["visit", "start", "end", "percentage"].includes(key));
    const common = {
      name: key,
      id: "field-" + key,
      required,
      defaultValue: value,
    };
    return (
      <label
        className={type === "textarea" ? "wide" : ""}
        key={key}
        htmlFor={"field-" + key}
      >
        {t(label)}
        {required && <span className="required"> *</span>}
        {["doctor", "visit", "medicine", "leave"].includes(type) ? (
          <select {...common}>
            <option value="">{t("Select…")}</option>
            {entries
              .filter((e) => e.kind === type && e.id !== edit!.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.data.title}
                  {e.data.date ? " · " + fmt(e.data.date) : ""}
                </option>
              ))}
          </select>
        ) : type === "select" ? (
          <select
            {...common}
            onChange={
              key === "frequency"
                ? (e) =>
                    setEdit({
                      ...edit!,
                      data: { ...edit!.data, frequency: e.target.value },
                    })
                : undefined
            }
          >
            {options!.map((v) => (
              <option key={v} value={v}>
                {t(v)}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea {...common} rows={3} />
        ) : (
          <input
            {...common}
            type={type}
            onChange={
              edit!.kind === "leave" && ["start", "end"].includes(key)
                ? (event) =>
                    setEdit({
                      ...edit!,
                      data: { ...edit!.data, [key]: event.target.value },
                    })
                : undefined
            }
            min={type === "number" ? 1 : undefined}
            max={type === "number" ? 100 : undefined}
            placeholder={key === "times" ? "08:00, 20:00" : undefined}
          />
        )}
      </label>
    );
  }
  function card(e: Entry) {
    const Icon = icons[e.kind];
    return (
      <button className="record" key={e.id} onClick={() => setDetail(e)}>
        <span className={"record-icon " + e.kind}>
          <Icon size={21} />
        </span>
        <span className="record-content">
          <span className="record-title">{e.data.title}</span>
          <span className="muted">
            {e.kind === "visit"
              ? doctorName(e.data.doctor) || e.data.clinic
              : e.kind === "medicine"
                ? [e.data.strength, e.data.dose, t(e.data.frequency)]
                    .filter(Boolean)
                    .join(" · ")
                : e.kind === "leave"
                  ? `${fmt(e.data.start)} – ${fmt(e.data.end)} · ${calendarDays(e.data.start, e.data.end)} ${t("calendar days")}`
                  : t(e.data.category) || e.data.specialty || fmt(e.data.date)}
          </span>
          {e.kind === "visit" && e.data.diagnosis && (
            <span className="diagnosis">{e.data.diagnosis}</span>
          )}
        </span>
        <span className="record-end">
          {e.data.status ? (
            <span
              className={
                "badge " + (e.data.status === "Not sent" ? "amber" : "")
              }
            >
              {t(e.data.status)}
            </span>
          ) : (
            <span>{fmt(e.data.date)}</span>
          )}
          <ChevronRight size={17} />
        </span>
      </button>
    );
  }
  const modal = (
    children: React.ReactNode,
    close: () => void,
    wide = false,
  ) => (
    <Modal close={close} wide={wide} closeLabel={t("Close")}>
      {children}
    </Modal>
  );
  if (supabase && (!user || authMode === "Update password"))
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-mark">
            <Heart />
          </div>
          <h1>{t("My Health Diary")}</h1>
          <p className="muted">{t("Your health, thoughtfully organized.")}</p>
          <h2>{t(authMode)}</h2>
          <form onSubmit={authenticate}>
            {authMode !== "Update password" && (
              <label>
                {t("Email")}
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {authMode !== "Reset password" && (
              <label>
                {t("Password")}
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete={
                    authMode === "Sign in" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {t(busy ? "Saving…" : authMode)}
            </button>
          </form>
          <p role="status">{authMessage}</p>
          <div className="auth-options">
            {["Sign in", "Create account", "Reset password"]
              .filter((x) => x !== authMode)
              .map((x) => (
                <button
                  className="text-button"
                  key={x}
                  onClick={() => setAuthMode(x)}
                >
                  {t(x)}
                </button>
              ))}
          </div>
          <button
            className="text-button"
            onClick={() => setLang(lang === "en" ? "de" : "en")}
          >
            English / Deutsch
          </button>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Home");
          }}
        >
          <span className="brand-mark">
            <Heart size={23} />
          </span>
          <span>
            My Health<span className="brand-sub">DIARY</span>
          </span>
        </a>
        <div className="nav-label">
          {t("Your personal space for better organization.")}
        </div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                setPage(label);
                setQuery("");
                setTypeFilter("");
              }}
            >
              <Icon size={20} />
              {t(label)}
              {label === "Home" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-links">
          <span className="nav-label">{t("Manage your care")}</span>
          {[
            ["Sick leave", ClipboardList],
            ["Doctors", Stethoscope],
            ["Reminders", Bell],
          ].map(([label, Icon]) => {
            const I = Icon as typeof Bell;
            return (
              <button
                key={String(label)}
                className={page === label ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setPage(String(label));
                  setQuery("");
                }}
              >
                <I size={19} />
                {t(String(label))}
                {label === "Sick leave" && pending.length > 0 && (
                  <span className="count">{pending.length}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="privacy-card">
          <ShieldCheck size={23} />
          <strong>{t("Private by design")}</strong>
          <p>{t("Your personal space for better organization.")}</p>
          <button onClick={() => setPage("More")}>
            {t("Privacy")} <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-foot">
          <span className="avatar">{supabase ? "M" : "D"}</span>
          <div>
            <strong>{supabase ? t("My Health Diary") : t("Demo mode")}</strong>
            <small>{supabase ? t("Account") : t("Fictional profile")}</small>
          </div>
          <button
            className="icon-btn"
            aria-label={t("Settings & privacy")}
            onClick={() => setPage("More")}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t("My Health Diary")}
            <ChevronRight size={14} />
            <strong>{t(page)}</strong>
          </div>
          <div className="top-actions">
            <button
              className="language"
              onClick={() => setLang(lang === "en" ? "de" : "en")}
            >
              {lang === "en" ? "EN" : "DE"}
            </button>
            <button
              className="icon-btn"
              aria-label={t(dark ? "Light mode" : "Dark mode")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-btn"
              aria-label={t("Reminders")}
              onClick={() => setPage("Reminders")}
            >
              <Bell size={20} />
              {pending.length > 0 && <i />}
            </button>
            <span className="avatar">{supabase ? "M" : "D"}</span>
          </div>
        </header>
        <main>
          {!supabase && (
            <div className="demo-banner">
              <span className="demo-dot" />
              <strong>{t("Demo mode")}</strong>
              <span>
                {t(
                  "Fictional data. Changes and files stay in memory and reset on refresh.",
                )}
              </span>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "Home"
                  ? new Intl.DateTimeFormat(lang === "de" ? "de-CH" : "en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/Zurich",
                    }).format(new Date())
                  : t("My Health Diary")}
              </p>
              <h1>
                {t(
                  page === "Home"
                    ? "Your health at a glance"
                    : page === "More"
                      ? "Settings & privacy"
                      : page,
                )}
              </h1>
              <p className="subtitle">
                {t(
                  page === "Home"
                    ? "A little clarity. A little peace of mind."
                    : "Your health, thoughtfully organized.",
                )}
              </p>
            </div>
            <button
              className="secondary export-btn"
              onClick={() => {
                setSelected(
                  entries.filter((e) => e.kind === "visit").map((e) => e.id),
                );
                setExporting(true);
              }}
            >
              <ArrowDownToLine size={17} />
              {t("Export")}
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => (supabase ? refresh() : setError(""))}>
                {t("Retry")}
              </button>
            </div>
          )}
          {loading && <p role="status">{t("Loading your diary…")}</p>}
          {page === "Home" && (
            <>
              <section className="welcome">
                <div>
                  <span className="eyebrow">
                    {t("Your personal space for better organization.")}
                  </span>
                  <h2>{t("Your health, thoughtfully organized.")}</h2>
                  <p>
                    {t(
                      "Keep your prescriptions, certificates and reports together.",
                    )}
                  </p>
                  <div className="quick-actions">
                    <button className="primary" onClick={() => add("visit")}>
                      <Plus size={18} />
                      {t("Add visit")}
                    </button>
                    <button onClick={() => add("medicine")}>
                      <Pill size={18} />
                      {t("Add medicine")}
                    </button>
                    <button onClick={() => add("attachment")}>
                      <Upload size={18} />
                      {t("Upload document")}
                    </button>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-orbit" />
                  <div className="art-card">
                    <Heart size={29} />
                    <span />
                    <span />
                    <Activity size={88} />
                  </div>
                  <div className="art-check">
                    <Check size={23} />
                  </div>
                  <div className="art-plus">+</div>
                </div>
              </section>
              <section className="stats">
                <button onClick={() => setPage("Visits")}>
                  <span className="stat-icon blue">
                    <CalendarDays size={20} />
                  </span>
                  <span className="stat-label">
                    {t("Upcoming appointments")}
                  </span>
                  <strong>{upcoming.length.toString().padStart(2, "0")}</strong>
                  <small>
                    {upcoming[0]
                      ? fmt(upcoming[0].data.date)
                      : t("Nothing scheduled")}
                  </small>
                </button>
                <button onClick={() => setPage("Medicines")}>
                  <span className="stat-icon teal">
                    <Pill size={20} />
                  </span>
                  <span className="stat-label">{t("Active medicines")}</span>
                  <strong>{active.length.toString().padStart(2, "0")}</strong>
                  <small>{t("Current medicines list")}</small>
                </button>
                <button onClick={() => setPage("Sick leave")}>
                  <span className="stat-icon lavender">
                    <ClipboardList size={20} />
                  </span>
                  <span className="stat-label">{t("Current sick leave")}</span>
                  <strong>
                    {current
                      ? calendarDays(current.data.start, current.data.end)
                      : "—"}
                    <em>{current ? t("calendar days") : ""}</em>
                  </strong>
                  <small>
                    {current
                      ? `${fmt(current.data.start)} – ${fmt(current.data.end)}`
                      : t("No current sick leave")}
                  </small>
                </button>
                <button onClick={() => setPage("Sick leave")}>
                  <span className="stat-icon orange">
                    <FileText size={20} />
                  </span>
                  <span className="stat-label">
                    {t("Awaiting HR submission")}
                  </span>
                  <strong>{pending.length.toString().padStart(2, "0")}</strong>
                  <small className={pending.length ? "amber-text" : ""}>
                    {t(
                      pending.length
                        ? "Send certificate to HR"
                        : "Nothing waiting to be sent",
                    )}
                  </small>
                </button>
              </section>
            </>
          )}
          {page === "More" ? (
            <div className="settings-grid">
              <section className="panel care-links">
                <h2>{t("Manage your care")}</h2>
                {(["Sick leave", "Doctors", "Reminders"] as const).map(
                  (label) => (
                    <button
                      key={label}
                      className="secondary"
                      onClick={() => {
                        setPage(label);
                        setQuery("");
                        setTypeFilter("");
                      }}
                    >
                      {t(label)}
                      <ChevronRight size={16} />
                    </button>
                  ),
                )}
              </section>
              <section className="panel">
                <h2>{t("Settings & privacy")}</h2>
                <label>
                  {t("Language")}
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as "en" | "de")}
                  >
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </label>
                <div className="setting-row">
                  <span>{t("Appearance")}</span>
                  <button className="secondary" onClick={() => setDark(!dark)}>
                    {t(dark ? "Light mode" : "Dark mode")}
                  </button>
                </div>
                <h3>{t("Date & time")}</h3>
                <p className="muted">
                  {t("Swiss format · 24-hour clock · Europe/Zurich")}
                </p>
                <h3>{t("Reminders")}</h3>
                <p className="muted">
                  {t(
                    "Reminders work only while this app is open. Notification text contains no health details.",
                  )}
                </p>
                <button
                  className="secondary"
                  onClick={async () => {
                    if (!("Notification" in window)) {
                      setToast(
                        lang === "de"
                          ? "Browser unterstützt keine Benachrichtigungen."
                          : "This browser does not support notifications.",
                      );
                      return;
                    }
                    const result = await Notification.requestPermission();
                    setNotify(result === "granted");
                    setToast(
                      result === "granted"
                        ? t("Reminders") + " ✓"
                        : lang === "de"
                          ? "Keine Benachrichtigungsberechtigung."
                          : "Notification permission was not granted.",
                    );
                  }}
                >
                  {notify ? <Check size={16} /> : <Bell size={16} />}{" "}
                  {t("Enable reminders")}
                </button>
              </section>
              <section className="panel">
                <ShieldCheck className="teal-text" />
                <h2>{t("Privacy")}</h2>
                <p>
                  {t(
                    "No private records or files are cached for offline use. Cloud sessions are held in memory; sign in again after refreshing.",
                  )}
                </p>
                <p>
                  {t(
                    supabase
                      ? "Cloud data and files are stored in your configured Supabase project. Access is restricted by user policies."
                      : "Fictional data. Changes and files stay in memory and reset on refresh.",
                  )}
                </p>
                <p>{t("This app does not provide medical advice.")}</p>
                {supabase ? (
                  <>
                    <button
                      className="secondary"
                      onClick={async () => {
                        await supabase!.auth.signOut();
                        clearMemory();
                      }}
                    >
                      <LogOut size={17} />
                      {t("Sign out")}
                    </button>
                    <button
                      className="danger text-button"
                      onClick={() => setAccountDelete(true)}
                    >
                      {t("Delete account")}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      {t(
                        "Connect Supabase to enable account features. See the included setup guide.",
                      )}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        clearMemory();
                        setEntries(sample);
                      }}
                    >
                      {t("Reset demo")}
                    </button>
                    <button className="text-button" onClick={clearMemory}>
                      {t("Clear demo data")}
                    </button>
                  </>
                )}
              </section>
            </div>
          ) : (
            <div className={page === "Home" ? "content-grid" : ""}>
              <section className="panel timeline">
                <div className="section-heading">
                  <h2>
                    {t(
                      page === "Home"
                        ? "Health timeline"
                        : page === "Documents"
                          ? "All documents"
                          : page,
                    )}
                  </h2>
                  {page === "Home" ? (
                    <span className="muted small">{t("Recent activity")}</span>
                  ) : (
                    <button
                      className="primary"
                      onClick={() =>
                        add(
                          page === "Visits"
                            ? "visit"
                            : page === "Medicines"
                              ? "medicine"
                              : page === "Documents"
                                ? "attachment"
                                : page === "Doctors"
                                  ? "doctor"
                                  : page === "Reminders"
                                    ? "reminder"
                                    : "leave",
                        )
                      }
                    >
                      <Plus size={17} />
                      {t(
                        page === "Visits"
                          ? "Add visit"
                          : page === "Medicines"
                            ? "Add medicine"
                            : page === "Documents"
                              ? "Upload document"
                              : page === "Doctors"
                                ? "Add doctor"
                                : page === "Reminders"
                                  ? "Add reminder"
                                  : "Add sick leave",
                      )}
                    </button>
                  )}
                </div>
                <div className="search-row">
                  <label className="search">
                    <Search size={18} />
                    <input
                      aria-label={t("Search your diary…")}
                      placeholder={t("Search your diary…")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <button
                    className={"filter-btn " + (filters ? "selected" : "")}
                    aria-label={t("Details")}
                    aria-expanded={filters}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>
                {filters && (
                  <div className="filters">
                    <label>
                      {t("Record type")}
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="">{t("All records")}</option>
                        {Object.entries(kindName).map(([k, v]) => (
                          <option key={k} value={k}>
                            {t(v)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Doctor")}
                      <select
                        value={doctorFilter}
                        onChange={(e) => setDoctorFilter(e.target.value)}
                      >
                        <option value="">{t("All doctors")}</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.data.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Diagnosis")}
                      <input
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                      />
                    </label>
                    <label>
                      {t("From")}
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      {t("Until")}
                      <input
                        type="date"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                {list.length ? (
                  list.map(card)
                ) : (
                  <div className="empty">
                    <FileText size={32} />
                    <h3>
                      {t(
                        query || filters
                          ? "No matching records"
                          : page === "Documents"
                            ? "No documents yet"
                            : "No records yet",
                      )}
                    </h3>
                    <p>
                      {t(
                        query || filters
                          ? "Try another search or change your filters."
                          : "Add your first record to start your diary.",
                      )}
                    </p>
                  </div>
                )}
              </section>
              {page === "Home" && (
                <aside className="right-column">
                  <section className="panel next-appointment">
                    <div className="section-heading">
                      <h2>{t("Upcoming appointments")}</h2>
                      <CalendarDays size={19} />
                    </div>
                    {upcoming[0] ? (
                      <>
                        <div className="appointment-date">
                          <strong>
                            {new Date(
                              upcoming[0].data.date + "T12:00:00Z",
                            ).getUTCDate()}
                          </strong>
                          <span>
                            {new Intl.DateTimeFormat(
                              lang === "de" ? "de-CH" : "en-GB",
                              { month: "short" },
                            ).format(new Date(upcoming[0].data.date))}
                            <small>{upcoming[0].data.time}</small>
                          </span>
                          <span className="badge blue">{t("Visit")}</span>
                        </div>
                        <h3>{upcoming[0].data.title}</h3>
                        <p>
                          {doctorName(upcoming[0].data.doctor)}
                          <br />
                          <span className="muted">
                            {upcoming[0].data.clinic}
                          </span>
                        </p>
                        <button
                          className="text-button"
                          onClick={() => setDetail(upcoming[0])}
                        >
                          {t("View record")}
                          <ArrowRight size={15} />
                        </button>
                      </>
                    ) : (
                      <p className="muted">{t("No upcoming appointments")}</p>
                    )}
                  </section>
                  <section className="panel next-step">
                    <span className="eyebrow">
                      <span className="tiny-dot" />
                      {t("Your next step")}
                    </span>
                    <h3>
                      {t(
                        pending.length
                          ? "Send certificate to HR"
                          : "Your diary is up to date",
                      )}
                    </h3>
                    <p>{t("A small task, one less thing on your mind.")}</p>
                    {pending[0] && (
                      <button
                        className="secondary"
                        onClick={() => setDetail(pending[0])}
                      >
                        {t("View record")}
                        <ArrowRight size={15} />
                      </button>
                    )}
                  </section>
                  {latest && (
                    <section className="panel">
                      <h2>{t("Latest visit")}</h2>
                      <button
                        className="plain-link"
                        onClick={() => setDetail(latest)}
                      >
                        {latest.data.title}
                        <ChevronRight size={16} />
                      </button>
                      <p className="muted small">
                        {fmt(latest.data.date)} ·{" "}
                        {doctorName(latest.data.doctor)}
                      </p>
                    </section>
                  )}
                  <section className="panel">
                    <h2>{t("Follow-up reminders")}</h2>
                    {entries
                      .filter(
                        (e) => e.kind === "visit" && e.data.followup >= today(),
                      )
                      .map((e) => (
                        <button
                          className="plain-link"
                          key={e.id}
                          onClick={() => setDetail(e)}
                        >
                          <span>
                            {e.data.title}
                            <small>{fmt(e.data.followup)}</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                  </section>
                </aside>
              )}
            </div>
          )}
          <footer>
            <Heart size={13} />
            {t("Your health, thoughtfully organized.")}
            <span>{t("Swiss format · 24-hour clock · Europe/Zurich")}</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map(([label, Icon]) => (
          <button
            key={label}
            className={page === label ? "active" : ""}
            onClick={() => {
              setPage(label);
              setQuery("");
              setTypeFilter("");
            }}
          >
            <Icon size={21} />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {edit &&
        modal(
          <>
            <div className="modal-heading">
              <p className="eyebrow">{t(kindName[edit.kind])}</p>
              <h2>
                {t(
                  entries.some((e) => e.id === edit.id)
                    ? "Edit"
                    : edit.kind === "visit"
                      ? "Add visit"
                      : edit.kind === "medicine"
                        ? "Add medicine"
                        : edit.kind === "attachment"
                          ? "Upload document"
                          : edit.kind === "doctor"
                            ? "Add doctor"
                            : edit.kind === "reminder"
                              ? "Add reminder"
                              : "Add sick leave",
                )}
              </h2>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                {fields[edit.kind]
                  .slice(
                    0,
                    edit.kind === "visit"
                      ? 6
                      : edit.kind === "medicine"
                        ? 10
                        : 99,
                  )
                  .map(renderField)}
              </div>
              {["visit", "medicine"].includes(edit.kind) && (
                <details>
                  <summary>{t("Optional details")}</summary>
                  <div className="form-grid">
                    {fields[edit.kind]
                      .slice(edit.kind === "visit" ? 6 : 10)
                      .map(renderField)}
                  </div>
                </details>
              )}
              {edit.kind === "leave" && (
                <p className="info-note">
                  {edit.data.start &&
                    edit.data.end &&
                    edit.data.end >= edit.data.start && (
                      <strong style={{ display: "block", marginBottom: 8 }}>
                        {calendarDays(edit.data.start, edit.data.end)}{" "}
                        {t("calendar days")}
                      </strong>
                    )}
                  {t(
                    "Recording Sent does not send an email or share any health information.",
                  )}
                </p>
              )}
              {edit.kind === "attachment" && (
                <div className="upload-area">
                  <Upload size={28} />
                  {edit.data.filename && (
                    <p>
                      {lang === "de"
                        ? "Datei ersetzen (optional). Der Eintrag bleibt erhalten."
                        : "Replace file (optional). The attachment record is kept."}
                    </p>
                  )}
                  <p>{t("Files: JPG, PNG, WebP or PDF. Up to 20 MB each.")}</p>
                  <div className="quick-actions">
                    <label className="file-button">
                      {t("Choose files")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        multiple={!edit.data.filename}
                        onChange={(e) => {
                          setFiles(Array.from(e.target.files || []));
                          setFormError("");
                        }}
                      />
                    </label>
                    <label className="file-button">
                      <Camera size={17} />
                      {t("Take photo")}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          setFiles(Array.from(e.target.files || []))
                        }
                      />
                    </label>
                  </div>
                  <p className="small">{files.map((f) => f.name).join(", ")}</p>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={optimize}
                      onChange={(e) => setOptimize(e.target.checked)}
                    />
                    {lang === "de"
                      ? "Fotos lokal optimieren (max. 3200 px). Dokumente bleiben unverändert."
                      : "Optimize photos locally (up to 3200 px). Documents stay unchanged."}
                  </label>
                  <p className="small">
                    {lang === "de"
                      ? "Deaktivieren, um Originalfotos unverändert zu speichern. Heruntergeladen wird die gespeicherte Version."
                      : "Turn off to keep original photos unchanged. Downloads contain the stored version."}
                  </p>
                  {!supabase && (
                    <small>{t("Local demo only; no cloud upload.")}</small>
                  )}
                  {progress && (
                    <p role="status">
                      {t("Uploading…")} {progress}
                      <progress />
                    </p>
                  )}
                </div>
              )}
              {formError && (
                <p className="error" role="alert">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEdit(null)}
                  disabled={busy}
                >
                  {t("Cancel")}
                </button>
                <button className="primary" disabled={busy}>
                  {t(busy ? "Saving…" : "Save")}
                </button>
              </div>
            </form>
          </>,
          () => {
            if (!busy) setEdit(null);
          },
          true,
        )}
      {detail &&
        modal(
          <>
            <p className="eyebrow">{t(kindName[detail.kind])}</p>
            <h2>{detail.data.title}</h2>
            {detail.kind === "leave" && (
              <div className="leave-summary">
                <strong>
                  {calendarDays(detail.data.start, detail.data.end)}{" "}
                  {t("calendar days")}
                </strong>
                <span>
                  {detail.data.percentage}% {t("work incapacity")}
                </span>
              </div>
            )}
            <dl className="detail-list">
              {fields[detail.kind]
                .filter(([key]) => detail.data[key] && key !== "title")
                .map(([key, label, type]) => (
                  <React.Fragment key={key}>
                    <dt>{t(label)}</dt>
                    <dd>
                      {["doctor", "visit", "medicine", "leave"].includes(
                        type || "",
                      )
                        ? entries.find((e) => e.id === detail.data[key])?.data
                            .title || "—"
                        : type === "date"
                          ? fmt(detail.data[key])
                          : type === "select"
                            ? t(detail.data[key])
                            : detail.data[key]}
                    </dd>
                  </React.Fragment>
                ))}
            </dl>
            {detail.kind === "leave" && (
              <>
                <p className="info-note">
                  {t(
                    "Recording Sent does not send an email or share any health information.",
                  )}
                </p>
                {detail.data.status === "Not sent" && (
                  <button
                    className="primary"
                    onClick={() => {
                      setEdit({
                        ...detail,
                        data: { ...detail.data, status: "Sent", sent: today() },
                      });
                      setDetail(null);
                      setFormError("");
                    }}
                  >
                    <Check size={16} />
                    {t("Mark as sent")}
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    add("leave", {
                      title: detail.data.title,
                      visit: detail.data.visit,
                      extends: detail.id,
                    })
                  }
                >
                  {t("Extend leave")}
                </button>
              </>
            )}
            {detail.kind === "attachment" && (
              <div className="quick-actions">
                <button className="secondary" onClick={() => openFile(detail)}>
                  {t("Preview")}
                </button>
                <button
                  className="secondary"
                  onClick={() => openFile(detail, true)}
                >
                  <ArrowDownToLine size={16} />
                  {t("Download original")}
                </button>
              </div>
            )}
            {["visit", "medicine", "leave"].includes(detail.kind) && (
              <section className="linked-records">
                <h3>{t("Documents")}</h3>
                {entries
                  .filter(
                    (e) =>
                      e.kind === "attachment" &&
                      Object.values(e.data).includes(detail.id),
                  )
                  .map(card)}
                <button
                  className="text-button"
                  onClick={() =>
                    add("attachment", { [detail.kind]: detail.id })
                  }
                >
                  <Plus size={16} />
                  {t("Upload document")}
                </button>
                {detail.kind === "visit" && (
                  <>
                    <h3>{t("Medicines")}</h3>
                    {entries
                      .filter(
                        (e) =>
                          e.kind === "medicine" && e.data.visit === detail.id,
                      )
                      .map(card)}
                    <button
                      className="text-button"
                      onClick={() =>
                        add("medicine", {
                          visit: detail.id,
                          doctor: detail.data.doctor,
                        })
                      }
                    >
                      <Plus size={16} />
                      {t("Add medicine")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => add("leave", { visit: detail.id })}
                    >
                      {t("Add sick leave")}
                    </button>
                  </>
                )}
              </section>
            )}
            <div className="modal-actions">
              <button
                className="danger text-button"
                onClick={() => {
                  setDeleting(detail);
                  setDetail(null);
                }}
              >
                <Trash2 size={16} />
                {t("Delete")}
              </button>
              <button
                className="primary"
                onClick={() => {
                  setEdit(detail);
                  setDetail(null);
                  setFiles([]);
                  setFormError("");
                }}
              >
                {t("Edit")}
              </button>
            </div>
          </>,
          () => setDetail(null),
        )}
      {deleting &&
        modal(
          <>
            <h2>{t("Delete this record?")}</h2>
            <p>{deleting.data.title}</p>
            <p className="muted">
              {t("Please confirm deletion. This cannot be undone.")}
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                {t("Keep record")}
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={remove}
              >
                {t("Delete")}
              </button>
            </div>
          </>,
          () => setDeleting(null),
        )}
      {preview &&
        modal(
          <>
            <h2>{preview.title}</h2>
            {preview.type === "application/pdf" ? (
              <iframe
                title={preview.title}
                src={preview.url}
                className="document-preview"
              />
            ) : (
              <img
                className="image-preview"
                src={preview.url}
                alt={preview.title}
              />
            )}
          </>,
          () => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          },
          true,
        )}
      {exporting &&
        modal(
          <>
            <h2>{t("Export records")}</h2>
            <p className="muted">{t("Select records to include.")}</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={hrOnly}
                onChange={(e) => {
                  setHrOnly(e.target.checked);
                  setSelected(e.target.checked ? leaves.map((l) => l.id) : []);
                }}
              />
              {t("HR-only export")}
            </label>
            {!hrOnly && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={privateDetails}
                  onChange={(e) => setPrivateDetails(e.target.checked)}
                />
                {t("Include notes and treatment details")}
              </label>
            )}
            <div className="quick-actions">
              <button
                className="text-button"
                onClick={() =>
                  setSelected(
                    entries
                      .filter((e) => !hrOnly || e.kind === "leave")
                      .map((e) => e.id),
                  )
                }
              >
                {t("Select all")}
              </button>
              <button className="text-button" onClick={() => setSelected([])}>
                {t("Select none")}
              </button>
            </div>
            <div className="export-list">
              {entries
                .filter((e) => !hrOnly || e.kind === "leave")
                .map((e) => (
                  <label className="check-row" key={e.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, e.id]
                            : selected.filter((id) => id !== e.id),
                        )
                      }
                    />
                    <span>
                      {e.data.title}
                      <small>{t(kindName[e.kind])}</small>
                    </span>
                  </label>
                ))}
            </div>
            <p className="small muted">
              {lang === "de"
                ? "Originaldateien werden separat unter Dokumente heruntergeladen."
                : "Download original attachments separately from Documents. JSON contains selected records, not file contents."}
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={!selected.length}
                onClick={exportJSON}
              >
                {t("Download JSON backup")}
              </button>
              <button
                className="primary"
                disabled={!selected.length}
                onClick={exportPDF}
              >
                {t("Export selected PDF")}
              </button>
            </div>
          </>,
          () => setExporting(false),
          true,
        )}
      {accountDelete &&
        modal(
          <>
            <h2>{t("Delete account")}</h2>
            <p>{t("Please confirm deletion. This cannot be undone.")}</p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setAccountDelete(false)}
              >
                {t("Cancel")}
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { error } =
                      await supabase!.functions.invoke("delete-account");
                    if (error) throw error;
                    await supabase!.auth.signOut();
                    clearMemory();
                    setAccountDelete(false);
                  } catch {
                    setError(t("Something went wrong. Please try again."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Delete account")}
              </button>
            </div>
          </>,
          () => setAccountDelete(false),
        )}
    </div>
  );
}
function Modal({
  children,
  close,
  wide,
  closeLabel,
}: {
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const node = ref.current!;
    node.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          node.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]',
          ),
        ).filter((x) => x.getClientRects().length);
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    node.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      node.removeEventListener("keydown", listener);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Record dialog"
        className={"modal " + (wide ? "wide-modal" : "")}
      >
        <button
          className="modal-close icon-btn"
          aria-label={closeLabel}
          onClick={close}
        >
          <X size={22} />
        </button>
        {children}
      </div>
    </div>
  );
}
