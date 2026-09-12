"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import GameShell from "../../game/GameShell";
import { roomById } from "../../game/level";
import {
  COUNTDOWN_MS,
  type RoomState,
} from "../../game/net/types";
import { resolveRoom, useSession } from "../../game/session";
import { useGame } from "../../game/store";

const NAME_KEY = "campusevac:name";
/** Read browser storage without tripping hydration or effect-ordering rules. */
const noSubscribe = () => () => {};
function useStored<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

function useCountdown(startsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, [startsAt]);
  if (startsAt === null) return null;
  return Math.max(0, Math.ceil((startsAt - now) / 1000));
}

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const connect = useSession((s) => s.connect);
  const leave = useSession((s) => s.leave);
  const disconnect = useSession((s) => s.disconnect);
  const startNow = useSession((s) => s.startNow);
  const startError = useSession((s) => s.startError);
  const status = useSession((s) => s.status);
  const rawRoom = useSession((s) => s.room);
  const myId = useSession((s) => s.myId);
  const isHost = useSession((s) => s.isHost);

  const [edited, setEdited] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);


  const readName = useCallback(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }, []);
  const readSeat = useCallback(() => {
    try {
       const seat = sessionStorage.getItem(`campusevac:host:${code}`);
      return seat ? Number(seat) : null;
    } catch {
      return null;
    }
  }, [code]);
  const readLink = useCallback(
    () => `${window.location.origin}/room/${code}`,
    [code],
  );
  const readShare = useCallback(() => typeof navigator.share === "function", []);

  const storedName = useStored(readName, "");
  const hostSize = useStored(readSeat, null);
  const link = useStored(readLink, "");
  const canShare = useStored(readShare, false);
  const name = edited ?? storedName;



  // Keep the server-side seat on a refresh so the stable tab identity can
  // rejoin it. Explicit Leave controls remove the player row.
  useEffect(() => () => disconnect(), [disconnect]);

  const countdown = useCountdown(
    rawRoom?.phase === "countdown" ? rawRoom.startsAt : null,
  );
  // the draw happens on the clock, not when the host's tab wakes up; the
  // countdown ticker above is what re-renders us as the clock runs out
  const room = resolveRoom(rawRoom);
  const me = room?.players.find((p) => p.id === myId) ?? null;

  // hand the drawn role to the game
  useEffect(() => {
    if (room?.phase !== "playing" || !me?.role) return;
    const game = useGame.getState();
    game.reset();
    game.setMode(
      me.role === "thief"
        ? { kind: "thief" }
        : { kind: "spectator", watching: me.watching ?? "lobby" },
    );
  }, [room?.phase, me?.role, me?.watching]);

  const join = async () => {
    if (joining) return;
    const n = name.trim() || `player-${Math.floor(Math.random() * 900 + 100)}`;
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
    setJoining(true);
    const seed: RoomState | undefined =
      hostSize !== null
        ? {
            code,
            hostId: "",
            maxPlayers: hostSize,
            phase: "lobby",
            startsAt: null,
            players: [],
            createdAt: Date.now(),
            seed: Math.floor(Math.random() * 2 ** 31),
            result: null,
          }
        : undefined;
    try {
      await connect(code, n, seed);
    } finally {
      setJoining(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement("textarea");
        input.value = link;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join room ${code}`,
          text: "Join our CampusEvac drill room",
          url: link,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  const leaveAndGo = () => {
    leave();
    router.push("/rooms");
  };

  const backAction = status === "connected" ? leaveAndGo : undefined;



  if (status === "idle") {
    return (
      <Frame code={code} onBack={backAction}>
        <div className="mb-4 inline-block border-2 border-[#111216] bg-[#e9ff4f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">Access gate</div>
        <h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          {hostSize !== null ? "Open your room" : "Join room"}{" "}
          <span className="font-mono text-[#3b63ff]">{code}</span>
        </h1>
        <p className="mt-4 max-w-lg border-l-4 border-[#3b63ff] pl-4 text-sm font-medium leading-relaxed text-[#5a5960]">
          {hostSize !== null
            ? `Up to ${hostSize} players. Share the link once you are in.`
            : "Pick a name and drop in. Roles are drawn when the countdown ends."}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <input
            value={name}
            onChange={(e) => setEdited(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="your name"
            maxLength={16}
            className="brutal-input w-56 px-3 py-3 text-sm font-bold outline-none"
          />
          <button
            onClick={join}
            disabled={joining}
            className="brutal-button px-5 py-3 disabled:cursor-wait disabled:opacity-50"
          >
            {joining ? "Connecting..." : hostSize !== null ? "Open room ->" : "Join ->"}
          </button>
        </div>
      </Frame>
    );
  }

  if (status === "connecting") {
    return (
      <Frame code={code} onBack={backAction}>
        <div className="flex items-center gap-3 border-2 border-[#111216] bg-[#e9ff4f] p-4 shadow-[4px_4px_0_#111216]">
          <span className="signal-pulse h-3 w-3 rounded-full bg-[#3b63ff]" />
          <div><p className="text-xs font-black uppercase tracking-widest">Opening secure room</p><p className="mt-1 text-xs font-medium text-[#4e4d53]">Finding the facility signal for {code}...</p></div>
        </div>
      </Frame>
    );
  }

  if (
    status === "notfound" ||
    status === "full" ||
    status === "unavailable" ||
    status === "timeout" ||
    status === "connection"
  ) {
    const signalUnavailable = status === "timeout" || status === "connection";
    return (
      <Frame code={code} onBack={backAction}>
        <div className="mb-4 inline-block border-2 border-[#111216] bg-[#ff5b55] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">
          {signalUnavailable ? "Signal unavailable" : "Signal error"}
        </div>
        <h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          {signalUnavailable
            ? "Could not reach that room"
            : status === "full"
            ? "That room is full"
            : status === "unavailable"
              ? "That room is unavailable"
              : "No such room"}
        </h1>
        <p className="mt-4 max-w-lg border-l-4 border-[#ff5b55] pl-4 text-sm font-medium leading-relaxed text-[#5a5960]">
          {status === "timeout"
            ? "The room may still be active. The connection took too long to respond; try again from the same invite."
            : status === "connection"
              ? "The room service could not be reached. Check your connection and try the invite again."
              : status === "full"
            ? "Every seat is taken. Ask the host to start a new one."
            : status === "unavailable"
              ? "This room is no longer accepting new players. Rejoin from the same tab to restore an existing seat."
              : "Nobody is hosting this code. Check the invite link or ask the host to open a new room."}
        </p>
        <Link
          href="/rooms"
          className="brutal-button mt-8 px-5 py-3"
        >
          Back to rooms -&gt;
        </Link>
      </Frame>
    );
  }

  /* --------------------------------------------------------------- game */

  if (room?.phase === "playing" && me?.role) {
    return (
      <main className="relative flex-1">
        <GameShell
          title={
            me.role === "thief"
              ? `Evacuee · room ${code}`
              : `Warden / ${roomById(me.watching ?? "lobby").name} · room ${code}`
          }
        />
      </main>
    );
  }

  if (room?.phase === "ended") {
    const thiefLeft = room.result === "thief-left";
    const spectatorLeft = room.result === "spectator-left";
    return (
      <Frame code={code} onBack={backAction}>
        <div className="mb-4 inline-block border-2 border-[#111216] bg-[#ff5b55] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">
          Room unavailable
        </div>
        <h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          {thiefLeft
             ? "The evacuee left. This drill is over."
             : spectatorLeft
               ? "A warden did not return."
               : "This drill is over"}
        </h1>
        <p className="mt-4 max-w-lg border-l-4 border-[#ff5b55] pl-4 text-sm font-medium leading-relaxed text-[#5a5960]">
          {thiefLeft
             ? "The room has been closed. Return to the room list to start a new drill."
             : spectatorLeft
               ? "The room was closed after the 20-second rejoin window. Start a new drill."
               : "The room has finished and cannot accept another participant. Open a new drill room to continue."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={leaveAndGo} className="brutal-button px-5 py-3">
            Back to rooms -&gt;
          </button>
        </div>
      </Frame>
    );
  }

  /* -------------------------------------------------------------- lobby */

  const playerCount = room?.players.length ?? 0;
  const enoughPlayers = !!room && playerCount >= room.maxPlayers;
  const hostCanStart =
    isHost &&
    (room?.phase === "lobby" || room?.phase === "countdown") &&
    enoughPlayers &&
    !starting;
  const waitingMessage = !room
    ? "Reading the room signal..."
    : room.phase === "countdown"
      ? "Game starting - roles are being drawn."
      : room.phase === "playing"
        ? "Game starting - assigning roles..."
        : enoughPlayers
          ? "All seats are filled. The ten-second countdown is running."
          : `Waiting for ${room.maxPlayers - playerCount} more player${room.maxPlayers - playerCount === 1 ? "" : "s"}.`;
  const startErrorMessage =
    startError === "not-host"
      ? "Host permission changed."
      : startError === "not-ready"
        ? "Waiting for every player to join."
        : startError === "started"
          ? "The run is already starting."
          : startError
            ? "The room is no longer available."
            : null;

  return (
    <Frame code={code} onBack={backAction}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#111216] pb-5">
        <div><div className="mb-3 inline-block bg-[#111216] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#e9ff4f]">Crew lobby / live</div><h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          Room <span className="font-mono text-[#3b63ff]">{code}</span>
        </h1>
        </div><span className="border-2 border-[#111216] bg-[#e9ff4f] px-3 py-2 text-[11px] font-black uppercase tracking-widest shadow-[3px_3px_0_#111216]">
          {room ? `${room.players.length}/${room.maxPlayers} players` : "..."}
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              readOnly
              value={link}
              aria-label="Room invite link"
              className="brutal-input w-full max-w-xl px-3 py-3 font-mono text-xs text-[#5a5960] outline-none sm:flex-1"
            />
            <div className="flex shrink-0 gap-3">
              <button
                onClick={copyLink}
                disabled={!link}
                className="brutal-button px-4 py-3 disabled:cursor-wait disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              {canShare && (
                <button onClick={shareLink} className="brutal-button px-4 py-3">
                  Share
                </button>
              )}
            </div>
          </div>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77757a]">
            Share this link to join room {code}.
          </p>
        </div>
        </div>
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {room?.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between border-2 border-[#111216] bg-[#fffdf7] px-4 py-3 text-sm shadow-[3px_3px_0_#111216]"
          >
            <span className={p.id === myId ? "font-black text-[#111216]" : "font-semibold text-[#5a5960]"}>
              {p.name}
              {p.id === room.hostId && (
                <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-[#3b63ff]">
                  host
                </span>
              )}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#24a866]">
              {p.connected === false
                ? "rejoining"
                : p.id === myId
                  ? "you"
                  : "ready"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-start gap-4">
        {room?.phase === "countdown" ? (
          <div className="flex items-baseline gap-3 border-2 border-[#111216] bg-[#111216] px-4 py-3 text-[#f2eee5] shadow-[4px_4px_0_#3b63ff]">
            <span className="font-mono text-5xl font-black text-[#e9ff4f]">
              {countdown ?? Math.ceil(COUNTDOWN_MS / 1000)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f2eee5]/70">
              draw at zero
            </span>
          </div>
        ) : (
          <div className="border-l-4 border-[#3b63ff] pl-3 text-xs font-bold text-[#5a5960]" role="status" aria-live="polite">
            <span className="block">{waitingMessage}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-[#77757a]">
              {playerCount}/{room?.maxPlayers ?? "-"} players · all seats required
            </span>
          </div>
        )}
        {isHost && room?.phase !== "playing" && (
          <div className="flex flex-wrap items-center gap-3 border-2 border-[#111216] bg-[#fffdf7] p-2 shadow-[4px_4px_0_#111216]">
            <span className="px-1 text-[10px] font-black uppercase tracking-widest text-[#3b63ff]">
              Host control
            </span>
            <button
              onClick={async () => {
                if (starting || !enoughPlayers) return;
                setStarting(true);
                await startNow();
                setStarting(false);
              }}
              disabled={!hostCanStart}
              className="brutal-button px-4 py-3 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {starting ? "Starting..." : enoughPlayers ? "Start now ->" : "Start when ready"}
            </button>
          </div>
        )}
      </div>

      {startErrorMessage && (
        <p className="mt-3 border-l-2 border-[#ff5b55] pl-3 text-[11px] font-bold text-[#b53f3a]" role="alert">
          {startErrorMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={leaveAndGo} className="border-2 border-[#111216] bg-transparent px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#111216] hover:text-[#f2eee5]">
          Leave room
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#77757a]">
          You can rejoin this invite while the room is waiting.
        </span>
      </div>

      <p className="mt-8 max-w-lg border-t border-[#111216]/20 pt-4 text-[11px] font-semibold leading-relaxed text-[#6c6b70]">
         One participant is assigned as the evacuee and enters the campus route.
         Wardens are posted to a single sector and relay the evidence they can
         see. Talk to each other; the evacuee cannot see the full safety layer.
      </p>
    </Frame>
  );
}

function Frame({
  code,
  children,
  onBack,
}: {
  code: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-y-auto text-[#111216]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-5 sm:px-8 sm:py-8">
        <Link
          href="/rooms"
          onClick={onBack}
          className="border-b-2 border-[#111216] pb-4 text-[11px] font-black uppercase tracking-[0.18em] hover:text-[#3b63ff]"
        >
          &lt;- rooms
        </Link>
        <div className="mt-12 max-w-3xl">{children}</div>
        <div className="mt-auto pt-16 text-[10px] font-bold uppercase tracking-[0.16em] text-[#77757a]">
          room / {code} / local signal
        </div>
      </div>
    </main>
  );
}
