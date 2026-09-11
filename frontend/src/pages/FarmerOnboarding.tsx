import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import {
  ApiError,
  listCanals,
  onboardFarmer,
  type CanalRead,
  type PriorityLevel,
} from "../lib/api";

const CROP_STAGES = [
  "Sowing",
  "Germination",
  "Vegetative",
  "Tillering",
  "Flowering",
  "Grain filling",
  "Maturity",
];

interface FarmerOnboardingFormProps {
  /** Called after the profile is saved, so the caller can re-check /farmers/me. */
  onComplete: () => void;
}

/**
 * One-time farmer intake: name, phone, canal, and their primary field
 * (area, crop, crop stage, priority). Village is auto-assigned server-side
 * (single-village prototype) — there is no village picker here.
 */
export function FarmerOnboardingForm({ onComplete }: FarmerOnboardingFormProps) {
  const { getToken } = useAuth();
  const { isLoaded: userLoaded, user } = useUser();
  // Name already known from the Gmail/Clerk account — reuse it instead of asking again.
  const clerkName = user?.fullName?.trim() || user?.firstName?.trim() || "";
  const showNameField = userLoaded && !clerkName;
  const [canals, setCanals] = useState<CanalRead[]>([]);
  const [canalsHint, setCanalsHint] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [canalId, setCanalId] = useState("");
  const [areaAcres, setAreaAcres] = useState("");
  const [crop, setCrop] = useState("");
  const [cropStage, setCropStage] = useState(CROP_STAGES[0]);
  const [priority, setPriority] = useState<PriorityLevel>("normal");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await listCanals(token);
        if (!cancelled) setCanals(data);
      } catch {
        if (!cancelled) {
          setCanalsHint(
            "Could not load the canal list — you can finish setup and it can be assigned later.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const area = Number(areaAcres);
    const effectiveName = (clerkName || name).trim();
    if (!effectiveName || !phone.trim() || !crop.trim() || !cropStage.trim()) {
      setError("Please fill in every field.");
      return;
    }
    if (!Number.isFinite(area) || area <= 0) {
      setError("Field area must be a number greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Could not verify your session. Please sign in again.");
      }
      await onboardFarmer(token, {
        name: effectiveName,
        phone: phone.trim(),
        canal_id: canalId ? Number(canalId) : null,
        field: {
          area_acres: area,
          crop: crop.trim(),
          crop_stage: cropStage,
          priority,
        },
      });
      onComplete();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not save your details. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <section className="onboarding-wrap">
        <Link className="brand" to="/">
          <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
          JalSetu
        </Link>

        <div className="onboarding-head">
          <p className="eyebrow">Farmer onboarding</p>
          <h1>Tell us about your farm</h1>
          <p className="muted">
            One-time setup — JalSetu uses this to calculate your fair water
            allocation and irrigation schedule.
          </p>
        </div>

        <form className="card onboarding-card" onSubmit={handleSubmit} noValidate>
          <p className="onboarding-section-title">Your details</p>
          {!showNameField && userLoaded && (
            <p className="field-hint" style={{ marginTop: 0 }}>
              Continuing as {clerkName} (from your Google account)
            </p>
          )}
          <div className="form-grid">
            {showNameField && (
              <div className="form-field">
                <label htmlFor="ob-name">Full name</label>
                <input
                  id="ob-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div
              className="form-field"
              style={showNameField ? undefined : { gridColumn: "1 / -1" }}
            >
              <label htmlFor="ob-phone">Phone number</label>
              <input
                id="ob-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 90000 00000"
                autoComplete="tel"
                required
              />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="ob-canal">Canal</label>
              <select
                id="ob-canal"
                value={canalId}
                onChange={(e) => setCanalId(e.target.value)}
              >
                <option value="">Not assigned yet</option>
                {canals.map((canal) => (
                  <option key={canal.id} value={canal.id}>
                    {canal.name}
                  </option>
                ))}
              </select>
              {canalsHint && <p className="field-hint">{canalsHint}</p>}
            </div>
          </div>

          <p className="onboarding-section-title">Your field</p>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="ob-area">Area (acres)</label>
              <input
                id="ob-area"
                type="number"
                min={0.1}
                step={0.1}
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
                placeholder="e.g. 2.5"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="ob-crop">Crop</label>
              <input
                id="ob-crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="e.g. Sugarcane"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="ob-crop-stage">Crop stage</label>
              <select
                id="ob-crop-stage"
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value)}
              >
                {CROP_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="ob-priority">Priority</label>
              <select
                id="ob-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              >
                <option value="normal">Normal</option>
                <option value="high">High — water-sensitive stage</option>
                <option value="critical">Critical — crop at risk</option>
              </select>
            </div>
          </div>

          {error && <p className="field-error">{error}</p>}

          <div className="form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Complete setup"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
