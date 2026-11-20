// VITE_API_URL wins when set at build time; otherwise a production build uses the live API Gateway
// and `npm run dev` uses the local server.
const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://68oiix3z2e.execute-api.ap-south-1.amazonaws.com/api' : 'http://localhost:5000/api');

async function call(path, options){
  let res;
  try { res = await fetch(`${API}${path}`, options); }
  catch (e) { throw new Error(`Could not reach the server at ${API} (${e.message}).`); }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || `Request failed with status ${res.status}.`);
  return data;
}

// Saves one completed RM section. The first save (Contact & PAN) creates the application and
// returns its application_id; every later save sends that id so the same record is updated.
// `files` is a list of [fieldName, File]; co-parcener signatures use "signature:<id>".
export function saveHufStage(stage, application, files, applicationId){
  const fd = new FormData();
  fd.append('stage', stage);
  if (applicationId) fd.append('application_id', applicationId);
  fd.append('application', JSON.stringify(application));
  for (const [field, file] of files) fd.append(field, file);
  return call('/huf/applications/stage', {method:'POST', body:fd});
}
export function getHufPanName(pan, signal){
  return call('/huf/applications/pan/verify-huf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pan, consent: 'Y' }),
    signal,
  });
}

// Bank name, branch, address and MICR for an IFSC (bank_master in the master database).
export function getBankByIfsc(ifsc){
  return call(`/huf/applications/bank/ifsc/${encodeURIComponent(ifsc)}`);
}
// All sections saved: email the client link.
export function submitHufApplication(id){
  return call(`/huf/applications/${encodeURIComponent(id)}/submit`, {method:'POST'});
}
export function resendClientLink(id){
  return call(`/huf/applications/${encodeURIComponent(id)}/resend-link`, {method:'POST'});
}
