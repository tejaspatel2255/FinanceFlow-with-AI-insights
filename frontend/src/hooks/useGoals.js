import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export function useGoals() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Helper to fetch session token
  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  // 1. Fetch Goals
  const useGetGoals = () => {
    return useQuery({
      queryKey: ["goals", user?.id],
      queryFn: async () => {
        if (!user) return [];
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/goals`, { headers });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch goals");
        }
        return response.json();
      },
      enabled: !!user,
    });
  };

  // 2. Create Goal
  const useCreateGoal = () => {
    return useMutation({
      mutationFn: async (goalData) => {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/goals`, {
          method: "POST",
          headers,
          body: JSON.stringify(goalData),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create goal");
        }
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      },
    });
  };

  // 3. Update Goal (Add funds or Edit fields)
  const useUpdateGoal = () => {
    return useMutation({
      mutationFn: async ({ id, ...updates }) => {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update goal");
        }
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      },
    });
  };

  // 4. Delete Goal
  const useDeleteGoal = () => {
    return useMutation({
      mutationFn: async (id) => {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to delete goal");
        }
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      },
    });
  };

  // 5. Fetch AI Forecast for a specific Goal
  const useGetGoalForecast = (goalId, enabled = true) => {
    return useQuery({
      queryKey: ["goal_forecast", goalId],
      queryFn: async () => {
        const headers = await getAuthHeader();
        const response = await fetch(`${API_BASE_URL}/goals/${goalId}/forecast`, { headers });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch goal forecast");
        }
        const data = await response.json();
        return data.forecast;
      },
      enabled: !!user && !!goalId && enabled,
      staleTime: 1000 * 60 * 30, // 30 minutes cache for AI forecasts
      retry: false,
    });
  };

  return {
    useGetGoals,
    useCreateGoal,
    useUpdateGoal,
    useDeleteGoal,
    useGetGoalForecast,
  };
}
