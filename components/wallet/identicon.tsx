import Avatar from "boring-avatars";

// Match Glyph wallet's identity marble variant and palette.
const COLORS = [
  "#ccfcfb",
  "#7dd3fc",
  "#6ee7b7",
  "#fbbf24",
  "#a78bfa",
  "#f87171",
];
export function Identicon({
  identity,
  size = 28,
}: {
  identity: string;
  size?: number;
}) {
  return (
    <span aria-hidden="true" className="identity-avatar">
      <Avatar
        size={size}
        name={identity}
        variant="marble"
        colors={COLORS}
        square={false}
      />
    </span>
  );
}
