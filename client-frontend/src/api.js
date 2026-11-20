const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function call(path, options) {
  let res;
  try {
    res = await fetch(`${API}/huf/client/${path}`, options);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
const post = (path, body = {}) =>
  call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const at = (token, rest = "") => encodeURIComponent(token) + rest;

export const getApplication = (token) => call(at(token));
// The filled account opening form (PDF) as a Blob.
export async function getApplicationPdf(token) {
  let res;
  try {
    res = await fetch(`${API}/huf/client/${at(token, "/application.pdf")}`, { cache: "no-store" });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "The application form could not be loaded.");
  return res.blob();
}
export const giveConsent = (token) => post(at(token, "/consent"), { confirmed: true });
export const sendOtp = (token, channel, entered) =>
  post(at(token, "/otp/send"), { channel, [channel === "MOBILE" ? "mobile" : "email"]: entered });
export const verifyOtp = (token, channel, code) => post(at(token, "/otp/verify"), { channel, code });
export const createPaymentOrder = (token) => post(at(token, "/payment/order"));
export const verifyPayment = (token, result) => post(at(token, "/payment/verify"), result);
export const confirmPayment = (token) => post(at(token, "/payment/confirm"));
export const reportPaymentFailure = (token, error) => post(at(token, "/payment/failed"), { error });
// method: "DRAW" (signature pad) or "UPLOAD" (image file); the server stores each in its own folder.
export function submitSignature(token, blob, method = "DRAW") {
  const fd = new FormData();
  fd.append("confirmed", "true");
  fd.append("method", method);
  fd.append("signature", blob, "signature.png");
  return call(at(token, "/signature"), { method: "POST", body: fd });
}
export function uploadLivePhoto(token, { blob, position, faceCount }) {
  const fd = new FormData();
  fd.append("latitude", position.latitude);
  fd.append("longitude", position.longitude);
  fd.append("accuracy", position.accuracy);
  fd.append("faceCount", faceCount);
  fd.append("photo", blob, "live-photo.jpg");
  return call(at(token, "/photo"), { method: "POST", body: fd });
}
