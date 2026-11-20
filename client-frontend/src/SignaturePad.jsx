import React, { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine, Upload, ImageUp, Trash2 } from "lucide-react";
import { submitSignature } from "./api";

// Shorter than this (in CSS pixels of pen travel) is a dot or a tap, not a signature.
const MIN_INK = 120;
const HEIGHT = 200;
// Uploaded signature image: PNG or JPG up to 5 MB. It is placed on white, scaled to fit this box
// and sent as PNG, the same as a drawn signature.
const UPLOAD_TYPES = ["image/png", "image/jpeg"];
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const OUT_MAX_W = 900;
const OUT_MAX_H = 450;

// Two ways to sign: draw (mouse, finger or stylus) or upload an image of the signature.
// Pointer events cover all drawing devices; touch-action:none on the canvas stops the page from
// scrolling while signing on a phone.
export default function SignaturePad({ token, onSigned }) {
  const canvasRef = useRef(null);
  const drawing = useRef(null); // last point while the pen is down
  const [mode, setMode] = useState("draw");
  const [ink, setInk] = useState(0);
  const [upload, setUpload] = useState(null); // { name, url }
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Size the bitmap to the box at the screen's pixel density so strokes stay sharp. A resize clears
  // the drawing, so it only runs on mount and when the width actually changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    let width = 0;
    const fit = () => {
      const w = canvas.clientWidth;
      if (!w || w === width) return; // 0 while the Upload tab hides it: keep the drawing
      width = w;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b1a3a";
      setInk(0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  // Release the preview image when it is replaced or the pad goes away.
  useEffect(() => () => upload && URL.revokeObjectURL(upload.url), [upload]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    if (busy) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = point(e);
    drawing.current = p;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    setError("");
  };
  const move = (e) => {
    const last = drawing.current;
    if (!last) return;
    const ctx = canvasRef.current.getContext("2d");
    // Coalesced events keep fast strokes smooth where the browser supports them.
    for (const ev of e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent]) {
      const p = point(ev);
      ctx.beginPath();
      ctx.moveTo(drawing.current.x, drawing.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      const d = Math.hypot(p.x - drawing.current.x, p.y - drawing.current.y);
      drawing.current = p;
      setInk((n) => n + d);
    }
  };
  const up = () => {
    drawing.current = null;
  };
  const clear = () => {
    if (mode === "upload") setUpload(null);
    else {
      const canvas = canvasRef.current;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      setInk(0);
    }
    setError("");
  };

  const pickFile = (file) => {
    setError("");
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type)) return setError("Upload a PNG or JPG image of your signature.");
    if (file.size > UPLOAD_MAX_BYTES) return setError("The signature image must be 5 MB or smaller.");
    setUpload({ name: file.name, url: URL.createObjectURL(file) });
  };

  // Drawn: the canvas on white. Uploaded: the image on white, scaled to fit OUT_MAX_W x OUT_MAX_H.
  const signatureBlob = async () => {
    const out = document.createElement("canvas");
    const ctx = out.getContext("2d");
    if (mode === "draw") {
      const src = canvasRef.current;
      out.width = src.width;
      out.height = src.height;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0);
    } else {
      const img = new Image();
      img.src = upload.url;
      await img.decode().catch(() => {
        throw new Error("This image could not be read. Upload a PNG or JPG image of your signature.");
      });
      // Scaled to fit the box (small images are enlarged so the result is a usable size).
      const scale = Math.min(OUT_MAX_W / img.naturalWidth, OUT_MAX_H / img.naturalHeight);
      out.width = Math.max(1, Math.round(img.naturalWidth * scale));
      out.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(img, 0, 0, out.width, out.height);
    }
    return new Promise((resolve) => out.toBlob(resolve, "image/png"));
  };

  const submit = async () => {
    if (mode === "draw" && ink < MIN_INK) return setError("Draw your full signature in the box.");
    if (mode === "upload" && !upload) return setError("Choose an image of your signature to upload.");
    if (!confirmed) return setError("Tick the box to confirm this is your signature.");
    setBusy(true);
    setError("");
    try {
      onSigned(await submitSignature(token, await signatureBlob(), mode === "upload" ? "UPLOAD" : "DRAW"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m) => {
    if (busy) return;
    setMode(m);
    setError("");
  };
  const empty = mode === "draw" ? ink === 0 : !upload;

  return (
    <div className="signature-pad">
      <div className="signature-tabs" role="tablist" aria-label="How to sign">
        <button role="tab" aria-selected={mode === "draw"} className={mode === "draw" ? "active" : ""} onClick={() => switchTo("draw")}>
          <PenLine size={16} />
          Draw signature
        </button>
        <button role="tab" aria-selected={mode === "upload"} className={mode === "upload" ? "active" : ""} onClick={() => switchTo("upload")}>
          <Upload size={16} />
          Upload signature
        </button>
      </div>

      {/* The canvas stays mounted so a drawing survives a look at the upload tab. */}
      <div className="signature-box" hidden={mode !== "draw"}>
        <canvas
          ref={canvasRef}
          style={{ height: HEIGHT }}
          aria-label="Signature box. Draw your signature here."
          role="img"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
        />
        {ink === 0 && <span className="signature-hint">Sign here</span>}
        <span className="signature-line" aria-hidden="true" />
      </div>

      {mode === "upload" &&
        (upload ? (
          <div className="signature-box signature-preview" style={{ height: HEIGHT }}>
            <img src={upload.url} alt="Uploaded signature" />
            <span className="signature-file">{upload.name}</span>
          </div>
        ) : (
          <label className="upload signature-upload" style={{ minHeight: HEIGHT }}>
            <ImageUp size={22} />
            <div>
              <b>Choose your signature image</b>
              <small>PNG or JPG, up to 5 MB. Sign on plain white paper and take a clear, straight photo or scan.</small>
            </div>
            <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => pickFile(e.target.files?.[0])} disabled={busy} />
          </label>
        ))}

      <label className="consent-box">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
        <span>
          <b>I confirm this is my signature.</b>
          <small>
            As the Karta, I sign this HUF account opening application with the signature above and agree that it may be
            used for this application.
          </small>
        </span>
      </label>
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
      <div className="otp-actions">
        <button className="btn secondary" onClick={clear} disabled={busy || empty}>
          {mode === "draw" ? <Eraser size={18} /> : <Trash2 size={18} />}
          {mode === "draw" ? "Clear" : "Remove"}
        </button>
        <button className="btn primary" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <PenLine size={18} />}
          {busy ? "Submitting…" : "Submit Signature"}
        </button>
      </div>
    </div>
  );
}
