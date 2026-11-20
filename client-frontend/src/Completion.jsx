import React, { useEffect, useState } from "react";
import { Check, Download, Loader2, AppWindow, ArrowRight } from "lucide-react";
import { getApplicationPdf, getApplicationPdfLink } from "./api";

// Where the client goes once the HUF journey is finished.
export const AIONION_SITE = "https://www.aionioncapital.com/";
const REDIRECT_SECONDS = 5;

// Full-page thank-you screen, shown once the application is signed. After 5 seconds the client is
// sent to the AIONION website; replace() keeps the finished journey out of the back history.
export default function Completion({ token, application }) {
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const [download, setDownload] = useState("");
  const go = () => window.location.replace(AIONION_SITE);

  // The signed account opening form, saved by the server when the application was signed.
  const downloadForm = async () => {
    setDownload("busy");
    try {
      // Live: a temporary S3 link that downloads the form directly (it is too large to pass
      // through the API). Local development: the PDF bytes from the server.
      const link = await getApplicationPdfLink(token);
      if (link) {
        window.location.assign(link); // S3 sends it as a download, so this page stays open
        setDownload("");
        return;
      }
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
        go();
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="thanks-page">
      <span className="thanks-wave thanks-wave-tl" aria-hidden="true" />
      <span className="thanks-wave thanks-wave-br" aria-hidden="true" />
      <main className="thanks">
        <img src="/aionion-logo.png" className="thanks-logo" alt="AIONION Capital" />

        <div className="thanks-check" aria-hidden="true">
          <span className="burst burst-left">
            <i />
            <i />
            <i />
          </span>
          <span className="thanks-check-ring">
            <span className="thanks-check-dot">
              <Check size={54} strokeWidth={3.5} />
            </span>
          </span>
          <span className="burst burst-right">
            <i />
            <i />
            <i />
          </span>
        </div>

        <h1 className="thanks-title">
          <span className="blue">Thank</span> <span className="pink">You!</span>
        </h1>

        <div className="thanks-banner">
          <b>You have successfully completed</b>
          <b className="blue">HUF Account Opening.</b>
        </div>

        <p className="thanks-text">
          Your details have been submitted successfully.
          <br />
          You will now be redirected to <b className="blue">AIONION Capital.</b>
        </p>

        <div className="thanks-redirect" role="status" aria-live="polite">
          <AppWindow size={34} className="thanks-redirect-icon" aria-hidden="true" />
          <span className="thanks-redirect-text">Redirecting to AIONION Capital in</span>
          <button type="button" className="thanks-count" onClick={go} title="Go to AIONION Capital now">
            {left} second{left === 1 ? "" : "s"}…
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>

        <button className="thanks-download" onClick={downloadForm} disabled={download === "busy"}>
          {download === "busy" ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          Download signed application form
        </button>
        {download && download !== "busy" && <small className="field-error">{download}</small>}

        <div className="thanks-tagline">
          <span />
          <p>
            Together for a <b>Better Tomorrow</b>
          </p>
          <span />
        </div>
      </main>
    </div>
  );
}
