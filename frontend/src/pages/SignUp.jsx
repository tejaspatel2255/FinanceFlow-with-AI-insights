import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, Lock, Mail, User } from "lucide-react";

// Form validation schema with Zod
const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data) => {
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.name);
      setSuccessMsg("Account created! Please check your email to confirm registration before logging in.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl border border-slate-100">
        
        {/* Branding header */}
        <div className="flex flex-col items-center">
          <img
            src="/logo.png"
            alt="FinanceFlow Logo"
            className="h-16 w-16 rounded-2xl object-cover shadow-lg border border-slate-100"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Create Account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Start tracking and saving today
          </p>
        </div>

        {/* Global Error/Success messages */}
        {errorMsg && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-100">
            {successMsg}
            <div className="mt-3">
              <Link to="/login" className="font-bold text-emerald-800 hover:underline">
                Go to login page
              </Link>
            </div>
          </div>
        )}

        {!successMsg && (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Name field */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  {...register("name")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    errors.name
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>
              )}
            </div>

            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register("email")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    errors.email
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  {...register("password")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    errors.password
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="•••••••• (Min 6 characters)"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">
                Confirm Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  {...register("confirmPassword")}
                  className={`block w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 ${
                    errors.confirmPassword
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                      : "border-slate-200 focus:border-primary focus:ring-primary/20"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-rose-500">{errors.confirmPassword.message}</p>
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
                  "Create Account"
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
