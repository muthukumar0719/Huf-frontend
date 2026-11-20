import React, { useEffect, useRef, useState } from "react";
import { Camera, MapPin, CheckCircle2, XCircle, RefreshCw, Loader2, Upload, ArrowRight } from "lucide-react";
import { uploadLivePhoto } from "./api";
import { countFaces, faceProblem, preloadFaceCheck } from "./faceCheck";
import { SectionTitle } from "./ui.jsx";

const PERMISSION_TEXT = {
  idle: "Not requested yet",
  pending: "Waiting for your permission…",
  granted: "Allowed",
  denied: "Blocked",
  prompt: "Not allowed yet",
  unavailable: "Unavailable",
};

// Chrome on Windows can call the error callback with code 1 and then the success callback for
// the same request. So a code 1 is held back (unless the browser says the permission is denied)
// to let a late position through, instead of settling the promise on the first callback.
const LATE_POSITION_MS = 15000;
const locate = (options) =>
  new Promise((resolve, reject) => {
    let timer;
    let settled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("[LivePhoto] position callback", { settled, lat: pos.coords.latitude });
        clearTimeout(timer);
        settled = true;
        resolve(pos);
      },
      async (err) => {
        console.log("[LivePhoto] error callback", { code: err.code, message: err.message, settled });
        if (err.code !== 1 || (await geoPermissionState()) === "denied") {
          settled = true;
          return reject(err);
        }
        timer = setTimeout(() => {
          settled = true;
          reject(err);
        }, LATE_POSITION_MS);
      },
      options,
    );
  });

// High accuracy first; a PC without GPS can fail that (code 2/3) and still have a
// network position. A denial (code 1) is not retried here.
async function getPosition() {
  try {
    return await locate({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  } catch (e) {
    if (e.code === 1) throw e;
    return locate({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  }
}
const settle = (promise) =>
  promise.then((value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason }));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geoPermissionState() {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "unknown";
  }
}

// Resolves to { status, position?, code? }. status is "granted" only with real coordinates;
// "denied" only when the browser reports the permission as denied; "prompt" when the request
// was refused (code 1) while the browser still says "ask" — its prompt was closed or suppressed;
// "unavailable" when the permission is granted but no position came back (code 1/2/3).
async function requestLocation(attempts = 2) {
  const before = await geoPermissionState();
  console.log("[LivePhoto] browser location permission:", before);
  if (before === "denied") return { status: "denied", code: 1 };
  for (let i = 1; ; i++) {
    console.log("[LivePhoto] location request started:", { attempt: i });
    const loc = await settle(getPosition());
    if (loc.status === "fulfilled") {
      const { latitude, longitude, accuracy } = loc.value.coords;
      console.log("[LivePhoto] location success:", { latitude, longitude, accuracy });
      if (Number.isFinite(latitude) && Number.isFinite(longitude))
        return { status: "granted", position: { latitude, longitude, accuracy } };
      return { status: "unavailable" };
    }
    const { code, message } = loc.reason;
    const state = await geoPermissionState();
    console.log("[LivePhoto] location error:", { code, message, browserPermission: state, attempt: i });
    if (state === "denied") return { status: "denied", code };
    if (code !== 1) return { status: "unavailable", code }; // 2 or 3, after the low-accuracy retry
    if (state === "prompt") return { status: "prompt", code };
    if (state === "unknown") return { status: "denied", code }; // no Permissions API: code 1 is all we know
    // Granted, yet refused: retry a fresh request before giving up.
    if (i === attempts) return { status: "unavailable", code };
    await wait(1000 * i);
  }
}

export default function LivePhoto({ token, done, onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestId = useRef(0);
  const [perm, setPerm] = useState({ camera: "idle", location: "idle" });
  const [stream, setStream] = useState(null);
  const [position, setPosition] = useState(null);
  const [shot, setShot] = useState(null); // { url, blob, faces, problem }
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  };
  useEffect(() => {
    if (!done) preloadFaceCheck();
    return stopCamera;
  }, []);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

  const requestAccess = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !navigator.geolocation) {
      setError("This browser cannot use the camera or location here. Open the link in Chrome, Safari or Edge over a secure (https) connection.");
      return;
    }
    const id = ++requestId.current;
    setPosition(null);
    setPerm({ camera: "pending", location: "pending" });
    // Camera first, then location on its own: a location prompt raised together with the
    // camera prompt can be answered with code 1 although a request by itself succeeds.
    const cam = await settle(
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }),
    );
    const loc = await requestLocation();
    if (id !== requestId.current) {
      console.log("[LivePhoto] discarding stale result", { id, latest: requestId.current });
      if (cam.status === "fulfilled") cam.value.getTracks().forEach((t) => t.stop());
      return;
    }
    if (cam.status === "fulfilled") {
      stopCamera();
      streamRef.current = cam.value;
      setStream(cam.value);
    }
    setPosition(loc.position ?? null);
    console.log("[LivePhoto] final location permission state:", { location: loc.status, code: loc.code, id });
    setPerm({ camera: cam.status === "fulfilled" ? "granted" : "denied", location: loc.status });
    if (cam.status === "rejected")
      setError("Camera and location are both required. Allow them from your browser's site settings (the icon next to the address bar), then try again.");
    else if (loc.status === "denied")
      setError("Location access is blocked. Allow Location for this site from the icon next to the address bar, then click Try Again.");
    else if (loc.status === "prompt")
      setError(
        "Your browser did not allow the location request. Click the location icon in the address bar, choose Allow (or Reset permission), then click Try Again.",
      );
    else if (loc.status === "unavailable")
      setError("Location is allowed but your position could not be found. Turn on Windows Location services or Wi-Fi, then click Try Again.");
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setError("");
    setChecking(true);
    try {
      const faces = await countFaces(canvas);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      setShot({ url: URL.createObjectURL(blob), blob, faces, problem: faceProblem(faces) });
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    setUploading(true);
    setError("");
    try {
      const r = await uploadLivePhoto(token, { blob: shot.blob, position, faceCount: shot.faces });
      stopCamera();
      onDone(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const ready = perm.camera === "granted" && perm.location === "granted";
  return (
    <>
      <SectionTitle
        title="Live Photo"
        sub="Take a live photo of yourself. We record your location with the photo as part of in-person verification (IPV)."
      />
      {done ? (
        <div className="status-box success">
          <CheckCircle2 size={24} />
          <div>
            <b>Live photo verified</b>
            <small>Your photo and location have been recorded successfully. Continue to Signature.</small>
          </div>
        </div>
      ) : !ready ? (
        <div className="permission-panel">
          {[
            ["camera", Camera, "Camera", "To take your live photo"],
            ["location", MapPin, "Location", "Recorded with your photo"],
          ].map(([key, Icon, label, why]) => (
            <div className={`permission-row ${perm[key]}`} key={key}>
              <span className="permission-icon"><Icon size={20} /></span>
              <div>
                <b>{label}</b>
                <small>{why}</small>
              </div>
              <span className="permission-state">
                {perm[key] === "granted" && <CheckCircle2 size={16} />}
                {["denied", "prompt", "unavailable"].includes(perm[key]) && <XCircle size={16} />}
                {PERMISSION_TEXT[perm[key]]}
              </span>
            </div>
          ))}
          <button
            className="btn primary"
            onClick={requestAccess}
            disabled={perm.camera === "pending"}
          >
            {perm.camera === "pending" ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}
            {perm.camera === "idle" ? "Capture Live Photo" : "Try Again"}
            {perm.camera === "idle" && <ArrowRight size={18} />}
          </button>
        </div>
      ) : (
        <div className="camera-panel">
          <div className="camera-frame">
            <video ref={videoRef} autoPlay playsInline muted hidden={!!shot} />
            {shot && <img src={shot.url} alt="Your captured photo" />}
            {!shot && <div className="face-guide" aria-hidden="true" />}
          </div>
          <div className="camera-side">
            <ul className="tips">
              <li>Only you in the frame, facing the camera</li>
              <li>Good light on your face, no sunglasses or mask</li>
              <li>Hold still while the photo is checked</li>
            </ul>
            {shot &&
              (shot.problem ? (
                <div className="status-box error" role="alert">
                  <XCircle size={22} />
                  <div>
                    <b>Photo not accepted</b>
                    <small>{shot.problem}</small>
                  </div>
                </div>
              ) : (
                <div className="status-box success">
                  <CheckCircle2 size={22} />
                  <div>
                    <b>One face detected</b>
                    <small>Submit this photo for validation, or retake it.</small>
                  </div>
                </div>
              ))}
            <div className="camera-actions">
              {!shot ? (
                <button className="btn primary" onClick={capture} disabled={checking}>
                  {checking ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}
                  {checking ? "Checking photo…" : "Capture Photo"}
                </button>
              ) : (
                <>
                  <button className="btn secondary" onClick={() => setShot(null)} disabled={uploading}>
                    <RefreshCw size={18} />
                    Retake
                  </button>
                  {!shot.problem && (
                    <button className="btn primary" onClick={submit} disabled={uploading}>
                      {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                      {uploading ? "Submitting…" : "Submit Photo"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error inline-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
