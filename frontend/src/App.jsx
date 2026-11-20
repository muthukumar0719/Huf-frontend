import { mobileError, gmailError, GMAIL_DOMAIN } from "./contactValidation";
import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Landmark,
  Users,
  FileText,
  MailCheck,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Link as LinkIcon,
} from "lucide-react";
import { saveHufStage, submitHufApplication, resendClientLink, getBankByIfsc, getPanName } from "./api";

const emptyCoparcener = () => ({
  id: crypto.randomUUID(),
  fullName: "",
  pan: "",
  relationship: "",
  dob: "",
  isMinor: false,
  signature: null,
});
const initial = {
  mobile: "",
  email: "",
  hufPan: "",
  hufPanFile: null,
  kartaPanFile: null,
  bankAccountNumber: "",
  confirmBankAccountNumber: "",
  ifsc: "",
  micr: "",
  bankAccountType: "",
  bankStatement: null,
  // HUF address exactly as printed on the HUF bank statement (Bank screen).
  statementAddress: { address: "", city: "", district: "", state: "", pincode: "" },
  karta: {
    fullName: "",
    pan: "",
    dob: "",
    gender: "",
    fatherName: "",
    motherName: "",
    occupation: "",
    placeOfIncorporation: "",
    annualIncome: "",
    netWorth: "",
    address: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    aadhaarLast4: "",
    pep: "NO",
  },
  coparceners: [emptyCoparcener()],
  hufDeed: null,
  kartaAadhaarFile: null,
  declarations: { accuracy: false, consent: false, review: false },
};

const steps = [
  { label: "Contact & PAN", icon: MailCheck },
  { label: "Bank", icon: Landmark },
  { label: "Karta & Co-parceners", icon: Users },
  { label: "HUF Documents", icon: FileText },
  { label: "Preview", icon: CheckCircle2 },
];

function App() {
  const [contactAttempted, setContactAttempted] = useState(false);
  const [attempted, setAttempted] = useState({});
  const [step, setStep] = useState(0);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const editSection = (index) => {
    setEditSnapshot(data);
    setNotice("");
    setStep(index);
  };
  const [data, setData] = useState(initial);
  const [appId, setAppId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const progress = useMemo(
    () => Math.round((step / (steps.length - 1)) * 100),
    [step],
  );
  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const setKarta = (k, v) =>
    setData((d) => ({
      ...d,
      karta: { ...d.karta, [k]: k === "pan" ? v.toUpperCase() : v },
    }));
  const setCp = (id, k, v) =>
    setData((d) => ({
      ...d,
      coparceners: d.coparceners.map((c) =>
        c.id === id ? { ...c, [k]: k === "pan" ? v.toUpperCase() : v } : c,
      ),
    }));
  // Each completed section is saved to the server before moving on, so nothing entered so far
  // is lost if the RM stops midway. The first save creates the application; later saves update it.
  const next = async () => {
    try {
      if (step === 0) setContactAttempted(true);
      setAttempted((a) => ({ ...a, [step]: true }));
      validate(step, data);
      setNotice("");
      if (STAGES[step]) {
        setBusy(true);
        const r = await saveHufStage(
          STAGES[step],
          safeForm({ ...data, email: data.email.trim() }),
          stageFiles(step, data),
          appId,
        );
        setAppId(r.application_id);
        // Bank screen: the server verified the account (penny drop) before saving it.
        if (r.bank_verification)
          set("bankVerification", { ...r.bank_verification, for: `${data.bankAccountNumber}|${data.ifsc}` });
      }
      setStep(editSnapshot ? 4 : Math.min(step + 1, 4));
      setEditSnapshot(null);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  // The form stays in state on failure, so the RM can fix it and submit again.
  const submit = (request) => async () => {
    try {
      setBusy(true);
      setNotice("");
      const r = await request();
      setAppId(r.application_id);
      setLink(r.client_link);
      setEmailSent(r.email_sent);
      setNotice(
        r.email_sent
          ? r.existing_application
            ? "Client link has been sent successfully."
            : "Application submitted successfully. Client link has been sent to the registered email."
          : `Application saved, but the client link email was not sent (${r.email_error}). Use "Resend Client Link" to try again.`,
      );
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  // Every section is already saved; this sends the client link for that application.
  const generate = submit(() => {
    for (let index = 0; index < 4; index++) validate(index, data);
    if (!appId) throw Error("The application has not been saved yet. Go back and click Next on each section.");
    return submitHufApplication(appId);
  });
  const resend = submit(() => resendClientLink(appId));

  return (
    <div className="app-shell">
      <div className="orb orb1" />
      <div className="orb orb2" />
      <main className="glass-panel">
        <header className="topbar">
          <img src="/aionion-logo.png" className="logo" />
          <div>
            <div className="eyebrow">
              AIONION CAPITAL • NON-INDIVIDUAL ONBOARDING
            </div>
            <h1>Non Individual - HUF Account Opening Process</h1>
            <p>Secure KYC collection for HUF account opening.</p>
          </div>
        </header>
        <section className="stepper-wrap" aria-label="Application progress">
          <div className="step-summary">
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <strong>{steps[step].label}</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="stepper">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  className={`step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
                  key={s.label}
                  aria-current={i === step ? "step" : undefined}
                  aria-label={`${s.label}${i < step ? ", completed" : ""}`}
                >
                  <div className="step-dot">
                    {i < step ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>
        </section>
        {notice && <div className="notice">{notice}</div>}
        <section className="content-card">
          {step === 0 && (
            <Contact data={data} set={set} attempted={contactAttempted} />
          )}{" "}
          {step === 0 && (
            <div className="contact-pan-documents">
              <Pan
                data={data}
                set={set}
                setKarta={setKarta}
                attempted={contactAttempted}
              />
            </div>
          )}{" "}
          {step === 1 && (
            <Bank data={data} set={set} attempted={!!attempted[1]} />
          )}{" "}
          {step === 2 && (
            <People
              data={data}
              attempted={!!attempted[2]}
              setKarta={setKarta}
              setCp={setCp}
              setData={setData}
            />
          )}{" "}
          {step === 3 && <HufDocs data={data} set={set} />}{" "}
          {step === 4 && (
            <Preview
              data={data}
              link={link}
              onEdit={!busy && !link ? editSection : undefined}
            />
          )}
        </section>
        <footer className="actions">
          <button
            className="btn secondary"
            disabled={(!editSnapshot && step === 0) || busy || !!link}
            onClick={() => {
              setNotice("");
              if (editSnapshot) {
                setData(editSnapshot);
                setEditSnapshot(null);
                setStep(4);
              } else setStep((s) => s - 1);
            }}
          >
            <ChevronLeft size={18} />
            {editSnapshot ? "Cancel Edit" : "Back"}
          </button>
          {step < 4 ? (
            <button className="btn primary" disabled={busy} onClick={next}>
              {editSnapshot ? "Save & Return to Preview" : "Continue"}
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={busy || (!!link && emailSent)}
              onClick={link ? resend : generate}
            >
              <LinkIcon size={18} />
              {busy
                ? link
                  ? "Sending..."
                  : "Generating..."
                : link
                  ? emailSent
                    ? "Link Emailed"
                    : "Resend Client Link"
                  : "Submit & Email Client Link"}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}
function displayDob(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/")
    : value;
}
function validDob(value) {
  const match = displayDob(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return (
    year >= 1000 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date <= new Date()
  );
}
// Age in completed years from a DD/MM/YYYY date of birth, or null if the date is not valid yet.
function ageFromDob(value) {
  if (!validDob(value)) return null;
  const [day, month, year] = displayDob(value).split("/").map(Number);
  const today = new Date();
  const hadBirthday =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  return today.getFullYear() - year - (hadBirthday ? 0 : 1);
}
// A co-parcener under 18 is a minor.
const isMinorDob = (value) => {
  const age = ageFromDob(value);
  return age !== null && age < 18;
};
function DobInput({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      value={displayDob(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
        onChange(
          [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
            .filter(Boolean)
            .join("/"),
        );
      }}
    />
  );
}
// required: shows a red * after the label (mandatory field).
function Field({ label, children, wide = false, required = false }) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
// Dropdown with the same helper/error text as TextField.
function SelectField({ label, value, onChange, options, rule, help, attempted, required }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const issue = attempted || touched ? rule?.(value) || "" : "";
  return (
    <Field label={label} required={required}>
      <select
        aria-required={required || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!issue}
        aria-describedby={issue || help ? id : undefined}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {(issue || help) && (
        <small id={id} className={issue ? "field-error" : "field-help"} aria-live="polite">
          {issue || help}
        </small>
      )}
    </Field>
  );
}
// Input with placeholder, typing filter (sanitize) and a rule shown as
// helper/error text once the field is left or Continue is clicked.
function TextField({
  label,
  value,
  onChange,
  rule,
  sanitize = (v) => v,
  help,
  attempted,
  wide,
  multiline,
  masked,
  required,
  ...inputProps
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const issue = attempted || touched ? rule?.(value) || "" : "";
  const Tag = multiline ? "textarea" : "input";
  // Masked fields hide every character until focused again.
  const shown = masked && !focused ? "•".repeat(value.length) : value;
  return (
    <Field label={label} wide={wide} required={required}>
      <Tag
        type={multiline ? undefined : "text"}
        aria-required={required || undefined}
        {...inputProps}
        value={shown}
        onChange={(e) => onChange(sanitize(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setTouched(true);
        }}
        aria-invalid={!!issue}
        aria-describedby={issue || help ? id : undefined}
      />
      {(issue || help) && (
        <small
          id={id}
          className={issue ? "field-error" : "field-help"}
          aria-live="polite"
        >
          {issue || help}
        </small>
      )}
    </Field>
  );
}
function DobField({ label = "Date of Birth", value, onChange, rule, attempted, required }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const issue = attempted || touched ? rule(value) : "";
  return (
    <Field label={label} required={required}>
      <DobInput
        value={value}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        aria-invalid={!!issue}
        aria-describedby={id}
      />
      <small
        id={id}
        className={issue ? "field-error" : "field-help"}
        aria-live="polite"
      >
        {issue || "Day/month/year, e.g. 15/08/1980."}
      </small>
    </Field>
  );
}
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
function formatSize(bytes) {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(1) + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB";
}
function Upload({ label, value, onChange, accept = ".pdf,.jpg,.jpeg,.png", required = false }) {
  const [error, setError] = useState("");
  const allowed = accept.split(",");
  const types = [
    ...new Set(allowed.map((x) => x.slice(1).toUpperCase().replace("JPEG", "JPG"))),
  ].join("/");
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again after an error
    if (!file) return;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext))
      return setError(`${file.name} is not allowed. Upload ${types} only.`);
    if (file.size > MAX_UPLOAD_BYTES)
      return setError(`${file.name} is ${formatSize(file.size)}. Maximum size is 8 MB.`);
    if (!file.size) return setError(`${file.name} is empty. Choose another file.`);
    setError("");
    onChange(file);
  };
  const done = !!value?.name;
  return (
    <label className={`upload ${done ? "done" : ""} ${error ? "invalid" : ""}`}>
      {done ? <CheckCircle2 size={22} /> : <UploadCloud size={22} />}
      <div className="upload-text">
        <b>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </b>
        {done ? (
          <small title={value.name}>
            <span className="upload-name">{value.name}</span>
            {value.size ? ` • ${formatSize(value.size)}` : ""} • Uploaded
          </small>
        ) : (
          <small>{types} • max 8 MB</small>
        )}
        {error && (
          <small className="upload-error" role="alert">
            {error}
          </small>
        )}
      </div>
      {done && (
        <span className="mini upload-replace" aria-hidden="true">
          Replace
        </span>
      )}
      <input
        type="file"
        accept={accept}
        aria-label={`${done ? "Replace" : "Upload"} ${label}`}
        onChange={pick}
      />
    </label>
  );
}
function Contact({ data, set, attempted }) {
  const [touched, setTouched] = useState({});
  const mobileIssue =
    attempted || touched.mobile ? mobileError(data.mobile) : "";
  const emailIssue = attempted || touched.email ? gmailError(data.email) : "";
  return (
    <>
      <SectionTitle
        title="Enter the Contact Details"
        sub="Start with the authorised contact details for this HUF application."
      />
      <div className="grid">
        <Field label="Mobile Number" required>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={10}
            value={data.mobile}
            onChange={(e) =>
              set("mobile", e.target.value.replace(/[^0-9]/g, "").slice(0, 10))
            }
            onBlur={() => setTouched((t) => ({ ...t, mobile: true }))}
            placeholder="10-digit mobile"
            aria-invalid={!!mobileIssue}
            aria-describedby="mobile-help"
          />
          <small
            id="mobile-help"
            className={mobileIssue ? "field-error" : "field-help"}
            aria-live="polite"
          >
            {mobileIssue ||
              "10 digits, starting with 6, 7, 8 or 9. Do not include +91."}
          </small>
        </Field>
        <Field label="Email ID" required>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            value={data.email}
            onChange={(e) => {
              const v = e.target.value.replace(/\s/g, "").toLowerCase();
              set("email", v);
              // Once the domain is typed, show the result straight away.
              if (v.includes("@") && v.split("@")[1].includes(".")) setTouched((t) => ({ ...t, email: true }));
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder={`name@${GMAIL_DOMAIN}`}
            aria-invalid={!!emailIssue}
            aria-describedby="email-help"
          />
          <small
            id="email-help"
            className={emailIssue ? "field-error" : "field-help"}
            aria-live="polite"
          >
            {emailIssue || `Enter the full Gmail address, e.g. name@${GMAIL_DOMAIN}. Only @${GMAIL_DOMAIN} is accepted.`}
          </small>
        </Field>
       {/* <Field label="MICR">
          <input
            inputMode="numeric"
            maxLength={9}
            value={data.micr}
            onChange={(e) =>
              set("micr", e.target.value.replace(/[^0-9]/g, "").slice(0, 9))
            }
            placeholder="9-digit MICR"
          />
        </Field> */}
      </div>
    </>
  );
}
function PanNumberField({ id, label, value, onChange, error, help }) {
  return (
    <Field label={label} required>
      <input
        type="text"
        autoCapitalize="characters"
        spellCheck={false}
        required
        maxLength={10}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        }
        placeholder="ABCDE1234F"
        aria-invalid={!!error}
        aria-describedby={id}
      />
      <small
        id={id}
        className={error ? "field-error" : "field-help"}
        aria-live="polite"
      >
        {error || help}
      </small>
    </Field>
  );
}
// Name on a PAN (ITR name) from Setu, looked up once the PAN number is valid.
// kind: "huf" (HUF PAN) or "karta" (Karta PAN).
function usePanName(kind, pan, valid) {
  const [lookup, setLookup] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getPanName(kind, pan, controller.signal)
        .then(({ full_name }) => {
          if (!controller.signal.aborted) setLookup({ pan, name: full_name });
        })
        .catch((error) => {
          if (!controller.signal.aborted) setLookup({ pan, error: error.message });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, pan, valid, retry]);
  return {
    current: valid && lookup?.pan === pan ? lookup : null,
    retry: () => {
      setLookup(null);
      setRetry((value) => value + 1);
    },
  };
}
// Read-only name fetched for a PAN, with progress / error + retry.
function PanName({ show, lookup, label, who }) {
  if (!show) return null;
  const { current, retry } = lookup;
  return (
    <div aria-live="polite">
      {current?.name ? (
        <Field label={label}>
          <input className="derived-input" value={current.name} readOnly />
        </Field>
      ) : current?.error ? (
        <>
          <small className="field-error">{current.error}</small>{" "}
          <button className="mini" type="button" onClick={retry}>
            Retry lookup
          </button>
        </>
      ) : (
        <small className="field-help">Fetching {who} name…</small>
      )}
    </div>
  );
}
function Pan({ data, set, setKarta, attempted }) {
  const hufValid = !hufPanError(data.hufPan);
  const kartaValid = !kartaPanError(data.karta.pan);
  const hufName = usePanName("huf", data.hufPan, hufValid);
  const kartaName = usePanName("karta", data.karta.pan, kartaValid);

  const hufPanIssue =
    attempted || data.hufPan.length === 10 ? hufPanError(data.hufPan) : "";
  const kartaPanIssue =
    attempted || data.karta.pan.length === 10
      ? kartaPanError(data.karta.pan)
      : "";
  return (
    <>
      <SectionTitle
        title="PAN Documents"
        sub="Enter the PAN numbers and upload clear PAN copies for the HUF and the Karta."
      />
      <div className="upload-grid">
        <div className="pan-item">
          <PanNumberField
            id="huf-pan-help"
            label="HUF PAN Number"
            value={data.hufPan}
            onChange={(v) => set("hufPan", v)}
            error={hufPanIssue}
            help="10 characters. The 4th letter must be H (e.g. ABCHE1234F)."
          />
          <PanName show={hufValid} lookup={hufName} label="HUF Name (as per ITR)" who="HUF" />
          <Upload
            label="HUF PAN"
            required
            value={data.hufPanFile}
            onChange={(f) => set("hufPanFile", f)}
          />
        </div>
        <div className="pan-item">
          <PanNumberField
            id="karta-pan-help"
            label="Karta PAN Number"
            value={data.karta.pan}
            onChange={(v) => setKarta("pan", v)}
            error={kartaPanIssue}
            help="10 characters. The 4th letter must be P (e.g. ABCPE1234F)."
          />
          <PanName show={kartaValid} lookup={kartaName} label="Karta Name (as per ITR)" who="Karta" />
          <Upload
            label="Karta PAN"
            required
            value={data.kartaPanFile}
            onChange={(f) => set("kartaPanFile", f)}
          />
        </div>
      </div>
    </>
  );
}
// Bank details for the IFSC come from bank_master as soon as a valid IFSC is typed; MICR is
// filled from it. The account itself is verified (penny drop) when Next is clicked.
function useBankLookup(ifsc, set, micr) {
  const [lookup, setLookup] = useState({ state: "idle" });
  useEffect(() => {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc || "")) {
      setLookup({ state: "idle" });
      return;
    }
    let live = true;
    setLookup({ state: "loading" });
    getBankByIfsc(ifsc)
      .then(({ bank }) => {
        if (!live) return;
        setLookup({ state: "found", bank });
        set("bankInfo", bank);
        // MICR belongs to the branch: take it from the bank master (the RM can still edit it).
        if (/^\d{9}$/.test(bank.micr_code || "") && bank.micr_code !== micr) set("micr", bank.micr_code);
      })
      .catch((e) => live && setLookup({ state: "error", message: e.message }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifsc]);
  return lookup;
}
function BankInfo({ lookup, verification, ifsc }) {
  if (lookup.state === "idle") return null;
  if (lookup.state === "loading")
    return <div className="bank-info muted">Fetching bank details for {ifsc}…</div>;
  if (lookup.state === "error")
    return (
      <div className="bank-info error" role="alert">
        {lookup.message}
      </div>
    );
  const b = lookup.bank;
  return (
    <div className="bank-info">
      <div className="bank-info-head">
        <Landmark size={18} />
        <b>{b.bank_name || "Bank"}</b>
        {verification?.status === "ACTIVE" && (
          <span className="bank-badge">
            <CheckCircle2 size={14} /> Account active
          </span>
        )}
      </div>
      <dl>
        <div><dt>Branch</dt><dd>{b.branch_name || "-"}</dd></div>
        <div><dt>MICR</dt><dd>{b.micr_code || "-"}</dd></div>
        <div className="wide"><dt>Address</dt><dd>{b.bank_address || "-"}</dd></div>
        {verification?.account_holder_name && (
          <div className="wide"><dt>Account holder (from bank)</dt><dd>{verification.account_holder_name}</dd></div>
        )}
      </dl>
      {!verification && (
        <small className="field-help">The account is verified with the bank when you click Next.</small>
      )}
    </div>
  );
}
function Bank({ data, set, attempted }) {
  const setAddress = (k, v) => set("statementAddress", { ...data.statementAddress, [k]: v });
  const lookup = useBankLookup(data.ifsc, set, data.micr);
  // A verification belongs to the account and IFSC it was made for.
  const verification =
    data.bankVerification && data.bankVerification.for === `${data.bankAccountNumber}|${data.ifsc}`
      ? data.bankVerification
      : null;
  return (
    <>
      <SectionTitle
        title="HUF Bank Verification"
        sub="Capture HUF bank details and latest three-month bank statement."
      />
      <div className="grid">
        <TextField
          label="Bank Account Number"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="9 to 18 digit account number"
          help="Digits only. Masked once you move to the next field."
          masked
          value={data.bankAccountNumber}
          onChange={(v) => set("bankAccountNumber", v)}
          sanitize={onlyDigits(18)}
          rule={rules.accountNumber}
          attempted={attempted}
        />
        <TextField
          label="Confirm Account Number"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="Re-enter account number"
          help="Type the account number again. Pasting is disabled."
          masked
          onPaste={(e) => e.preventDefault()}
          value={data.confirmBankAccountNumber}
          onChange={(v) => set("confirmBankAccountNumber", v)}
          sanitize={onlyDigits(18)}
          rule={(v) => rules.confirmAccountNumber(v, data)}
          attempted={attempted}
        />
        <TextField
          label="IFSC"
          required
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={11}
          placeholder="e.g. SBIN0001234"
          help="11 characters: 4 letters, 0, then 6 letters or digits."
          value={data.ifsc}
          onChange={(v) => set("ifsc", v)}
          sanitize={onlyAlnumUpper(11)}
          rule={rules.ifsc}
          attempted={attempted}
        />
        <TextField
          label="MICR"
          required
          inputMode="numeric"
          maxLength={9}
          placeholder="9-digit MICR"
          help="9 digits, printed at the bottom of the cheque."
          value={data.micr}
          onChange={(v) => set("micr", v)}
          sanitize={onlyDigits(9)}
          rule={rules.micr}
          attempted={attempted}
        />
        <SelectField
          label="Account Type"
          required
          options={ACCOUNT_TYPES}
          value={data.bankAccountType}
          onChange={(v) => set("bankAccountType", v)}
          rule={rules.accountType}
          help="Savings or Current, as on the bank statement."
          attempted={attempted}
        />
      </div>
      <BankInfo lookup={lookup} verification={verification} ifsc={data.ifsc} />
      <h3 className="subhead">HUF Bank Statement Address</h3>
      <p className="field-help">
        Type the HUF address exactly as it is printed on the HUF bank statement.
      </p>
      <div className="address-grid">
        <TextField
          label="Address (as per HUF bank statement)"
          required
          wide
          multiline
          maxLength={300}
          placeholder="Door no., street, area, landmark - as on the HUF bank statement"
          value={data.statementAddress.address}
          onChange={(v) => setAddress("address", v)}
          rule={statementAddressRules.address}
          attempted={attempted}
        />
        {addressFields().map(({ k, ...f }) => (
          <TextField
            key={k}
            {...f}
            required
            rule={statementAddressRules[k]}
            value={data.statementAddress[k]}
            onChange={(v) => setAddress(k, v)}
            attempted={attempted}
          />
        ))}
      </div>
      <Upload
        label="Latest 3-Month HUF Bank Statement"
        required
        value={data.bankStatement}
        onChange={(f) => set("bankStatement", f)}
        accept=".pdf"
      />
    </>
  );
}
// Bank account types and Karta genders (same lists in server/src/hufValidation.js).
const ACCOUNT_TYPES = ["Savings", "Current"];
const GENDERS = ["Male", "Female", "Others"];
// Annual income ranges (same list in server/src/hufValidation.js); the label is what is saved.
const INCOME_RANGES = [
  "Below ₹1 Lakh",
  "₹1 Lakh - ₹5 Lakh",
  "₹5 Lakh - ₹10 Lakh",
  "₹10 Lakh - ₹25 Lakh",
  "₹25 Lakh - ₹1 Crore",
  "Above ₹1 Crore",
];
const kartaFields = () => [
  { k: "fullName", label: "Full Name", required: true, placeholder: "Full name as per PAN", sanitize: onlyLetters, rule: rules.kartaName, maxLength: 100 },
  { k: "pan", label: "PAN", required: true, placeholder: "ABCDE1234F", sanitize: onlyAlnumUpper(10), rule: kartaPanError, maxLength: 10, autoCapitalize: "characters", help: "Individual PAN: the 4th letter must be P." },
  { k: "dob" },
  { k: "gender", label: "Gender", options: GENDERS, rule: rules.gender, help: "Select the Karta's gender." },
  { k: "fatherName", label: "Father's Name", placeholder: "Father's full name", sanitize: onlyLetters, rule: rules.fatherName, maxLength: 100 },
  { k: "motherName", label: "Mother's Name", placeholder: "Mother's full name", sanitize: onlyLetters, rule: rules.motherName, maxLength: 100 },
  { k: "occupation", label: "Occupation", placeholder: "e.g. Business", sanitize: (v) => v.replace(/[^A-Za-z &/.,-]/g, ""), rule: rules.occupation, maxLength: 60 },
  { k: "placeOfIncorporation", label: "Place of Incorporation", placeholder: "e.g. Chennai", sanitize: onlyLetters, rule: rules.placeOfIncorporation, maxLength: 100, help: "City or town where the HUF was formed." },
  { k: "annualIncome", label: "Annual Income", options: INCOME_RANGES, rule: rules.annualIncome, help: "Select the Karta's annual income range." },
  { k: "netWorth", label: "Net Worth", options: NET_WORTH_RANGES, rule: rules.netWorth, help: "Select the Karta's net worth range." },
  { k: "aadhaarLast4", label: "Aadhaar Last 4 digits", placeholder: "e.g. 1234", sanitize: onlyDigits(4), rule: rules.aadhaarLast4, inputMode: "numeric", maxLength: 4 },
];
// Shown together under Residential Address, in one row: City | District | State | Pincode.
const addressFields = () => [
  { k: "city", label: "City", placeholder: "e.g. Chennai", sanitize: onlyLetters, rule: rules.city, maxLength: 60 },
  { k: "district", label: "District", placeholder: "e.g. Chennai", sanitize: onlyLetters, rule: rules.district, maxLength: 60 },
  { k: "state", label: "State", placeholder: "e.g. Tamil Nadu", sanitize: onlyLetters, rule: rules.state, maxLength: 60 },
  { k: "pincode", label: "Pincode", placeholder: "6-digit pincode", sanitize: onlyDigits(6), rule: rules.pincode, inputMode: "numeric", maxLength: 6 },
];
// Net worth ranges (same list in server/src/hufValidation.js); the label is what is saved.
const NET_WORTH_RANGES = [
  "Below ₹10 Lakh",
  "₹10 Lakh - ₹25 Lakh",
  "₹25 Lakh - ₹50 Lakh",
  "₹50 Lakh - ₹1 Crore",
  "₹1 Crore - ₹5 Crore",
  "Above ₹5 Crore",
];
function People({ data, setKarta, setCp, setData, attempted }) {
  return (
    <>
      <SectionTitle
        title="Karta Profile & Co-parceners"
        sub="Add the Karta profile and all relevant co-parceners. Signature upload fields are generated dynamically."
      />
      <h3 className="subhead">Karta Personal Profile</h3>
      <div className="grid">
        {kartaFields().map(({ k, ...f }) =>
          k === "dob" ? (
            <DobField
              key={k}
              value={data.karta.dob}
              onChange={(value) => setKarta("dob", value)}
              rule={rules.kartaDob}
              attempted={attempted}
            />
          ) : f.options ? (
            <SelectField
              key={k}
              {...f}
              value={data.karta[k]}
              onChange={(v) => setKarta(k, v)}
              attempted={attempted}
            />
          ) : (
            <TextField
              key={k}
              {...f}
              value={data.karta[k]}
              onChange={(v) => setKarta(k, v)}
              attempted={attempted}
            />
          ),
        )}
        <Field label="PEP Status" required>
          <select
            value={data.karta.pep}
            onChange={(e) => setKarta("pep", e.target.value)}
          >
            <option>NO</option>
            <option>YES</option>
          </select>
          {rules.pep(data.karta.pep) && (
            <small className="field-error" role="alert">
              {rules.pep(data.karta.pep)}
            </small>
          )}
        </Field>
      </div>
      <div className="address-grid">
        <TextField
          label="Residential Address"
          wide
          multiline
          maxLength={300}
          placeholder="House / flat no., street, area, landmark"
          value={data.karta.address}
          onChange={(v) => setKarta("address", v)}
          attempted={attempted}
        />
        {addressFields().map(({ k, ...f }) => (
          <TextField
            key={k}
            {...f}
            value={data.karta[k]}
            onChange={(v) => setKarta(k, v)}
            attempted={attempted}
          />
        ))}
      </div>
      <div className="subhead-row">
        <h3 className="subhead">Enter the Co-parceners Details</h3>
        <button
          className="mini"
          onClick={() =>
            setData((d) => ({
              ...d,
              coparceners: [...d.coparceners, emptyCoparcener()],
            }))
          }
        >
          <Plus size={16} />
          Add Co-parcener
        </button>
      </div>
      <div className="cards">
        {data.coparceners.map((c, idx) => (
          <div className="person-card" key={c.id}>
            <div className="person-head">
              <b>Co-parcener {idx + 1}</b>
              {data.coparceners.length > 1 && (
                <button
                  className="icon-btn"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      coparceners: d.coparceners.filter((x) => x.id !== c.id),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="grid compact">
              <Field label="Relationship" required>
                <select
                  value={c.relationship}
                  onChange={(e) => setCp(c.id, "relationship", e.target.value)}
                >
                  <option value="" disabled>
                    Select relationship
                  </option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Spouse">Spouse</option>
                </select>
              </Field>
              <TextField
                label="Full Name"
                required
                maxLength={100}
                placeholder="Full name as per PAN"
                value={c.fullName}
                onChange={(v) => setCp(c.id, "fullName", v)}
                sanitize={onlyLetters}
                rule={rules.cpName}
                attempted={attempted}
              />
              <DobField
                value={c.dob}
                onChange={(value) => {
                  setCp(c.id, "dob", value);
                  setCp(c.id, "isMinor", isMinorDob(value)); // under 18 = minor
                }}
                rule={rules.cpDob}
                attempted={attempted}
                required
              />
              <Field label="Minor?">
                <input
                  readOnly
                  tabIndex={-1}
                  className="derived-input"
                  value={
                    ageFromDob(c.dob) === null
                      ? ""
                      : c.isMinor
                        ? `YES (age ${ageFromDob(c.dob)}, under 18)`
                        : `NO (age ${ageFromDob(c.dob)})`
                  }
                  placeholder="Set from the date of birth"
                  aria-describedby={`minor-help-${c.id}`}
                />
                <small id={`minor-help-${c.id}`} className="field-help">
                  A co-parcener under 18 is a minor.
                </small>
              </Field>
            </div>
            <Upload
              label={`HUF Seal with Sign - ${c.fullName || `Co-parcener ${idx + 1}`}`}
              required
              value={c.signature}
              onChange={(f) => setCp(c.id, "signature", f)}
              accept=".png,.jpg,.jpeg"
            />
          </div>
        ))}
      </div>
    </>
  );
}
function HufDocs({ data, set }) {
  return (
    <>
      <SectionTitle
        title="Stamped / Sealed HUF Deed & Karta Aadhaar"
        sub="Upload the HUF deed bearing the stamp or seal, and the Karta's Aadhaar card, collected from the client."
      />
      <div className="upload-grid">
        <Upload
          label="HUF Deed with Stamp / Seal"
          required
          value={data.hufDeed}
          onChange={(file) => set("hufDeed", file)}
        />
        <Upload
          label="Karta Aadhaar Card"
          required
          value={data.kartaAadhaarFile}
          onChange={(file) => set("kartaAadhaarFile", file)}
        />
      </div>
    </>
  );
}
function Preview({ data, link, onEdit }) {
  return (
    <>
      <SectionTitle
        title="Review HUF Application"
        sub="RM: Check all client details and selected documents before submitting and emailing the continuation link."
      />
      <div className="preview-grid">
        <Review
          title="Client Contact"
          onEdit={onEdit ? () => onEdit(0) : undefined}
          rows={{ Mobile: data.mobile, Email: data.email }}
        />
        <Review
          title="HUF Bank Details"
          onEdit={onEdit ? () => onEdit(1) : undefined}
          rows={{
            "Account Number": data.bankAccountNumber,
            "Confirm Account Number": data.confirmBankAccountNumber,
            IFSC: data.ifsc,
            MICR: data.micr,
            "Account Type": data.bankAccountType,
            "Bank Name": data.bankInfo?.bank_name,
            Branch: data.bankInfo?.branch_name,
            "Account Status": data.bankVerification?.status === "ACTIVE" ? "Active (verified)" : undefined,
            "Account Holder": data.bankVerification?.account_holder_name,
            "Bank Statement": data.bankStatement?.name,
          }}
        />
        <Review
          title="HUF Bank Statement Address"
          onEdit={onEdit ? () => onEdit(1) : undefined}
          rows={{
            Address: data.statementAddress.address,
            City: data.statementAddress.city,
            District: data.statementAddress.district,
            State: data.statementAddress.state,
            Pincode: data.statementAddress.pincode,
          }}
        />
        <Review
          title="Karta Personal Profile"
          onEdit={onEdit ? () => onEdit(2) : undefined}
          rows={{
            Name: data.karta.fullName,
            PAN: data.karta.pan,
            "Date of Birth": displayDob(data.karta.dob),
            Gender: data.karta.gender,
            "Father's Name": data.karta.fatherName,
            "Mother's Name": data.karta.motherName,
            Occupation: data.karta.occupation,
            "Place of Incorporation": data.karta.placeOfIncorporation,
            "Annual Income": data.karta.annualIncome,
            "Net Worth": data.karta.netWorth,
            "Aadhaar Last 4 Digits": data.karta.aadhaarLast4,
            Address: data.karta.address,
            City: data.karta.city,
            District: data.karta.district,
            State: data.karta.state,
            Pincode: data.karta.pincode,
            "PEP Status": data.karta.pep,
          }}
        />
        <Review
          title="PAN Documents"
          onEdit={onEdit ? () => onEdit(0) : undefined}
          rows={{
            "HUF PAN Number": data.hufPan,
            "HUF PAN": data.hufPanFile?.name,
            "Karta PAN Number": data.karta.pan,
            "Karta PAN": data.kartaPanFile?.name,
          }}
        />
        <Review
          title="HUF Documents"
          onEdit={onEdit ? () => onEdit(3) : undefined}
          rows={{
            "Stamped / Sealed HUF Deed": data.hufDeed?.name,
            "Karta Aadhaar Card": data.kartaAadhaarFile?.name,
          }}
        />
        {data.coparceners.map((c, i) => (
          <Review
            key={c.id}
            title={"Co-parcener " + (i + 1)}
            onEdit={onEdit ? () => onEdit(2) : undefined}
            rows={{
              Name: c.fullName,
              Relationship: c.relationship,
              "Date of Birth": displayDob(c.dob),
              Minor: c.isMinor ? "Yes" : "No",
              "HUF Seal with Sign": c.signature?.name,
            }}
          />
        ))}
      </div>
      {link && (
        <div className="link-box">
          <b>Client continuation link</b>
          <a href={link}>{link}</a>
          <small>
            The client can use this link to continue their application.
          </small>
        </div>
      )}
    </>
  );
}

function Review({ title, rows, onEdit }) {
  return (
    <div className="review">
      <div className="review-heading">
        <h3>{title}</h3>
        {onEdit && (
          <button
            type="button"
            className="mini"
            onClick={onEdit}
            aria-label={"Edit " + title}
          >
            Edit
          </button>
        )}
      </div>
      {Object.entries(rows).map(([k, v]) => (
        <div className="review-row" key={k}>
          <span>{k}</span>
          <b>{String(v || "-")}</b>
        </div>
      ))}
    </div>
  );
}
function mask(v = "") {
  return v ? `••••••${v.slice(-4)}` : "-";
}
function safeForm(d) {
  return {
    ...d,
    hufPanFile: null,
    kartaPanFile: null,
    bankStatement: null,
    hufDeed: null,
    kartaAadhaarFile: null,
    coparceners: d.coparceners.map((c) => ({ ...c, signature: null })),
  };
}
// PAN format ABCDE1234F; the 4th letter is the holder type (H = HUF, P = individual).
function panError(value, label, typeLetter, typeName) {
  if (!value) return `Enter the ${label} number.`;
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value))
    return `Enter a valid ${label}: five letters, four digits and one letter (ABCDE1234F).`;
  if (value[3] !== typeLetter)
    return `${label} must be a ${typeName} PAN: the 4th letter must be ${typeLetter}.`;
  return "";
}
const hufPanError = (v) => panError(v, "HUF PAN", "H", "HUF");
const kartaPanError = (v) => panError(v, "Karta PAN", "P", "individual");

// Typing filters: strip characters a field can never contain.
const onlyDigits = (max) => (v) => v.replace(/\D/g, "").slice(0, max);
const onlyLetters = (v) => v.replace(/[^A-Za-z .']/g, "").replace(/ {2,}/g, " ");
const onlyAlnumUpper = (max) => (v) =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

// Rules return "" when valid, otherwise the message to show.
const blank = (v) => !String(v ?? "").trim();
const nameRule = (label, required) => (v) =>
  blank(v)
    ? required
      ? `Enter the ${label}.`
      : ""
    : /^[A-Za-z][A-Za-z .']*$/.test(v.trim()) && v.trim().length >= 2
      ? ""
      : `${label[0].toUpperCase() + label.slice(1)} must contain letters only (at least 2).`;
const exactDigitsRule = (label, n, required) => (v) =>
  blank(v)
    ? required
      ? `Enter the ${label}.`
      : ""
    : new RegExp(`^\\d{${n}}$`).test(v)
      ? ""
      : `${label[0].toUpperCase() + label.slice(1)} must be exactly ${n} digits.`;
const dobRule = (required) => (v) =>
  blank(v)
    ? required
      ? "Enter the date of birth."
      : ""
    : validDob(v)
      ? ""
      : "Enter a valid date in DD/MM/YYYY format, not in the future.";

const rules = {
  accountNumber: (v) =>
    blank(v)
      ? "Enter the bank account number."
      : /^\d{9,18}$/.test(v)
        ? ""
        : "Account number must be 9 to 18 digits.",
  confirmAccountNumber: (v, d) =>
    blank(v)
      ? "Re-enter the bank account number."
      : v !== d.bankAccountNumber
        ? "Account numbers do not match."
        : "",
  ifsc: (v) =>
    blank(v)
      ? "Enter the IFSC."
      : /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)
        ? ""
        : "IFSC must be 11 characters: 4 letters, then 0, then 6 letters or digits.",
  micr: exactDigitsRule("MICR code", 9, true),
  accountType: (v) => (ACCOUNT_TYPES.includes(v) ? "" : "Select the account type."),
  gender: (v) => (blank(v) || GENDERS.includes(v) ? "" : "Select the gender."),
  kartaName: nameRule("Karta full name", true),
  kartaDob: dobRule(false),
  fatherName: nameRule("father's name", false),
  motherName: nameRule("mother's name", false),
  placeOfIncorporation: nameRule("place of incorporation", false),
  occupation: (v) =>
    blank(v) || /^[A-Za-z][A-Za-z &/.,-]*$/.test(v.trim())
      ? ""
      : "Occupation must contain letters only.",
  annualIncome: (v) =>
    blank(v) || INCOME_RANGES.includes(v) ? "" : "Select the annual income range.",
  netWorth: (v) =>
    blank(v) || NET_WORTH_RANGES.includes(v) ? "" : "Select the net worth range.",
  aadhaarLast4: exactDigitsRule("Aadhaar last 4 digits", 4, false),
  city: nameRule("city", false),
  district: nameRule("district", false),
  state: nameRule("state", false),
  pincode: (v) =>
    blank(v) || /^[1-9]\d{5}$/.test(v)
      ? ""
      : "Pincode must be 6 digits and cannot start with 0.",
  pep: (v) =>
    v === "YES"
      ? "Politically Exposed Persons cannot be onboarded online."
      : "",
  cpName: nameRule("co-parcener full name", true),
  cpDob: dobRule(true), // required: it decides whether the co-parcener is a minor
};
// HUF bank statement address (same rules in server/src/hufValidation.js); every field is required.
const statementAddressRules = {
  address: (v) => (blank(v) ? "Enter the address as on the HUF bank statement." : ""),
  city: nameRule("city", true),
  district: nameRule("district", true),
  state: nameRule("state", true),
  pincode: (v) =>
    /^[1-9]\d{5}$/.test(v || "") ? "" : "Pincode must be 6 digits and cannot start with 0.",
};
function validate(step, d) {
  if (step === 0) {
    const error = mobileError(d.mobile) || gmailError(d.email);
    if (error) throw Error(error);
  }
  if (step === 0) {
    const error = hufPanError(d.hufPan) || kartaPanError(d.karta.pan);
    if (error) throw Error(error);
  }
  if (step === 0 && (!d.hufPanFile || !d.kartaPanFile))
    throw Error("Upload both HUF PAN and Karta PAN.");
  if (step === 1) {
    const error =
      rules.accountNumber(d.bankAccountNumber) ||
      rules.confirmAccountNumber(d.confirmBankAccountNumber, d) ||
      rules.ifsc(d.ifsc) ||
      rules.micr(d.micr) ||
      rules.accountType(d.bankAccountType);
    if (error) throw Error(error);
    for (const [k, rule] of Object.entries(statementAddressRules)) {
      const issue = rule(d.statementAddress[k]);
      if (issue) throw Error("HUF bank statement address: " + issue);
    }
    if (!d.bankStatement)
      throw Error("Upload the latest 3-month HUF bank statement.");
  }
  if (step === 2) {
    const k = d.karta;
    const kartaError =
      rules.kartaName(k.fullName) ||
      kartaPanError(k.pan) ||
      rules.kartaDob(k.dob) ||
      rules.gender(k.gender) ||
      rules.fatherName(k.fatherName) ||
      rules.motherName(k.motherName) ||
      rules.occupation(k.occupation) ||
      rules.placeOfIncorporation(k.placeOfIncorporation) ||
      rules.annualIncome(k.annualIncome) ||
      rules.netWorth(k.netWorth) ||
      rules.aadhaarLast4(k.aadhaarLast4) ||
      rules.city(k.city) ||
      rules.district(k.district) ||
      rules.state(k.state) ||
      rules.pincode(k.pincode) ||
      rules.pep(k.pep);
    if (kartaError) throw Error("Karta: " + kartaError);
    if (!d.coparceners.length) throw Error("Add at least one co-parcener.");
    d.coparceners.forEach((c, i) => {
      const error =
        (c.relationship ? "" : "Select the relationship.") ||
        rules.cpName(c.fullName) ||
        rules.cpDob(c.dob) ||
        (c.signature ? "" : "Upload the HUF seal with sign.");
      if (error) throw Error(`Co-parcener ${i + 1}: ${error}`);
    });
  }
  if (step === 3 && !d.hufDeed)
    throw Error("Upload the HUF deed with its stamp or seal.");
  if (step === 3 && !d.kartaAadhaarFile) throw Error("Upload the Karta Aadhaar card.");
}
// Server stage saved by each form section (index = step); Preview has none.
const STAGES = ["CONTACT_PAN", "BANK_DETAILS", "KARTA_COPARCENERS", "HUF_DOCUMENTS"];
// Files sent with each section, as multipart field names expected by POST /api/huf/applications/stage.
function stageFiles(step, d) {
  const files = [
    [["hufPanFile", d.hufPanFile], ["kartaPanFile", d.kartaPanFile]],
    [["bankStatement", d.bankStatement]],
    d.coparceners.map((c) => [`signature:${c.id}`, c.signature]),
    [["hufDeed", d.hufDeed], ["kartaAadhaarFile", d.kartaAadhaarFile]],
  ][step] || [];
  return files.filter(([, file]) => file);
}
export default App;
