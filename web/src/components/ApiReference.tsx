"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useNetwork } from "@/hooks";

export function ApiReference() {
  const { network } = useNetwork();

  return (
    <ApiReferenceReact
      configuration={{
        url: `${network.serverUrl}/openapi.json`,
        theme: "none",
        darkMode: true,
      }}
    />
  );
}
