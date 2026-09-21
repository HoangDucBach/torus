import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

/**
 * The one shape every *read* hook in this app returns — a plain re-export of TanStack Query's
 * own `UseQueryResult`. A component consumes `{ data, isPending, error, refetch }` identically
 * whether the hook reads on-chain state (via wagmi/viem) or Torus's own REST API.
 */
export type QueryHookResult<TData> = UseQueryResult<TData, Error>;

/**
 * The one shape every *write* hook in this app returns — a plain re-export of TanStack Query's
 * own `UseMutationResult`. A component consumes `{ mutate, mutateAsync, isPending, error }`
 * identically for every mutation (wallet connect, deposit, ...).
 */
export type MutationHookResult<TVariables, TData = unknown> = UseMutationResult<
  TData,
  Error,
  TVariables
>;
