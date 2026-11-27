import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Loader2 } from "lucide-react";
import { api, ApiError, type Organisation } from "../api";
import { useSession } from "../session";
import { ORG_TYPES } from "@shared/oeuvre";
import { Field, ErrorNote, inputClass, primaryButton } from "../components/ui";
import { Logo } from "../components/shell";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    organisationName: "",
    organisationType: "individual",
    city: "",
    address: "",
    pincode: "",
    phone: user.phone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => api.post<{ organisation: Organisation }>("/organisation", form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/auth/me"] });
      navigate("/dashboard");
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not create your profile. Please try again.");
      }
    },
  });

  return (
    <div className="min-h-screen bg-[#F7F7F2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <span className="inline-flex rounded-xl bg-forest p-2">
          <Logo />
        </span>

        <div className="mt-8 surface p-6 sm:p-8">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime/50 text-forest">
            <Building2 className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-[26px] font-bold text-forest">
            Finish setting up your account
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            Your account ({user.email}) is not linked to a profile yet. Add these details
            once to start listing equipment and planning events — as an individual or an
            organisation.
          </p>

          {error ? (
            <div className="mt-5">
              <ErrorNote message={error} />
            </div>
          ) : null}

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setFieldErrors({});
              if (!form.organisationName || !form.city || !form.address || !form.phone) {
                setError("Display name, city, address and phone are required.");
                return;
              }
              mutation.mutate();
            }}
          >
            <Field
              label="Display name"
              htmlFor="orgName"
              required
              error={fieldErrors.organisationName}
              hint="Your own name, household name or organisation name."
            >
              <input
                id="orgName"
                className={inputClass}
                value={form.organisationName}
                onChange={(event) => setForm({ ...form, organisationName: event.target.value })}
                placeholder="Riverside Housing Society"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Profile type" htmlFor="orgType" required error={fieldErrors.organisationType}>
                <select
                  id="orgType"
                  className={inputClass}
                  value={form.organisationType}
                  onChange={(event) => setForm({ ...form, organisationType: event.target.value })}
                >
                  {ORG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phone" htmlFor="orgPhone" required error={fieldErrors.phone}>
                <input
                  id="orgPhone"
                  className={inputClass}
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="98765 43210"
                />
              </Field>
            </div>
            <Field label="Registered address" htmlFor="orgAddress" required error={fieldErrors.address}>
              <input
                id="orgAddress"
                className={inputClass}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="14, River Road"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="orgCity" required error={fieldErrors.city}>
                <input
                  id="orgCity"
                  className={inputClass}
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  placeholder="Pune"
                />
              </Field>
              <Field label="PIN code" htmlFor="orgPincode" error={fieldErrors.pincode}>
                <input
                  id="orgPincode"
                  className={inputClass}
                  value={form.pincode}
                  onChange={(event) => setForm({ ...form, pincode: event.target.value })}
                  placeholder="411014"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-70",
                primaryButton,
              )}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mutation.isPending ? "Saving…" : "Continue to dashboard"}
              {!mutation.isPending ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
