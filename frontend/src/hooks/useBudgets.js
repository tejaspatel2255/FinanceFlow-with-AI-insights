import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook to manage budget limits using TanStack Query and Supabase.
 */
export function useBudgets() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Query to Fetch User Budgets
  const useGetBudgets = () => {
    return useQuery({
      queryKey: ["budgets", user?.id],
      queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase
          .from("budgets")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      },
      enabled: !!user,
    });
  };

  // 2. Mutation to Create or Update a Budget
  const useUpsertBudget = () => {
    return useMutation({
      mutationFn: async (budget) => {
        if (!user) throw new Error("User must be authenticated.");
        
        // Supabase upsert: matches unique index (user_id, category, period)
        const { data, error } = await supabase
          .from("budgets")
          .upsert({
            ...budget,
            user_id: user.id,
          }, {
            onConflict: "user_id,category,period"
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["budgets", user?.id] });
      },
    });
  };

  // 3. Mutation to Delete Budget
  const useDeleteBudget = () => {
    return useMutation({
      mutationFn: async (id) => {
        if (!user) throw new Error("User must be authenticated.");
        const { error } = await supabase
          .from("budgets")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;
        return id;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["budgets", user?.id] });
      },
    });
  };

  return {
    useGetBudgets,
    useUpsertBudget,
    useDeleteBudget,
  };
}
