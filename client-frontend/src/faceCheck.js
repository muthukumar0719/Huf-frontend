// Live photo face check with face-api's Tiny Face Detector. The model is served from this app:
//   public/models/tiny_face_detector_model-weights_manifest.json
//   public/models/tiny_face_detector_model-shard1.txt
// It detects human faces only, so a photo of an object, a pet or an empty frame finds no face.
// The library (with TensorFlow.js) is loaded on demand so it does not slow the first page load.
const MODEL_URL = "/models";
const INPUT_SIZE = 416; // multiple of 32; larger finds smaller faces, at some speed cost
const MIN_SCORE = 0.5; // detections below this confidence are ignored
const MIN_FACE_SHARE = 0.08; // the face must be at least 8% of the photo's width (not a tiny face far away)

let ready = null;
async function getFaceApi() {
  ready ??= (async () => {
    const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
    await faceapi.tf.ready();
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    return faceapi;
  })();
  try {
    return await ready;
  } catch (e) {
    console.error("[FaceCheck] Tiny Face Detector could not load", e);
    ready = null;
    throw new Error("The face check could not start. Check your connection and try again.");
  }
}

// Start loading the model before the photo is taken.
export const preloadFaceCheck = () => getFaceApi().catch(() => {});

// Number of clear human faces in the captured photo (canvas).
export async function countFaces(canvas) {
  const faceapi = await getFaceApi();
  const detections = await faceapi.detectAllFaces(
    canvas,
    new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE, scoreThreshold: MIN_SCORE }),
  );
  return detections.filter((d) => d.box.width >= canvas.width * MIN_FACE_SHARE).length;
}

export function faceProblem(count) {
  if (count === 1) return "";
  if (count === 0)
    return "No human face was detected. Face the camera in good light and come closer. Photos of objects, or without a person, are not accepted.";
  return `${count} faces were detected. Only you should be in the photo.`;
}
