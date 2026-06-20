import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook to manage transaction state using TanStack Query and Supabase client.
 */
export function useTransactions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Query to Fetch User Transactions
  const useGetTransactions = () => {
    return useQuery({
      queryKey: ["transactions", user?.id],
      queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });

        if (error) throw error;
        return data || [];
      },
      enabled: !!user,
    });
  };

  // 2. Mutation to Add Transaction
  const useCreateTransaction = () => {
    return useMutation({
      mutationFn: async (transaction) => {
        if (!user) throw new Error("User must be authenticated.");
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            ...transaction,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      },
    });
  };

  // 3. Mutation to Update Transaction
  const useUpdateTransaction = () => {
    return useMutation({
      mutationFn: async ({ id, ...updates }) => {
        if (!user) throw new Error("User must be authenticated.");
        const { data, error } = await supabase
          .from("transactions")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id) // Security check
          .select()
          .single();

        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      },
    });
  };

  // 4. Mutation to Delete Transaction
  const useDeleteTransaction = () => {
    return useMutation({
      mutationFn: async (id) => {
        if (!user) throw new Error("User must be authenticated.");
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id); // Security check

        if (error) throw error;
        return id;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      },
    });
  };

  return {
    useGetTransactions,
    useCreateTransaction,
    useUpdateTransaction,
    useDeleteTransaction,
  };
}
