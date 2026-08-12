import type {
  GlyphCallbackResponse,
  GlyphEnvelope,
  GlyphRelayErrorCode,
  GlyphRelayEvent,
  GlyphPreparedRelaySession,
  GlyphRelayOptions,
  GlyphRelaySafeError,
  GlyphRelaySnapshot,
  GlyphRequest,
} from "@glyph-oss/connect";

/**
 * Public lifecycle types from @glyph-oss/connect 4.1.0. These diagnostics are
 * deliberately capability-free and contain no callback, URL, signed payload,
 * account, or user-entered request data.
 */
export type GlyphRelayDiagnosticEvent = GlyphRelayEvent;
export type GlyphRelayDiagnosticSnapshot = GlyphRelaySnapshot;
export type GlyphRelaySafeFailure = GlyphRelaySafeError;
export type GlyphRelaySafeFailureCode = GlyphRelayErrorCode;

export interface GlyphRelayAdapter {
  prepare(): Promise<GlyphPreparedRelaySession>;
  subscribe(
    request: GlyphRequest,
    session: GlyphPreparedRelaySession,
    options: GlyphRelayOptions,
  ): Promise<GlyphCallbackResponse>;
  launch(envelope: GlyphEnvelope): string;
}
