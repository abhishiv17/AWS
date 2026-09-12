export type CommandCode =
  | "LEFT"
  | "RIGHT"
  | "FORWARD"
  | "BACK"
  | "RUN"
  | "HIDE"
  | "STOP";

export interface CommandDef {
  code: CommandCode;
  label: string;
  detail: string;
  color: string;
}

export const COMMANDS: CommandDef[] = [
  { code: "LEFT", label: "Route west", detail: "take the west corridor", color: "#4aa8ff" },
  { code: "RIGHT", label: "Route east", detail: "take the east corridor", color: "#39ff88" },
  { code: "FORWARD", label: "Move deeper", detail: "continue into the sector", color: "#ffd23b" },
  { code: "BACK", label: "Fall back", detail: "reverse toward clear air", color: "#ff9f43" },
  { code: "RUN", label: "Move fast", detail: "sprint — time is short", color: "#ff7ad9" },
  { code: "HIDE", label: "Take cover", detail: "shelter from exposure", color: "#c8ff3b" },
  { code: "STOP", label: "Hold", detail: "hold position and wait", color: "#ff5b55" },
];

export const commandByCode = (code: CommandCode) =>
  COMMANDS.find((command) => command.code === code)!;
