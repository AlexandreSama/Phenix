// src/app/page.tsx
import { Suspense } from "react";
import { api } from "@/lib/api";
import {METRICS} from "@phenix/shared";

async function ApiStatus() {
  const health = await api<{ status: string }>("/health").catch(() => ({ status: "injoignable" }));
  return <p className="mt-2">API : {health.status}</p>;
}

export default function Home() {
  return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Phenix</h1>
        {/* Cache Components : toute donnée lue à la requête doit être dans un Suspense */}
        <Suspense fallback={<p className="mt-2">API : …</p>}>
          <ApiStatus />
        </Suspense>
        <p className="mt-4 text-sm text-gray-500">
          Métriques suivies : {Object.values(METRICS).join(", ")}
        </p>
      </main>
  );
}