"use client";

import { useSearchParams } from "next/navigation";

export function GeteilterInhalt() {
  const params = useSearchParams();
  const title = params.get("title");
  const text = params.get("text");
  const url = params.get("url");

  if (!title && !text && !url) {
    return <p className="mt-4 text-gedaempft">Es wurde nichts geteilt.</p>;
  }

  return (
    <div className="mt-6 space-y-3 rounded-3xl bg-flaeche p-6 ring-1 ring-black/5">
      {title && <p className="text-lg font-semibold">{title}</p>}
      {text && <p className="whitespace-pre-wrap">{text}</p>}
      {url && <p className="break-all text-see">{url}</p>}
    </div>
  );
}
