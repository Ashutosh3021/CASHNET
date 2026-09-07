import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { useLocation } from "wouter";
import { ScanFace, AlertTriangle, CheckCircle2, User as UserIcon } from "lucide-react";

export default function FaceAuth() {
  const [, setLocation] = useLocation();
  const [tempAccount, setTempAccount] = useState<any>(null);
  
  const [localUserStream, setLocalUserStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [loginResult, setLoginResult] = useState("PENDING");
  const [imageError, setImageError] = useState(false);
  const [counter, setCounter] = useState(0);
  const [labeledFaceDescriptors, setLabeledFaceDescriptors] = useState<faceapi.LabeledFaceDescriptors[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceApiIntervalRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blinkClosedRef = useRef(false);
  const scanningRef = useRef(false);
  const videoWidth = 640;
  const videoHeight = 360;

  useEffect(() => {
    const candidateStr = sessionStorage.getItem("face_auth_candidate");
    if (candidateStr) {
      setTempAccount(JSON.parse(candidateStr));
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  useEffect(() => {
    if (!tempAccount) return;

    let cancelled = false;
    const load = async () => {
      const uri = "/models";
      await faceapi.nets.ssdMobilenetv1.loadFromUri(uri);
      await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
      await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
      const descriptor = await loadLabeledImage(tempAccount);
      if (!cancelled) {
        setLabeledFaceDescriptors(descriptor ? [descriptor] : []);
        setModelsLoaded(true);
      }
    };

    load().catch((error) => {
      console.error("Unable to load face authentication models:", error);
      if (!cancelled) {
        setImageError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tempAccount]);

  useEffect(() => {
    if (loginResult === "SUCCESS" && counter >= 2 && localUserStream) {
      cleanupCamera();
      localStorage.setItem(
        "cashnet_auth",
        JSON.stringify({ authenticated: true, method: "face", user: tempAccount?.fullName })
      );
      sessionStorage.removeItem("face_auth_candidate");
      setLocation("/dashboard");
    }
  }, [loginResult, counter, localUserStream, setLocation, tempAccount]);

  useEffect(() => cleanupCamera, []);

  const getLocalUserVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setLocalUserStream(stream);
      setLoginResult("PENDING");
      setFaceApiLoaded(false);
    } catch (error) {
      console.error("Unable to access camera:", error);
      setImageError(true);
    }
  };

  const scanFace = async () => {
    if (scanningRef.current || labeledFaceDescriptors.length === 0) {
      return;
    }
    scanningRef.current = true;
    
    if (videoRef.current && canvasRef.current) {
      faceapi.matchDimensions(canvasRef.current, videoRef.current);
    }

    const faceApiInterval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptors();
          
        const resizedDetections = faceapi.resizeResults(detections, {
          width: videoWidth,
          height: videoHeight,
        });
        
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
        const result = resizedDetections.length
          ? faceMatcher.findBestMatch(resizedDetections[0].descriptor)
          : null;
          
        const isMatch = result?.label === tempAccount?.id;
        
        if (isMatch) {
            setLoginResult("SUCCESS");
        } else if (resizedDetections.length) {
            setLoginResult("FAILED");
        }

        const isLive = await detectBlink(resizedDetections);
        if (isMatch && isLive && !blinkClosedRef.current) {
          setCounter((prev) => prev + 1);
        }
        blinkClosedRef.current = isLive;

        canvasRef.current.getContext("2d")?.clearRect(0, 0, videoWidth, videoHeight);
        faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
        setFaceApiLoaded(true);
      } catch (error) {
        console.error("Face scan failed:", error);
      }
    }, 1000 / 15);
    
    faceApiIntervalRef.current = faceApiInterval;
  };

  function cleanupCamera() {
    if (faceApiIntervalRef.current) clearInterval(faceApiIntervalRef.current);
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  async function loadLabeledImage(account: any) {
    const descriptions = [];

    try {
      const imgPath = account.type === "CUSTOM"
          ? account.picture
          : `/temp-accounts/${account.picture}`;
      
      const img = await faceapi.fetchImage(imgPath);
      const detections = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
        
      if (detections) {
        descriptions.push(detections.descriptor);
      }
    } catch (error) {
      console.error("Unable to load profile image:", error);
      setImageError(true);
    }

    return descriptions.length
      ? new faceapi.LabeledFaceDescriptors(account.id, descriptions)
      : null;
  }

  if (imageError) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Verification Error</h2>
        <p className="text-sm text-slate-600 mb-6 max-w-md">
          Unable to access camera or load reference profile data. Please ensure camera permissions are granted.
        </p>
        <button onClick={() => { setImageError(false); getLocalUserVideo(); }} className="bg-slate-800 text-amber-400 px-6 py-2.5 text-xs font-extrabold rounded-sm">
          Retry Access
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-4 pt-12">
      <div className="max-w-xl w-full bg-white border border-slate-200 p-8 rounded-sm shadow-xl text-center">
        <div className="flex justify-center mb-6">
            <div className="relative flex size-14 shrink-0 items-center justify-center border border-amber-300/50 bg-amber-400 text-slate-900 rounded-sm">
                <ScanFace size={28} strokeWidth={2.5} />
            </div>
        </div>

        {!localUserStream && !modelsLoaded && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Initializing Identity Engine</h2>
            <p className="mt-2 text-sm text-cyan-700 font-mono">LOADING MODELS...</p>
          </div>
        )}

        {!localUserStream && modelsLoaded && (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Identity Verification Required</h2>
            <p className="mt-2 text-sm text-slate-500">Compare live telemetry with registered biometric anchor.</p>
          </div>
        )}

        {localUserStream && loginResult === "SUCCESS" && (
          <div className="mb-4">
            <h2 className="flex items-center justify-center gap-2 text-xl font-extrabold text-emerald-700">
               <CheckCircle2 size={24} /> Anchor Matched
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-700">User: {tempAccount?.fullName}</p>
            <div className="mt-3 inline-flex px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold rounded-sm">
               LIVENESS CHECK: Blink {2 - counter} more times
            </div>
          </div>
        )}

        {localUserStream && loginResult === "FAILED" && (
          <div className="mb-4">
            <h2 className="flex items-center justify-center gap-2 text-xl font-extrabold text-red-700">
               <AlertTriangle size={24} /> Recognition Failed
            </h2>
          </div>
        )}

        {localUserStream && !faceApiLoaded && loginResult === "PENDING" && (
          <div className="mb-4">
            <h2 className="text-xl font-extrabold text-slate-800">Scanning Telemetry...</h2>
          </div>
        )}

        <div className="w-full mt-6 flex flex-col items-center">
          <div className="relative w-full max-w-[640px] aspect-video bg-slate-900 rounded-sm overflow-hidden border-2 border-slate-200 shadow-inner">
            {!localUserStream ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                  <UserIcon size={64} className="opacity-20 mb-4" />
                  <span className="text-xs font-mono">CAMERA INACTIVE</span>
               </div>
            ) : null}
            <video
              muted
              autoPlay
              ref={videoRef}
              onPlay={scanFace}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: localUserStream ? "block" : "none" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: localUserStream ? "block" : "none" }}
            />
          </div>

          {!localUserStream && (
            <div className="mt-8 w-full max-w-xs mx-auto">
              {modelsLoaded ? (
                <button
                  onClick={getLocalUserVideo}
                  className="w-full flex justify-center items-center gap-2 py-3 px-5 text-sm font-extrabold text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-sm shadow-md transition-colors"
                >
                  <ScanFace size={18} /> Initialize Scanner
                </button>
              ) : (
                <button
                  disabled
                  className="w-full flex justify-center items-center py-3 px-5 text-sm font-bold text-slate-500 bg-slate-100 rounded-sm cursor-not-allowed border border-slate-200"
                >
                  <span className="animate-spin mr-2 h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></span>
                  Loading Network...
                </button>
              )}
            </div>
          )}
          
          {localUserStream && loginResult === "FAILED" && (
             <div className="mt-6">
                <button onClick={() => setLoginResult("PENDING")} className="bg-slate-800 text-white px-6 py-2 text-xs font-bold rounded-sm hover:bg-slate-700">
                    Retry Scan
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function detectBlink(detections: any) {
  for (const detection of detections) {
    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!leftEye || !rightEye) {
      continue;
    }

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const ear = (leftEAR + rightEAR) / 2;

    const BLINK_THRESHOLD = 0.18;
    if (ear < BLINK_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function calculateEAR(eye: any) {
  const A = Math.sqrt(
    Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2)
  );
  const B = Math.sqrt(
    Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2)
  );
  const C = Math.sqrt(
    Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2)
  );
  return (A + B) / (2.0 * C);
}
