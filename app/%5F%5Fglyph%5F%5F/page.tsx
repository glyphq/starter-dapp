"use client";

import { handleRedirect } from "@glyph-oss/connect";
import { useEffect } from "react";

export default function GlyphCallbackPage() {
  useEffect(() => {
    handleRedirect();
  }, []);

  return (
    <main className="callback-page">
      <div className="spinner" aria-hidden="true" />
      <h1>Returning to the starter app</h1>
      <p>This tab can be closed if it does not close automatically.</p>
    </main>
  );
}
