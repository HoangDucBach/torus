import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

export type QueryHookResult<TData> = UseQueryResult<TData, Error>;

export type MutationHookResult<TVariables, TData = unknown> = UseMutationResult<
  TData,
  Error,
  TVariables
>;
