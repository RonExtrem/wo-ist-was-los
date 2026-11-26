"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { pushEinschalten } from "@/lib/client/push";

/** Nach dem ersten Herz: „Soll ich dich erinnern?“ – eigener Dialog, kein Browser-Popup. */
export function PushFrage() {
  const { pushFrage, schliessePushFrage, api } = useApp();
  const [laeuft, setLaeuft] = useState(false);
  const [blockiert, setBlockiert] = useState(false);

  const ja = async () => {
    setLaeuft(true);
    const s = await pushEinschalten(api).catch(() => "aus" as const);
    setLaeuft(false);
    if (s === "blockiert") setBlockiert(true);
    else schliessePushFrage();
  };

  return (
    <AnimatePresence>
      {pushFrage && (
        <motion.div
          key="push-frage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={schliessePushFrage}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-frage-titel"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-xl rounded-t-[2rem] bg-flaeche px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 shadow-karte"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-abendsonne-zart text-abendsonne">
              <BellRing className="h-7 w-7" />
            </span>
            <h2 id="push-frage-titel" className="font-titel mt-3 text-2xl">Soll ich dich erinnern?</h2>
            <p className="mt-2 text-gedaempft">
              Bei gemerkten Veranstaltungen bekommst du am Vortag um ca. 18 Uhr und am Tag selbst um ca. 8 Uhr eine kurze Nachricht – und
              sofort Bescheid, falls etwas abgesagt oder verschoben wird.
            </p>
            {blockiert && (
              <p className="mt-3 rounded-2xl bg-abendsonne-zart p-3 font-semibold text-abendsonne">
                Benachrichtigungen sind am Handy für diese App gesperrt. Du kannst sie in den Handy-Einstellungen unter „Apps“ wieder erlauben.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={ja}
                disabled={laeuft}
                className="flex min-h-14 items-center justify-center rounded-2xl bg-see text-lg font-bold text-white disabled:opacity-60"
              >
                {laeuft ? "Einen Moment …" : "Ja, erinnere mich"}
              </button>
              <button type="button" onClick={schliessePushFrage} className="min-h-12 rounded-2xl font-semibold text-gedaempft">
                Nein danke
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
