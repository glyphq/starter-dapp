import type {
  GlyphCallbackResponse,
  GlyphEnvelope,
  GlyphPreparedRelaySession,
  GlyphRelayOptions,
  GlyphRequest,
} from "@glyph-oss/connect";

/**
 * Published @glyph-oss/connect v4.0.1 relay boundary used by the starter.
 *
 * The installed SDK exposes prepare, subscribe, and launch. It does not expose
 * polling, reconnect, or cancellation for a prepared Relay v2 session. Keep
 * those concerns out of this adapter until a published SDK API exists. The
 * app's recovery path therefore prepares a new session and builds a new
 * request instead of trying to reuse or relaunch an old one.
 */
export interface GlyphRelayAdapter {
  prepare(): Promise<GlyphPreparedRelaySession>;
  subscribe(
    request: GlyphRequest,
    session: GlyphPreparedRelaySession,
    options: GlyphRelayOptions,
  ): Promise<GlyphCallbackResponse>;
  launch(envelope: GlyphEnvelope): string;
}
