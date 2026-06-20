import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { AlertCircle, CheckCircle2, Lock, Mail } from "lucide-react";

// Form schemas
const requestSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

const updateSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Detect if we are on the password recovery redirect callback
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsUpdateMode(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsUpdateMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const requestForm = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const updateForm = useForm({
    resolver: zodResolver(updateSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Request reset email handler
  const onRequestSubmit = async (data) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await resetPassword(data.email);
      setSuccessMsg("Reset link sent! Please check your email inbox.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to send reset link. Verify your email.");
    } finally {
      setLoading(false);
    }
  };

  // Update password handler
  const onUpdateSubmit = async (data) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });
      if (error) throw error;
      setSuccessMsg("Password updated successfully! Redirecting you to login...");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-100">
        
        {/* Header */}
        <div className="flex flex-col items-center">
          <img
            src="/logo.png"
            alt="FinanceFlow Logo"
            className="h-16 w-16 rounded-2xl object-cover shadow-lg border border-slate-100"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            {isUpdateMode ? "Set New Password" : "Reset Password"}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            {isUpdateMode
              ? "Choose a strong password for your account"
              : "Enter your email to receive a recovery link"}
          </p>
        </div>

        {/* Global Messages */}
        {errorMsg && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start space-x-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Forms */}
        {isUpdateMode ? (
          // UPDATE PASSWORD FORM (Recovery link landed)
          <form className="mt-8 space-y-4" onSubmit={updateForm.handleSubmit(onUpdateSubmit)}>
            <div>
              <label className="block text-sm font-semibold text-slate-700">New Password</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  {...updateForm.register("password")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    updateForm.formState.errors.password
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="•••••••• (Min 6 characters)"
                />
              </div>
              {updateForm.formState.errors.password && (
                <p className="mt-1 text-xs text-rose-500">
                  {updateForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Confirm Password</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  {...updateForm.register("confirmPassword")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    updateForm.formState.errors.confirmPassword
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {updateForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-rose-500">
                  {updateForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-bold text-white transition-all hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        ) : (
          // REQUEST RESET EMAIL FORM
          <form className="mt-8 space-y-4" onSubmit={requestForm.handleSubmit(onRequestSubmit)}>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  {...requestForm.register("email")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    requestForm.formState.errors.email
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {requestForm.formState.errors.email && (
                <p className="mt-1 text-xs text-rose-500">
                  {requestForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-bold text-white transition-all hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-500">
          Back to{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
