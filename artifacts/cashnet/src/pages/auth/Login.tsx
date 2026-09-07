import { useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, ScanFace, ArrowRight, Shield } from "lucide-react";

export const accounts = [
  {
    id: "374ed1e4-481b-4074-a26e-6137657c6e35",
    username: "Subrat Kumar Das",
    fullName: "Subrata Kumar Das",
    picture: "374ed1e4-481b-4074-a26e-6137657c6e35/3.jpg",
  },
  {
    id: "43332f46-89a4-435c-880e-4d72bb51149a",
    fullName: "Ramesh Jena",
    picture: "43332f46-89a4-435c-880e-4d72bb51149a/2.jpg",
  },
  {
    id: "0c2f5599-9296-4f94-97d5-e773043188ae",
    fullName: "Smita Patil",
    picture: "0c2f5599-9296-4f94-97d5-e773043188ae/2.jpg",
  },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleStandardLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (username === "admin" && password === "admin") {
       localStorage.setItem("cashnet_auth", JSON.stringify({ authenticated: true, method: "password", user: "Admin" }));
       setLocation("/dashboard");
    } else {
       setErrorMessage("Invalid credentials. Try admin/admin or use facial authentication.");
    }
  };

  const handleFaceAuth = (event: React.MouseEvent) => {
    event.preventDefault();
    const account = accounts.find(
      (candidate) =>
        (candidate.username ?? candidate.fullName).toLowerCase() === username.trim().toLowerCase()
    );

    if (!account) {
      setErrorMessage("Username not found for face auth. Try 'Subrata Kumar Das'.");
      return;
    }

    setErrorMessage("");
    // We pass state via sessionStorage because wouter doesn't have route state out of the box in the same way react-router does
    sessionStorage.setItem("face_auth_candidate", JSON.stringify(account));
    setLocation("/face-auth");
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-sm overflow-hidden">
        <div className="bg-slate-800 p-6 flex flex-col items-center border-b-4 border-amber-400 text-slate-100">
           <Shield size={36} className="text-amber-400 mb-3" />
           <div className="text-2xl font-extrabold tracking-[.14em]">CASHNET</div>
           <div className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-400 mt-1">Authorized Access Only</div>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleStandardLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Investigator ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. Subrata Kumar Das"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-2.5 rounded-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Access Token / Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter token"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-2.5 rounded-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {errorMessage && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-sm font-medium">
                {errorMessage}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-amber-400 px-4 py-3 text-xs font-extrabold hover:bg-slate-700 transition-colors rounded-sm shadow-sm"
              >
                <LockKeyhole size={16} /> Standard Login
              </button>
              
              <div className="relative flex items-center py-2">
                 <div className="flex-grow border-t border-slate-200"></div>
                 <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-bold uppercase">or</span>
                 <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleFaceAuth}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 text-white px-4 py-3 text-xs font-extrabold hover:bg-cyan-700 transition-colors rounded-sm shadow-sm"
              >
                <ScanFace size={16} /> Login with Face
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
