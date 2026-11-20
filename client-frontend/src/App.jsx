import React, { useEffect, useRef, useState } from "react";
import {
  FileSearch,
  ShieldCheck,
  Smartphone,
  Mail,
  CreditCard,
  Camera,
  PenLine,
  CheckCircle2,
  ChevronLeft,
  ArrowRight,
  Loader2,
  Lock,
  Clock,
  ClipboardList,
  Info,
} from "lucide-react";
import {
  getApplication,
  giveConsent,
  sendOtp,
  verifyOtp,
  createPaymentOrder,
  verifyPayment,
  confirmPayment,
  reportPaymentFailure,
} from "./api";
import SignaturePad from "./SignaturePad.jsx";
import Completion from "./Completion.jsx";
import { payWithRazorpay } from "./razorpay";
import LivePhoto from "./LivePhoto.jsx";
import { SectionTitle, Review, rupees } from "./ui.jsx";

const steps = [
  { label: "Details", icon: FileSearch },
  { label: "Verify & Consent", icon: ShieldCheck },
  { label: "Payment", icon: CreditCard },
  { label: "Live Photo", icon: Camera },
  { label: "Signature", icon: PenLine },
];

// First step the client has not finished: the furthest step they may reach. The link always opens
// on the details preview, and each button moves only to the immediate next step.
function firstUnfinished(p) {
  if (!p.mobileVerified || !p.emailVerified || !p.consent) return 1;
  if (!p.paid) return 2;
  if (!p.photo) return 3;
  return 4;
}


export default function App() {
  // Emailed link: /huf/client/<token>; older links used ?token=<token>.
  const token =
    location.pathname.match(/^\/huf\/client\/([A-Za-z0-9_-]+)\/?$/)?.[1] ||
    new URLSearchParams(location.search).get("token");
  const [state, setState] = useState(null); // { application, progress, quote }
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fatal, setFatal] = useState(
    token ? "" : "This link is incomplete. Open the link exactly as it appears in your email.",
  );
  // OTPs verified during this visit. Earlier verifications are not carried over: reopening the
  // link asks for both again before the client can move past this page.
  const [verifiedNow, setVerifiedNow] = useState({ MOBILE: false, EMAIL: false });
  const bothVerifiedNow = verifiedNow.MOBILE && verifiedNow.EMAIL;
  // Likewise a stored payment counts only once the server has re-confirmed it with Razorpay during
  // this visit. A live photo saved on an earlier visit (after the payment) still counts, so a
  // returning client resumes from the last completed stage.
  const [confirmedNow, setConfirmedNow] = useState({ payment: false });
  const maxStep = useRef(0);

  const stored = state?.progress;
  const p = stored && {
    ...stored,
    paid: stored.paid && confirmedNow.payment,
    photo: stored.photo && stored.paid && confirmedNow.payment,
  };
  if (p) maxStep.current = bothVerifiedNow ? firstUnfinished(p) : 1;

  useEffect(() => {
    if (!token) return;
    getApplication(token)
      .then((r) => {
        setState(r);
        history.replaceState({ step: 0 }, "");
      })
      .catch((e) => setFatal(e.message));
  }, []);

  // Browser back/forward moves between steps already reached, never past them.
  useEffect(() => {
    const onPop = (e) => {
      if (typeof e.state?.step !== "number") return;
      const s = Math.min(e.state.step, maxStep.current);
      if (s !== e.state.step) history.replaceState({ step: s }, "");
      setNotice("");
      setStep(s);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const go = (index) => {
    setNotice("");
    setStep(index);
    history.pushState({ step: index }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Razorpay checkout opens only from Pay Now on the payment page. A payment stored earlier is never
  // shown as successful on trust: the server re-confirms it with Razorpay first, and resets it if
  // Razorpay does not confirm it. The success screen appears only after that backend confirmation.
  const payment = async (alreadyPaid) => {
    if (alreadyPaid) {
      try {
        setState(await confirmPayment(token));
      } catch (e) {
        setState(await getApplication(token)); // the server may have reset an unconfirmed payment
        throw e;
      }
    } else {
      const order = await createPaymentOrder(token);
      // A failed attempt is shown and recorded on the server; recording never blocks a retry.
      const result = await payWithRazorpay(order, (message, error) => {
        setNotice(message);
        if (error) reportPaymentFailure(token, error).catch(() => {});
      });
      setNotice("");
      setState(await verifyPayment(token, result));
    }
    setConfirmedNow((c) => ({ ...c, payment: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const consent = () =>
    run(async () => {
      const r = await giveConsent(token);
      setState(r);
      go(2);
    });
  // The scheme and amount are always shown first; nothing happens until Pay Now is clicked.
  const toPayment = () => go(2);
  // With live keys a payment already on record is only verified with Razorpay, never taken twice.
  // In local Razorpay test mode the checkout opens every time, so the flow can be tested again.
  const verifyOnly = stored?.paid && !state?.paymentRepeatAllowed;
  const pay = () => run(() => payment(verifyOnly));
  const signed = !!p?.signed;

  const footer = p && [
    { label: "Next", onClick: () => go(1) },
    p.consent
      ? { label: "Continue to Payment", onClick: toPayment, disabled: !bothVerifiedNow }
      : {
          label: "I Give My Consent",
          icon: ShieldCheck,
          onClick: consent,
          disabled: !bothVerifiedNow,
          busyLabel: "Saving consent…",
        },
    p.paid
      ? { label: "Continue to Live Photo", onClick: () => go(3) }
      : verifyOnly
        ? { label: "Verify Payment", icon: Lock, onClick: pay, busyLabel: "Verifying payment…" }
        : { label: `Pay Now ₹${rupees(state.quote.total)}`, icon: Lock, onClick: pay, busyLabel: "Processing payment…" },
    { label: "Continue to Signature", onClick: () => go(4), disabled: !p.photo },
    null, // the signature pad has its own Submit button
  ][step];
  const FooterIcon = footer?.icon;
  // The bar only fills once the application is signed, not on reaching the signature step.
  const progressPct = signed ? 100 : Math.round((step / steps.length) * 100);

  // Signed: the full-page thank-you screen, which moves on to aionioncapital.com after 5 seconds.
  if (signed && state) return <Completion token={token} application={state.application} />;

  return (
    <div className="app-shell">
      <div className="orb orb1" />
      <div className="orb orb2" />
      <main className="glass-panel">
        <header className="topbar">
          <img src="/aionion-logo.png" className="logo" alt="AIONION Capital" />
          <div className="topbar-text">
            <div className="eyebrow">AIONION CAPITAL • NON-INDIVIDUAL ONBOARDING</div>
            <h1>HUF Account Opening</h1>
            <p>Review your details, verify, pay and complete your account opening.</p>
          </div>
          <span className="secure-chip">
            <Lock size={14} />
            Secure link
          </span>
        </header>
        {fatal ? (
          <section className="content-card">
            <SectionTitle title="We couldn't open your application" sub={fatal} />
          </section>
        ) : !state ? (
          <section className="content-card loading-card">
            <Loader2 size={22} className="spin" />
            Loading your application…
          </section>
        ) : (
          <>
            <section className="stepper-wrap" aria-label="Application progress">
              <div className="step-summary">
                <span>
                  Step {step + 1} of {steps.length}
                </span>
                <strong>{steps[step].label}</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${progressPct}%` }} />
              </div>
              <div className="stepper">
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  const done = i < maxStep.current || (i === 4 && signed);
                  return (
                    <div
                      className={`step ${i === step ? "active" : ""} ${done && i !== step ? "done" : ""}`}
                      key={s.label}
                      aria-current={i === step ? "step" : undefined}
                      aria-label={`${s.label}${done ? ", completed" : ""}`}
                    >
                      <div className="step-dot">
                        {done && i !== step ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                      </div>
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
            {notice && (
              <div className="notice" role="alert">
                {notice}
              </div>
            )}
            <section className="content-card">
              {step === 0 && <Preview data={state.application.form_data} />}
              {step === 1 && (
                <Verification
                  token={token}
                  state={state}
                  verifiedNow={verifiedNow}
                  onVerified={(channel, result) => {
                    setState(result);
                    setVerifiedNow((v) => ({ ...v, [channel]: true }));
                  }}
                />
              )}
              {step === 2 && (
                <Payment quote={state.quote} paid={p.paid} payment={state.payment} />
              )}
              {step === 3 && (
                <LivePhoto
                  token={token}
                  done={p.photo}
                  onDone={(r) => setState(r)}
                />
              )}
              {step === 4 && (
                <Signature
                  token={token}
                  progress={p}
                  signature={state.signature}
                  application={state.application}
                  onSigned={(r) => {
                    setState(r);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </section>
            <footer className="actions">
              {step === 1 && (
                <button className="btn secondary" disabled={busy} onClick={() => go(0)}>
                  <ChevronLeft size={18} />
                  Application details
                </button>
              )}
              {footer && (
                <button
                  className="btn primary"
                  disabled={busy || footer.disabled}
                  onClick={footer.onClick}
                >
                  {busy ? <Loader2 size={18} className="spin" /> : FooterIcon && <FooterIcon size={18} />}
                  {busy && footer.busyLabel ? footer.busyLabel : footer.label}
                  {!busy && !FooterIcon && <ArrowRight size={18} />}
                </button>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------- Page 1: the RM-submitted details, same layout as the RM Preview (read-only) ---------- */

function Preview({ data }) {
  return (
    <>
      <SectionTitle
        title="Review HUF Application"
        sub="Your relationship manager has submitted these details. If anything is incorrect, contact them before continuing."
      />
      <div className="preview-grid">
        <Review title="Client Contact" rows={{ Mobile: data.mobile, Email: data.email }} />
        <Review
          title="HUF Bank Details"
          rows={{
            "Account Number": data.bankAccountNumber,
            IFSC: data.ifsc,
            MICR: data.micr,
            "Account Type": data.bankAccountType,
            "Bank Name": data.bankName,
            Branch: data.bankBranch,
            "Account Holder": data.bankAccountHolder,
            "Bank Statement": data.bankStatement?.name,
          }}
        />
        <Review
          title="Karta Personal Profile"
          rows={{
            Name: data.karta.fullName,
            PAN: data.karta.pan,
            "Date of Birth": data.karta.dob,
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
          rows={{
            "HUF PAN Number": data.hufPan,
            "HUF PAN": data.hufPanFile?.name,
            "Karta PAN Number": data.karta.pan,
            "Karta PAN": data.kartaPanFile?.name,
          }}
        />
        <Review title="HUF Documents" rows={{ "Stamped / Sealed HUF Deed": data.hufDeed?.name }} />
        {data.coparceners.map((c, i) => (
          <Review
            key={c.id}
            title={"Co-parcener " + (i + 1)}
            rows={{
              Name: c.fullName,
              Relationship: c.relationship,
              "Date of Birth": c.dob,
              Mobile: c.mobile,
              Email: c.email,
              Minor: c.isMinor ? "Yes" : "No",
              ...(c.isMinor && c.guardianName?.trim() ? { "Guardian Name": c.guardianName } : {}),
              Signature: c.signature?.name,
            }}
          />
        ))}
      </div>
    </>
  );
}

/* ---------- Page 2: mobile OTP, then email OTP, then consent ---------- */

function Verification({ token, state, verifiedNow, onVerified }) {
  const { progress: p, application: a } = state;
  const count = Number(verifiedNow.MOBILE) + Number(verifiedNow.EMAIL);
  return (
    <>
      <div className="twofa-head">
        <span className="twofa-chip">
          <ShieldCheck size={14} />
          Step 1 · Two-factor
        </span>
        <span className="twofa-count" aria-live="polite">
          <b>{count}</b>/2 verified
        </span>
      </div>
      <SectionTitle
        title="Confirm it's you"
        sub="Your RM registered these. Just verify each with a one-time password, then give your consent."
      />
      <div className="twofa-bar" role="progressbar" aria-valuemin={0} aria-valuemax={2} aria-valuenow={count}>
        <span style={{ width: `${count * 50}%` }} />
      </div>
      <div className="verify-stack">
        {state.otpTestMode && (
          <div className="status-box pending" role="status">
            <Clock size={22} />
            <div>
              <b>LOCAL TEST MODE</b>
              <small>No real SMS or email is sent. After Send OTP, copy the OTP from the server console.</small>
            </div>
          </div>
        )}
        <OtpCard
          token={token}
          channel="MOBILE"
          name="Mobile"
          icon={Smartphone}
          label="Mobile number"
          value={a.mobile}
          verified={verifiedNow.MOBILE}
          onVerified={onVerified}
        />
        {/* The server sends the email OTP only once the mobile number is verified. */}
        <OtpCard
          token={token}
          channel="EMAIL"
          name="Email"
          icon={Mail}
          label="Email address"
          value={a.email}
          verified={verifiedNow.EMAIL}
          locked={!verifiedNow.MOBILE && "Verify your mobile number first."}
          onVerified={onVerified}
        />
      </div>
      {verifiedNow.MOBILE && verifiedNow.EMAIL && <Consent given={p.consent} />}
    </>
  );
}

// The registered mobile number / email comes from the application and cannot be edited; the
// OTP is sent to it (the server checks it is the registered one).
function OtpCard({ token, channel, name, icon: Icon, label, value, verified, locked, onVerified }) {
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const act = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const send = () =>
    act("send", async () => {
      const r = await sendOtp(token, channel, value);
      setSent(r);
      setCode("");
      setCooldown(r.resendInSeconds);
    });
  const verify = () => act("verify", async () => onVerified(channel, await verifyOtp(token, channel, code)));
  const status = verified ? "Verified" : locked ? "Locked" : sent ? "Enter OTP" : "Send OTP";

  return (
    <div className={`otp-card twofa ${verified ? "verified" : ""} ${locked && !verified ? "locked" : ""}`}>
      <div className="twofa-label">
        <span>
          <Icon size={15} />
          {label}
        </span>
        <span className={verified ? "verified-tag" : ""}>
          {verified && <CheckCircle2 size={15} />}
          {status}
        </span>
      </div>
      <div className="twofa-value" aria-label={`Registered ${label.toLowerCase()}`}>
        <span>{value}</span>
        <Lock size={15} aria-hidden="true" />
      </div>
      {!verified && (
        <>
          <input
            className="twofa-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            aria-label={`${name} OTP`}
            value={code}
            disabled={!sent || !!busy}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && !busy && verify()}
            aria-invalid={!!error}
          />
          <div className="twofa-meta">
            <small className="field-help">
              {locked
                ? locked
                : !sent
                  ? `We'll send a 6-digit OTP to this ${channel === "MOBILE" ? "number" : "address"}.`
                  : cooldown
                    ? <>Resend in <b>{cooldown}s</b></>
                    : "Didn't get it?"}
            </small>
            {!locked && (!sent || !cooldown) && (
              <button className="link-btn" onClick={send} disabled={!!busy}>
                {busy === "send" && <Loader2 size={14} className="spin" />}
                {sent ? "Resend OTP" : "Send OTP"}
              </button>
            )}
          </div>
          {sent?.testMode && (
            <small className="field-help">Test OTP printed in the server console, not sent.</small>
          )}
          {error && (
            <small className="field-error" role="alert">
              {error}
            </small>
          )}
          <button className="btn primary twofa-verify" onClick={verify} disabled={!sent || !!busy || code.length !== 6}>
            {busy === "verify" ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
            Verify
          </button>
        </>
      )}
    </div>
  );
}

function Consent({ given }) {
  return (
    <section className="consent-section">
      <h3>
        <ShieldCheck size={20} />
        Consent
      </h3>
      <p className="consent-statement">
        <b>
          I confirm that the above information is correct and I authorize the continuation of my
          account opening / re-KYC process.
        </b>
        <small>
          As the Karta, I confirm that the HUF, Karta and co-parcener details and documents I
          reviewed are true and complete, and I authorise AIONION Capital to use them to open the
          HUF account.
        </small>
      </p>
      {given && <p className="field-help consent-note">You have already given your consent.</p>}
    </section>
  );
}

/* ---------- Page 3: Razorpay payment ---------- */

// Add the published addresses here; until then the two buttons show as inactive.
const SCHEME_LINKS = { brokeragePlans: "", scheduleOfCharges: "" };

function SchemeLink({ label, href }) {
  const content = (
    <>
      <Info size={16} />
      {label}
    </>
  );
  return href ? (
    <a className="mini" href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    <span className="mini inactive" aria-disabled="true" title="Link not available yet">
      {content}
    </span>
  );
}

const paidOn = (v) =>
  v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-";

// Same building blocks as the other HUF steps: section title, bordered cards with a gradient icon
// tile, review rows and status boxes.
function Payment({ quote: q, paid, payment }) {
  const intra = q.taxType === "INTRA_STATE";
  if (paid)
    return (
      <>
        <SectionTitle
          title="Payment Successful"
          sub="Your payment has been verified with Razorpay. Next, take a quick live photo to continue your account opening."
        />
        <div className="status-box success pay-success" role="status">
          <CheckCircle2 size={24} />
          <div>
            <b>Congratulations!</b>
            <small>Your payment has been completed successfully.</small>
          </div>
        </div>
        <div className="preview-grid pay-grid">
          <Review
            title="Payment Receipt"
            rows={{
              Scheme: `${q.scheme} · Account Opening`,
              "Amount Paid": `₹${rupees(payment?.amount ?? q.total)}`,
              "Payment ID": payment?.id,
              "Paid On": paidOn(payment?.paidAt),
              Status: "Verified with Razorpay",
            }}
          />
        </div>
      </>
    );
  return (
    <>
      <SectionTitle
        title="Payment"
        sub="Review the account opening charges for your HUF account, then click Pay Now to pay securely with Razorpay."
      />
      <div className="preview-grid pay-grid">
        <div className="otp-card scheme">
          <div className="otp-head">
            <span className="permission-icon">
              <ClipboardList size={20} />
            </span>
            <div>
              <b>Scheme Detail · Account Opening Charges</b>
              <small>For Resident Individuals, Non-Resident Individuals (NRI), and Non-Individuals</small>
            </div>
          </div>
          <div className="scheme-price">
            <strong>₹{rupees(q.base, 0)}</strong>
            <span>Scheme + 18% GST</span>
          </div>
          <div className="scheme-tags">
            <span className="verified-tag">
              <CheckCircle2 size={16} />
              DP AMC : Nil
            </span>
            <span className="scheme-total">Total ₹{rupees(q.total)}</span>
          </div>
          <div className="scheme-links">
            <SchemeLink label="Brokerage Plans" href={SCHEME_LINKS.brokeragePlans} />
            <SchemeLink label="Schedule of Charges" href={SCHEME_LINKS.scheduleOfCharges} />
          </div>
        </div>
        <div className="review">
          <div className="review-heading">
            <h3>Payment Summary</h3>
          </div>
          <div className="review-row">
            <span>Base Amount</span>
            <b>₹{rupees(q.base)}</b>
          </div>
          {intra ? (
            <>
              <div className="review-row">
                <span>CGST (9%)</span>
                <b>₹{rupees(q.cgst)}</b>
              </div>
              <div className="review-row">
                <span>SGST (9%)</span>
                <b>₹{rupees(q.sgst)}</b>
              </div>
            </>
          ) : (
            <div className="review-row">
              <span>IGST (18%)</span>
              <b>₹{rupees(q.igst)}</b>
            </div>
          )}
          <div className="review-row total">
            <span>Total Payable</span>
            <b>₹{rupees(q.total)}</b>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Final step: web signature ---------- */

function Signature({ token, progress: p, application, signature, onSigned }) {
  // Signed: the congratulations screen, which moves on to aionioncapital.com after 8 seconds.
  if (p.signed) return <Completion token={token} application={application} signature={signature} />;
  return (
    <>
      <SectionTitle
        title="Sign Your Application"
        sub="Sign your HUF account opening application below to complete it. Your account opening form is prepared with your signature once you sign."
      />
      <div className="otp-card">
        <div className="otp-head">
          <span className="permission-icon">
            <PenLine size={20} />
          </span>
          <div>
            <b>Add your signature</b>
            <small>Draw it in the box with your mouse, finger or stylus, or upload a clear image of your signature.</small>
          </div>
        </div>
        <SignaturePad token={token} onSigned={onSigned} />
      </div>
    </>
  );
}
