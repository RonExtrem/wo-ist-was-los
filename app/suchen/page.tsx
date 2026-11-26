import { Suspense } from "react";
import { SuchSeite } from "./SuchSeite";

export default function Suchen() {
  return (
    <Suspense fallback={<div className="p-8 text-gedaempft">Wird geladen …</div>}>
      <SuchSeite />
    </Suspense>
  );
}
