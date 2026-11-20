import React, { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, ArrowRight, Download, Loader2 } from "lucide-react";
import { getApplicationPdf } from "./api";
import { SectionTitle, Review } from "./ui.jsx";

// Where the client goes once the HUF journey is finished.
export const AIONION_SITE = "https://www.aionioncapital.com/";
const REDIRECT_SECONDS = 8;

const when = (v) => (v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

// Shown once the application is signed; after 8 seconds the client is sent to the AIONION website.
// replace() keeps the finished journey out of the back history.
export default function Completion({ token, application, signature }) {
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const [download, setDownload] = useState("");
  // The signed account opening form, saved by the server when the application was signed.
  const downloadForm = async () => {
    setDownload("busy");
    try {
      const url = URL.createObjectURL(await getApplicationPdf(token));
      const a = Object.assign(document.createElement("a"), { href: url, download: `HUF_Account_Opening_${application?.id || ""}.pdf` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDownload("");
    } catch (e) {
      setDownload(e.message);
    }
  };
  useEffect(() => {
    const end = Date.now() + REDIRECT_SECONDS * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (!s) {
        clearInterval(t);
        window.location.replace(AIONION_SITE);
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  const f = application?.form_data || {};
  return (
    <>
      <SectionTitle
        title="Congratulations!"
        sub="Your HUF account opening application with AIONION Capital is complete."
      />
      <div className="status-box success" role="status">
        <CheckCircle2 size={24} />
        <div>
          <b>HUF application submitted successfully</b>
          <small>
            Details verified, payment received, live photo captured and application signed on {when(signature?.signedAt)}.
          </small>
          <button className="mini download-form" onClick={downloadForm} disabled={download === "busy"}>
            {download === "busy" ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            Download signed application form
          </button>
          {download && download !== "busy" && <small className="field-error">{download}</small>}
        </div>
      </div>

      <div className="preview-grid done-grid">
        <Review
          title="Application Summary"
          rows={{
            "HUF PAN": f.hufPan,
            Karta: f.karta?.fullName,
            "Co-parceners": f.coparceners?.length ?? 0,
            "Signed On": when(signature?.signedAt),
            Status: "Submitted for verification",
          }}
        />
        <div className="otp-card">
          <div className="otp-head">
            <span className="permission-icon">
              <ClipboardList size={20} />
            </span>
            <div>
              <b>What happens next</b>
              <small>No further action is needed from you right now.</small>
            </div>
          </div>
          <ol className="next-steps">
            <li>Our team verifies the HUF deed, PAN and bank documents you submitted.</li>
            <li>Once approved, your HUF trading and demat account details are sent to your registered email and mobile.</li>
            <li>For any questions, contact your AIONION Capital relationship manager.</li>
          </ol>
        </div>
      </div>

      <div className="redirect-card" role="status" aria-live="polite">
        <div className="redirect-text">
          <ExternalLink size={18} />
          <span>
            Taking you to <b>aionioncapital.com</b> in {left} second{left === 1 ? "" : "s"}…
          </span>
        </div>
        <div className="redirect-track" aria-hidden="true">
          <span style={{ animationDuration: `${REDIRECT_SECONDS}s` }} />
        </div>
        <a className="btn primary" href={AIONION_SITE} onClick={(e) => (e.preventDefault(), window.location.replace(AIONION_SITE))}>
          Go to AIONION Capital now
          <ArrowRight size={18} />
        </a>
      </div>
    </>
  );
}
