import Link from "next/link";
import Image from "next/image";
import mascotImg from "../public/mascot.webp";

/* -- content ------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Open a room",
    body: "Create a two-seat drill and share the five-letter code or invite link.",
  },
  {
    n: "02",
    title: "Get your role",
    body: "A ten-second countdown draws one evacuee and one warden.",
  },
  {
    n: "03",
    title: "Hear the briefing",
    body: "A narrated briefing explains the route and controls. Movement unlocks when it ends.",
  },
  {
    n: "04",
    title: "Evacuate, then debrief",
    body: "Clear every objective, reach the marked exit, and review three debrief questions.",
  },
];

const OBJECTIVES = [
  { label: "Emergency backpack", place: "Main foyer", color: "bg-violet" },
  { label: "Lab access card", place: "Chemistry Lab 1A", color: "bg-sun" },
  { label: "Gas isolation valve", place: "Under the fume hood", color: "bg-danger" },
  { label: "First-aid kit", place: "Beside the lab window", color: "bg-coral" },
  { label: "Lab safety clue", place: "Chemistry workstation", color: "bg-mint" },
  { label: "Emergency route guide", place: "Classroom A201", color: "bg-violet" },
  { label: "Marked exit", place: "Back at the foyer", color: "bg-mint" },
];

const STACK = [
  { name: "AppSync Events", body: "Live movement, lobby and warden commands over WebSockets." },
  { name: "DynamoDB", body: "Every lobby action and command, stored as a seven-day event log." },
  { name: "Bedrock", body: "Optional AI narration for the briefing, with an authored fallback." },
];

/* -- page --------------------------------------------------------------- */

export default function Home() {
  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-y-auto text-ink">
      <div className="mx-auto flex min-h-full max-w-[1200px] flex-col px-5 py-5 sm:px-8 sm:py-8">
        {/* --------------- NAV --------------- */}
        <nav className="flex items-center justify-between gap-4 border-b-2 border-ink pb-4">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-black uppercase tracking-[0.14em]">
            <span className="grid h-9 w-9 place-items-center border-2 border-ink bg-coral shadow-[3px_3px_0_var(--ink)]">
              <svg width="16" height="14" viewBox="0 0 14 12" fill="none" aria-hidden>
                <path d="M7 0L13.9282 12H0.0717969L7 0Z" fill="var(--ink)" />
              </svg>
            </span>
            <span>
              Campus<span className="text-coral">Evac</span>
            </span>
          </Link>

          <div className="flex items-center gap-5">
            <a href="#how" className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft hover:text-ink md:block">How it works</a>
            <a href="#roles" className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft hover:text-ink md:block">Roles</a>
            <a href="#objectives" className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft hover:text-ink md:block">Objectives</a>
            <Link href="/simulation/play" className="hidden border-2 border-ink bg-paper-light px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] shadow-[3px_3px_0_var(--ink)] hover:bg-ink hover:text-paper sm:block">Practice solo</Link>
            <Link href="/simulation/rooms" className="brutal-button px-4 py-2 text-[10px]">Start a drill</Link>
          </div>
        </nav>

        <div className="grid border-b-2 border-ink sm:grid-cols-3">
          {[
            { value: "2 roles", label: "Evacuee + warden" },
            { value: "7 steps", label: "Six objectives, one exit" },
            { value: "Live", label: "Synced over AWS AppSync" },
          ].map((item, index) => (
            <div key={item.value} className={`border-b-2 border-ink py-3 sm:border-b-0 ${index < 2 ? "sm:border-r-2 sm:pr-4" : ""} ${index > 0 ? "sm:pl-4" : ""}`}>
              <div className="text-lg font-black uppercase leading-none tracking-tight">{item.value}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-soft">{item.label}</div>
            </div>
          ))}
        </div>

        {/* --------------- HERO --------------- */}
        <section className="grid items-center gap-10 pb-10 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
          <div className="flex flex-col items-start">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="brutal-tag bg-ink text-sun">Co-op evacuation drill</span>
              <span className="brutal-tag bg-paper-light">3D in the browser</span>
            </div>

            <div className="relative w-full">
              <h1 className="text-[clamp(3rem,8.4vw,7rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">
                Two views.
                <br />
                One <span className="text-coral">safe</span>
                <br />
                <span className="bg-sun px-2 shadow-[6px_6px_0_var(--ink)]">exit.</span>
              </h1>
              <div
                className="pointer-events-none absolute z-10 hidden sm:block"
                style={{ right: "-2%", top: "-6%", width: "clamp(120px, 18vw, 210px)", transform: "rotate(7deg)" }}
              >
                <Image src={mascotImg} alt="" width={210} height={210} className="drop-shadow-[5px_5px_0_rgba(29,22,38,0.25)]" priority />
              </div>
            </div>

            <p className="mt-8 max-w-lg text-base font-medium leading-relaxed">
              CampusEvac is a two-player evacuation drill on a stylised university campus. The evacuee moves through the
              labs and classrooms. The warden sees the hazards they can&apos;t, and has to talk them out.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/simulation/rooms" className="brutal-button px-6 py-3.5">
                Start a drill <span className="ml-2">&rarr;</span>
              </Link>
              <Link
                href="/simulation/play"
                className="border-2 border-ink bg-paper-light px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_var(--ink)] transition hover:bg-ink hover:text-paper active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--ink)]"
              >
                Practice solo
              </Link>
              <Link href="/simulation/rooms#join" className="text-[11px] font-black uppercase tracking-[0.16em] underline decoration-2 underline-offset-4 hover:text-violet">
                Join with a code
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="border-2 border-ink bg-night shadow-[10px_10px_0_var(--coral)]">
              <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-paper">
                <span>Science Block / L1</span>
                <span className="flex items-center gap-1.5 text-mint"><span className="signal-pulse h-1.5 w-1.5 rounded-full bg-mint" /> drill live</span>
              </div>
              <Image src="/facility.webp" alt="The CampusEvac campus block" width={800} height={600} className="h-auto w-full object-cover" priority />
            </div>
            <div className="absolute -bottom-5 -left-3 hidden border-2 border-ink bg-sun px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0_var(--ink)] sm:block">
              Talk them out
            </div>
          </div>
        </section>

        {/* --------------- HOW IT WORKS --------------- */}
        <section id="how" className="scroll-mt-6 border-t-2 border-ink py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-black uppercase tracking-[-0.04em] sm:text-4xl">How a drill works</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">About 8 minutes a run</span>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="brutal-panel flex flex-col p-5">
                <span className="font-mono text-2xl font-black text-violet">{step.n}</span>
                <h3 className="mt-3 text-sm font-black uppercase tracking-wide">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* --------------- ROLES --------------- */}
        <section id="roles" className="scroll-mt-6 grid gap-6 border-t-2 border-ink py-10 lg:grid-cols-2">
          <article className="border-2 border-ink bg-paper-light p-6 shadow-[8px_8px_0_var(--violet)]">
            <span className="brutal-tag bg-violet text-paper">Role 1</span>
            <h3 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em]">The evacuee</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              You&apos;re inside the building, in a third-person or first-person view. You read the signs, collect
              equipment, close the gas valve and find the marked exit, but you can&apos;t see the threats.
            </p>
            <ul className="mt-5 grid gap-2 text-[12px] font-bold uppercase tracking-wide">
              <li className="border-l-4 border-violet pl-3">WASD move / Space jump / E interact</li>
              <li className="border-l-4 border-violet pl-3">V switches camera / Esc opens the menu</li>
            </ul>
          </article>
          <article className="brutal-panel-dark p-6">
            <span className="brutal-tag border-paper bg-coral text-ink">Role 2</span>
            <h3 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em]">The warden</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/75">
              You watch from above. You see the gas leak and the failing east route. Verify the evidence, send one
              clear route message, and use your single ventilation override wisely.
            </p>
            <ul className="mt-5 grid gap-2 text-[12px] font-bold uppercase tracking-wide">
              <li className="border-l-4 border-coral pl-3">Observe &rarr; verify &rarr; send route</li>
              <li className="border-l-4 border-coral pl-3">One intervention per drill</li>
            </ul>
          </article>
        </section>

        {/* --------------- OBJECTIVES --------------- */}
        <section id="objectives" className="scroll-mt-6 border-t-2 border-ink py-10">
          <h2 className="text-3xl font-black uppercase tracking-[-0.04em] sm:text-4xl">What you&apos;ll practise</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Six steps across two blocks, then the marked exit. The HUD always shows the next one.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {OBJECTIVES.map((objective, index) => (
              <li key={objective.label} className="flex items-center gap-3 border-2 border-ink bg-paper-light px-4 py-3 shadow-[3px_3px_0_var(--ink)]">
                <span className={`grid h-8 w-8 shrink-0 place-items-center border-2 border-ink font-mono text-xs font-black ${objective.color}`}>{index + 1}</span>
                <span>
                  <span className="block text-[12px] font-black uppercase tracking-wide">{objective.label}</span>
                  <span className="block text-[11px] text-ink-soft">{objective.place}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* --------------- AWS --------------- */}
        <section className="border-t-2 border-ink py-10">
          <div className="brutal-panel-dark grid gap-6 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="brutal-tag border-paper bg-sun text-ink">Built on AWS</span>
              <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em]">No game server.</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper/70">
                Both browsers share the game logic, and AWS carries every move between them in real time.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {STACK.map((item) => (
                <li key={item.name} className="border-2 border-paper/30 p-4">
                  <span className="block text-sm font-black uppercase tracking-wide text-sun">{item.name}</span>
                  <span className="mt-2 block text-[12px] leading-relaxed text-paper/70">{item.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --------------- CTA --------------- */}
        <section className="flex flex-col items-start justify-between gap-6 border-t-2 border-ink py-10 sm:flex-row sm:items-center">
          <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] sm:text-5xl">
            Grab a partner.
            <br />
            <span className="text-coral">Find the exit.</span>
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/simulation/rooms" className="brutal-button px-6 py-3.5">Start a drill &rarr;</Link>
            <Link href="/simulation/play" className="border-2 border-ink bg-paper-light px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_var(--ink)] hover:bg-ink hover:text-paper">Practice solo</Link>
          </div>
        </section>

        {/* --------------- FOOTER --------------- */}
        <footer className="flex flex-col gap-3 border-t-2 border-ink pb-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>CampusEvac / Bharat Builds Tour / AWS &times; WeMakeDevs</span>
          <span>A training simulation, not live emergency guidance.</span>
        </footer>
      </div>
    </main>
  );
}
