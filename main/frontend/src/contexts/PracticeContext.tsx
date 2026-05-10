import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface PracticeProfile {
  company: string;
  position: string;
  resume_file_path: string;
}

interface PracticeContextType {
  profile: PracticeProfile;
  loaded: boolean;
  loadProfile: () => Promise<void>;
  updateProfile: (patch: Partial<PracticeProfile>) => Promise<void>;
}

const PracticeContext = createContext<PracticeContextType | null>(null);
const EMPTY: PracticeProfile = { company: "", position: "", resume_file_path: "" };

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PracticeProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoaded(true);
        return;
      }
      const resp = await fetch("/practice/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setProfile({
          company: data.company || "",
          position: data.position || "",
          resume_file_path: data.resume_file_path || "",
        });
      }
    } catch (e) {
      console.error("Failed to load practice profile:", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<PracticeProfile>) => {
      const merged = { ...profile, ...patch };
      setProfile(merged);
      try {
        const token = localStorage.getItem("token");
        await fetch("/practice/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(merged),
        });
      } catch (e) {
        console.error("Persist practice profile failed:", e);
      }
    },
    [profile]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <PracticeContext.Provider value={{ profile, loaded, loadProfile, updateProfile }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}
