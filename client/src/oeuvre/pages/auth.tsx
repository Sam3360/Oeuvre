import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { api, ApiError, type MeResponse } from "../api";
import { Logo } from "../components/shell";
import { Field, ErrorNote, inputClass, primaryButton } from "../components/ui";
import { ORG_TYPES } from "@shared/oeuvre";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const EMPTY_REGISTER = {
  organisationName: "",
  organisationType: "individual",
  contactName: "",
  email: "",
  phone: "",
  password: "",
  city: "",
  address: "",
  pincode: "",
};

export default function AuthPage() {
  const search = useSearch();
  const initialMode: Mode = new URLSearchParams(search).get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [register, setRegister] = useState(EMPTY_REGISTER);
  const [accountKind, setAccountKind] = useState<"individual" | "organisation">("individual");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const finish = (data: MeResponse) => {
    queryClient.setQueryData(["/api/oeuvre/auth/me"], data);
    navigate(data.organisation ? "/dashboard" : "/onboarding");
  };

  const onApiError = (err: unknown) => {
    if (err instanceof ApiError) {
      setError(err.message);
      setFieldErrors(err.fieldErrors);
    } else {
      setError("Something went wrong. Please try again.");
    }
  };

  const loginMutation = useMutation({
    mutationFn: () => api.post<MeResponse>("/auth/login", login),
    onSuccess: finish,
    onError: onApiError,
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.post<MeResponse>("/auth/register", {
        ...register,
        organisationName:
          accountKind === "organisation"
            ? register.organisationName
            : register.contactName,
        organisationType:
          accountKind === "organisation" ? register.organisationType : "individual",
        pincode: register.pincode || null,
        latitude: null,
        longitude: null,
      }),
    onSuccess: finish,
    onError: onApiError,
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  return (
    <div className="grid min-h-screen bg-[#F7F7F2] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-forest p-10 lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 15%, #D5F2B4 0, transparent 40%), radial-gradient(circle at 80% 75%, #6A927B 0, transparent 45%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-2">
          <Logo />
        </Link>

        <div className="relative mt-auto max-w-md pb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">
            Equipment sharing for communities
          </p>
          <h1 className="mt-4 font-display text-[34px] font-extrabold leading-[1.12] text-cream">
            The chairs exist. The projector exists. Now the whole street knows.
          </h1>
          <p className="mt-5 text-[14px] leading-relaxed text-cream/60">
            One workspace for your inventory, your events, matching, approvals and
            returns — shared across every organisation that wants to lend a hand.
          </p>

          <div className="mt-8 space-y-3">
            {[
              "See available stock before you commit",
              "Approve requests with a clear pickup date",
              "Track returns and build a verified impact record",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5 text-[13px] text-cream/75">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-lime" />
                {line}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-cream/35">
          Oeuvre · Community resource sharing
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="rounded-lg bg-forest p-1.5">
              <Logo />
            </span>
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-forest/70 transition-colors hover:text-forest"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-start justify-center px-5 pb-14 sm:px-8 lg:px-10">
          <div className={cn("w-full", mode === "register" ? "max-w-xl" : "max-w-md")}>
            <div className="inline-flex rounded-xl border border-border bg-white p-1">
              {(["login", "register"] as Mode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => switchMode(option)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                    mode === option
                      ? "bg-forest text-cream"
                      : "text-forest/65 hover:bg-forest/[0.05]",
                  )}
                >
                  {option === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <h2 className="mt-6 font-display text-[28px] font-bold leading-tight text-forest">
              {mode === "login"
                ? "Welcome back"
                : accountKind === "individual"
                  ? "Create your account"
                  : "Set up your organisation"}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {mode === "login"
                ? "Sign in to manage your listings, events and bookings."
                : accountKind === "individual"
                  ? "For everyday people: share what you already own with people nearby, and borrow what you need instead of buying it."
                  : "One account gives your whole organisation access to shared equipment."}
            </p>

            {error ? (
              <div className="mt-5">
                <ErrorNote message={error} />
              </div>
            ) : null}

            {mode === "login" ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  setFieldErrors({});
                  if (!login.email || !login.password) {
                    setError("Enter your email and password to continue.");
                    return;
                  }
                  loginMutation.mutate();
                }}
              >
                <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    value={login.email}
                    onChange={(event) => setLogin({ ...login, email: event.target.value })}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password" htmlFor="password" required error={fieldErrors.password}>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className={cn(inputClass, "pr-10")}
                      value={login.password}
                      onChange={(event) => setLogin({ ...login, password: event.target.value })}
                      placeholder="Your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-forest"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-70",
                    primaryButton,
                  )}
                >
                  {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </button>
                <p className="text-center text-[12.5px] text-muted-foreground">
                  New to Oeuvre?{" "}
                  <button
                    type="button"
                    className="font-semibold text-forest underline-offset-4 hover:underline"
                    onClick={() => switchMode("register")}
                  >
                    Create an account
                  </button>
                </p>
              </form>
            ) : (
              <form
                className="mt-6 space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  setFieldErrors({});
                  const missing =
                    (accountKind === "organisation" && !register.organisationName) ||
                    !register.contactName ||
                    !register.email ||
                    !register.phone ||
                    !register.city ||
                    !register.address ||
                    register.password.length < 8;
                  if (missing) {
                    setError("Complete every required field. Passwords need at least 8 characters.");
                    return;
                  }
                  registerMutation.mutate();
                }}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
                    Who is joining?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      { value: "individual", label: "Just me / household" },
                      { value: "organisation", label: "An organisation" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setAccountKind(option.value as "individual" | "organisation")
                        }
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
                          accountKind === option.value
                            ? "border-forest bg-forest text-cream"
                            : "border-border bg-white text-forest/70 hover:bg-cream",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {accountKind === "organisation" ? (
                      <>
                        <Field
                          label="Organisation name"
                          htmlFor="organisationName"
                          required
                          error={fieldErrors.organisationName}
                          className="sm:col-span-2"
                        >
                          <input
                            id="organisationName"
                            className={inputClass}
                            value={register.organisationName}
                            onChange={(event) =>
                              setRegister({ ...register, organisationName: event.target.value })
                            }
                            placeholder="Greenfield Public School"
                          />
                        </Field>
                        <Field label="Organisation type" htmlFor="organisationType" required error={fieldErrors.organisationType}>
                          <select
                            id="organisationType"
                            className={inputClass}
                            value={register.organisationType}
                            onChange={(event) =>
                              setRegister({ ...register, organisationType: event.target.value })
                            }
                          >
                            {ORG_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </>
                    ) : (
                      <p className="rounded-lg bg-lime/25 px-3 py-2.5 text-[12px] leading-relaxed text-forest/80 sm:col-span-2">
                        No organisation needed. Your account is listed under your own name,
                        and your address is only used to estimate distance.
                      </p>
                    )}
                    <Field label="City" htmlFor="city" required error={fieldErrors.city}>
                      <input
                        id="city"
                        className={inputClass}
                        value={register.city}
                        onChange={(event) => setRegister({ ...register, city: event.target.value })}
                        placeholder="Pune"
                      />
                    </Field>
                    <Field
                      label="Registered address"
                      htmlFor="address"
                      required
                      error={fieldErrors.address}
                      className="sm:col-span-2"
                      hint="Used as the pickup location and to estimate distance."
                    >
                      <input
                        id="address"
                        className={inputClass}
                        value={register.address}
                        onChange={(event) => setRegister({ ...register, address: event.target.value })}
                        placeholder="12, University Road"
                      />
                    </Field>
                    <Field label="PIN code" htmlFor="pincode" error={fieldErrors.pincode}>
                      <input
                        id="pincode"
                        className={inputClass}
                        value={register.pincode}
                        onChange={(event) => setRegister({ ...register, pincode: event.target.value })}
                        placeholder="411007"
                      />
                    </Field>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
                    Your account
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" htmlFor="contactName" required error={fieldErrors.contactName}>
                      <input
                        id="contactName"
                        className={inputClass}
                        value={register.contactName}
                        onChange={(event) => setRegister({ ...register, contactName: event.target.value })}
                        placeholder="Ananya Rao"
                      />
                    </Field>
                    <Field label="Phone" htmlFor="phone" required error={fieldErrors.phone}>
                      <input
                        id="phone"
                        type="tel"
                        className={inputClass}
                        value={register.phone}
                        onChange={(event) => setRegister({ ...register, phone: event.target.value })}
                        placeholder="98765 43210"
                      />
                    </Field>
                    <Field label="Email" htmlFor="registerEmail" required error={fieldErrors.email}>
                      <input
                        id="registerEmail"
                        type="email"
                        autoComplete="email"
                        className={inputClass}
                        value={register.email}
                        onChange={(event) => setRegister({ ...register, email: event.target.value })}
                        placeholder="you@example.com"
                      />
                    </Field>
                    <Field
                      label="Password"
                      htmlFor="registerPassword"
                      required
                      error={fieldErrors.password}
                      hint="At least 8 characters."
                    >
                      <div className="relative">
                        <input
                          id="registerPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          className={cn(inputClass, "pr-10")}
                          value={register.password}
                          onChange={(event) => setRegister({ ...register, password: event.target.value })}
                          placeholder="Create a password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-forest"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-70",
                    primaryButton,
                  )}
                >
                  {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {registerMutation.isPending
                    ? "Creating your account…"
                    : accountKind === "individual"
                      ? "Create my account"
                      : "Create organisation account"}
                  {!registerMutation.isPending ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
                <p className="text-center text-[12.5px] text-muted-foreground">
                  Already registered?{" "}
                  <button
                    type="button"
                    className="font-semibold text-forest underline-offset-4 hover:underline"
                    onClick={() => switchMode("login")}
                  >
                    Sign in instead
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
