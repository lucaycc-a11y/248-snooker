import type { PilotMatch } from "@/lib/member/pilot-rpc";

export type PosterLabels = { won: string; lost: string; game: string; me: string };

/** Draws a 1080x1350 win/loss poster for one finished match and returns it as a PNG blob. */
export async function renderPosterBlob(match: PilotMatch, labels: PosterLabels, playerName: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const font = "'Good Times', 'Noto Sans TC', system-ui, sans-serif";
  const accent = match.won ? "#9be24a" : "#ff6b6b";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#05070C");
  bg.addColorStop(1, match.won ? "#12240a" : "#2a0d0d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 560);
  glow.addColorStop(0, match.won ? "rgba(155,226,74,0.28)" : "rgba(255,107,107,0.24)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 44px ${font}`;
  ctx.fillText("SPACE8 · SPACE PILOT", W / 2, 130);

  ctx.fillStyle = accent;
  ctx.font = `700 210px ${font}`;
  ctx.fillText(match.won ? labels.won : labels.lost, W / 2, 470);

  ctx.fillStyle = "#fff";
  ctx.font = `700 230px ${font}`;
  ctx.fillText(`${match.myScore} : ${match.oppScore}`, W / 2, 780);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `600 56px ${font}`;
  ctx.fillText(`${playerName}  vs  ${match.opponents.join(", ") || "—"}`, W / 2, 920, W - 120);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 40px ${font}`;
  ctx.fillText(`${labels.game}${match.roomName ? " · " + match.roomName : ""}`, W / 2, 1000, W - 120);
  const d = new Date(match.startedAt);
  if (!Number.isNaN(d.getTime())) {
    ctx.fillText(
      d.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
      W / 2, 1070,
    );
  }
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `500 34px ${font}`;
  ctx.fillText("space8.com.hk", W / 2, 1260);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
