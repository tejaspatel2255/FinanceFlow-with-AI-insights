import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, Lock, Mail } from "lucide-react";

// Form validation schema with Zod
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect target after success
  const from = location.state?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data) => {
    setErrorMsg("");
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-12 sm:px-6 lg:px-8 font-body">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-card p-8 shadow-xl border border-border text-card-foreground">
        
        {/* Branding header */}
        <div className="flex flex-col items-center">
          <img
            src="/logo.png"
            alt="FinanceFlow Logo"
            className="h-16 w-16 rounded-2xl object-cover shadow-lg border border-border"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-foreground font-display">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Log in to manage your money with FinanceFlow
          </p>
        </div>

        {/* Global Error message */}
        {errorMsg && (
          <div className="flex items-center space-x-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-foreground font-display">
                Email Address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                  className={`block w-full rounded-lg border bg-background text-foreground py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 ${
                    errors.email
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold text-foreground font-display">
                  Password
                </label>
                <Link
                  to="/reset-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register("password")}
                  className={`block w-full rounded-lg border bg-background text-foreground py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 ${
                    errors.password
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          New to FinanceFlow?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
