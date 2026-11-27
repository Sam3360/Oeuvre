import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  Factory,
  Handshake,
  MapPin,
  Recycle,
  Ruler,
  Search,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { api, type ImpactResponse } from "../api";
import { Logo } from "../components/shell";
import { formatNumber } from "../lib";

const STEPS = [
  {
    title: "Describe the event",
    body: "Name the event, the dates, the expected attendance and where it happens. Oeuvre turns that into a list of equipment requirements.",
    icon: CalendarCheck,
  },
  {
    title: "See what is nearby",
    body: "Nearby schools, societies, NGOs, clubs and households list the chairs, speakers and stages they already own and are willing to lend.",
    icon: Search,
  },
  {
    title: "Match, then book",
    body: "Oeuvre scores every listing on stock, dates, distance, condition and cost, then sends your request to the owners.",
    icon: Handshake,
  },
  {
    title: "Return and record",
    body: "Pick up, return, confirm. Booking history keeps stock accurate and feeds your shared impact record.",
    icon: Boxes,
  },
];

const REUSE_POINTS = [
  {
    title: "Existing stock does more work",
    body: "Chairs, stages and projectors that already exist get used again and again, instead of sitting in a store room between events.",
    icon: Recycle,
  },
  {
    title: "Fewer new products needed",
    body: "Each requirement a nearby lender can cover is a purchase that can be deferred or dropped — and manufacturing is where most of a product's environmental cost is locked in.",
    icon: Factory,
  },
  {
    title: "Less waste after the event",
    body: "Borrowed equipment goes back to its owner and can be lent again, rather than being stored, forgotten or thrown away.",
    icon: Trash2,
  },
];

const MATCH_SIGNALS = [
  { label: "Available quantity for your dates", weight: 30 },
  { label: "Category and requirement fit", weight: 20 },
  { label: "Distance from the venue", weight: 20 },
  { label: "Condition of the equipment", weight: 15 },
  { label: "Borrowing cost", weight: 15 },
];

export default function LandingPage() {
  const { data: impact } = useQuery({
    queryKey: ["/api/oeuvre/impact", "landing"],
    queryFn: () => api.get<ImpactResponse>("/impact"),
    staleTime: 60_000,
  });

  const actual = impact?.actual;

  return (
    <div className="min-h-screen bg-[#F7F7F2]">
      <header className="sticky top-0 z-40 border-b border-forest/10 bg-[#F7F7F2]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <span className="rounded-lg bg-forest p-1.5">
              <Logo />
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-forest/70 md:flex">
            <a href="#how" className="transition-colors hover:text-forest">How it works</a>
            <a href="#matching" className="transition-colors hover:text-forest">Matching</a>
            <a href="#reuse" className="transition-colors hover:text-forest">Why reuse</a>
            <a href="#impact" className="transition-colors hover:text-forest">Impact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth">
              <span className="cursor-pointer rounded-lg px-3 py-2 text-[13px] font-medium text-forest transition-colors hover:bg-forest/[0.06]">
                Sign in
              </span>
            </Link>
            <Link href="/auth?mode=register">
              <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-[13px] font-semibold text-cream transition-colors hover:bg-forest-deep">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-forest">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #D5F2B4 0, transparent 42%), radial-gradient(circle at 82% 30%, #6A927B 0, transparent 38%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-lime">
              <Sparkles className="h-3 w-3" />
              Community equipment sharing
            </span>
            <h1 className="mt-5 font-display text-[38px] font-extrabold leading-[1.06] text-cream sm:text-[54px]">
              Plan the event.
              <br />
              Borrow what your
              <br />
              <span className="text-lime">community owns.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-cream/70">
              Oeuvre matches the equipment your event needs with the chairs, tables,
              projectors and stages already sitting in nearby organisations — so you
              borrow for a day instead of buying for a lifetime. Every listing reused is
              one less item manufactured, shipped and eventually thrown away.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth?mode=register">
                <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-semibold text-forest transition-transform hover:-translate-y-0.5">
                  Create your account
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-cream/20 px-5 py-3 text-sm font-medium text-cream/85 transition-colors hover:bg-cream/10"
              >
                See how matching works
              </a>
            </div>
            <p className="mt-5 text-[12px] text-cream/45">
              Built for schools, societies, NGOs and clubs — and everyday people.
            </p>
          </div>

          {/* Illustrative match preview */}
          <div className="relative">
            <div className="rounded-2xl border border-cream/15 bg-cream/[0.07] p-2 backdrop-blur-sm">
              <div className="rounded-xl bg-white p-5 shadow-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-moss">
                      Illustrative preview
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-forest">Annual Day</p>
                  </div>
                  <span className="rounded-full bg-lime/60 px-2.5 py-1 text-[11px] font-semibold text-forest">
                    100% covered
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Date", value: "15 Dec" },
                    { label: "Guests", value: "300" },
                    { label: "Venue", value: "School" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-cream/70 px-2 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-[13px] font-semibold text-forest">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2.5">
                  {[
                    { name: "Chairs", qty: "120 from Greenfield School", meta: "2.4 km · Good · Free" },
                    { name: "PA system", qty: "1 from Riverside Society", meta: "3.1 km · Excellent · ₹800/day" },
                    { name: "Stage risers", qty: "6 from City NGO Hub", meta: "5.6 km · Good · ₹1,200/day" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-forest">{row.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.qty}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{row.meta}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-muted-foreground">
                  Example only. Real matches come from live inventory on your platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
            The gap between events and stock
          </p>
          <h2 className="mt-3 font-display text-[28px] font-bold leading-tight text-forest sm:text-[36px]">
            Every community buys the same things, then stores them.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            A school buys 300 chairs for one annual day. A society buys a projector for
            monthly meetings. An NGO buys a canopy for one drive a year. The equipment
            works for a day and then waits in a store room — while the organisation
            across the road rents exactly the same thing. The cost is not only money:
            every unnecessary purchase carries the materials and energy used to make it,
            and most of that equipment is used a handful of times a year.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Money spent once a year",
              body: "Purchases are sized for peak events, not everyday use. Oeuvre helps you cover the peak without adding to storage.",
              icon: Wallet,
            },
            {
              title: "Stock nobody can find",
              body: "Useful equipment already exists within a few kilometres. Without a shared view, it may as well not exist.",
              icon: MapPin,
            },
            {
              title: "Requests made by phone",
              body: "Availability, approval and returns live in scattered messages. Oeuvre keeps the whole handover in one record.",
              icon: Handshake,
            },
          ].map((item) => (
            <div key={item.title} className="surface p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest/[0.06] text-forest">
                <item.icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-forest">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why reuse */}
      <section id="reuse" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
              Why reuse wins
            </p>
            <h2 className="mt-3 font-display text-[28px] font-bold leading-tight text-forest sm:text-[36px]">
              The greenest equipment is the equipment that already exists.
            </h2>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Sharing keeps useful things in use and out of landfill — no new purchase
            required.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {REUSE_POINTS.map((point) => (
            <div key={point.title} className="surface p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime/40 text-forest">
                <point.icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-forest">
                {point.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-3xl rounded-xl bg-cream/60 px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-forest/80">
            How sharing reduces emissions and waste:{" "}
          </span>
          an item borrowed is an item that did not have to be manufactured, packaged and
          shipped, and one less item that may be discarded after a single event. Oeuvre
          does not put a number on that saving — doing so honestly would need
          product-level data the platform does not have.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-forest/10 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
                How it works
              </p>
              <h2 className="mt-3 font-display text-[28px] font-bold leading-tight text-forest sm:text-[36px]">
                From an event brief to a confirmed handover.
              </h2>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              No spreadsheets, no group chats, no guessing whether the chairs are free.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-border bg-[#FAFAF6] p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-forest text-lime">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-display text-2xl font-bold text-forest/15">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-[15px] font-semibold text-forest">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Matching */}
      <section id="matching" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
              Transparent matching
            </p>
            <h2 className="mt-3 font-display text-[28px] font-bold leading-tight text-forest sm:text-[36px]">
              Recommendations you can audit, not a black box.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Every match is scored from the actual inventory, the actual dates and the
              actual bookings already on the calendar. Oeuvre shows the reasons behind
              each score, so you can decide with confidence.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Stock is reserved only when an owner approves — pending requests never block another organisation.",
                "Quantities are checked again at approval time, so two events cannot be promised the same chairs.",
                "No single owner? Oeuvre splits a requirement across several organisations to cover the gap.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-forest/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="surface p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-forest">Match score weights</p>
              <span className="rounded-full bg-cream px-2 py-1 text-[10px] font-medium text-muted-foreground">
                Out of 100
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {MATCH_SIGNALS.map((signal) => (
                <div key={signal.label}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-forest/80">{signal.label}</span>
                    <span className="font-semibold text-forest">{signal.weight}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-forest/[0.07]">
                    <div
                      className="h-full rounded-full bg-moss"
                      style={{ width: `${(signal.weight / 30) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-lime/30 p-3 text-[11.5px] leading-relaxed text-forest/80">
              <Ruler className="mt-0.5 h-4 w-4 shrink-0" />
              Distance is measured between the venue and the owner&apos;s registered
              location. Listings without coordinates are scored conservatively.
            </div>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="border-y border-forest/10 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
                Live platform activity
              </p>
              <h2 className="mt-3 font-display text-[28px] font-bold leading-tight text-forest sm:text-[36px]">
                Only what the platform can actually verify.
              </h2>
            </div>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              These figures come straight from completed Oeuvre bookings. Reuse is the
              point — so we report what was shared, not an invented carbon saving.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Completed shares", value: actual?.completedShares },
              { label: "Units reused", value: actual?.unitsReused },
              { label: "People and organisations sharing", value: actual?.participatingOrganisations },
              { label: "Active listings", value: actual?.activeListings },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-[#FAFAF6] p-5">
                <p className="font-display text-3xl font-bold text-forest">
                  {formatNumber(stat.value ?? 0)}
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {!actual?.completedShares ? (
            <p className="mt-5 text-[12px] text-muted-foreground">
              The platform is new — live figures will grow as people and organisations
              complete their first handovers.
            </p>
          ) : null}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-forest px-6 py-12 sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-lime/15 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-[26px] font-bold leading-tight text-cream sm:text-[32px]">
                Start with one event, one listing, one neighbour.
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-cream/65">
                Add what you own, plan what you need, and let Oeuvre find the shortest
                path between the two. Individuals, households and organisations are all
                welcome — no organisation required.
              </p>
            </div>
            <Link href="/auth?mode=register">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-semibold text-forest transition-transform hover:-translate-y-0.5">
                Join Oeuvre
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-forest/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-[12px] text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-forest p-1">
              <Logo compact />
            </span>
            <span className="font-display font-semibold text-forest">Oeuvre</span>
            <span>· Reuse over buying</span>
          </div>
          <p>Community equipment sharing · reuse over buying.</p>
        </div>
      </footer>
    </div>
  );
}
