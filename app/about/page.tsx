import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About — LUMINA",
  description:
    "The LUMINA story — premium optical care, craftsmanship, and quiet luxury in Tel Aviv.",
};

export default async function AboutPage() {
  const { data } = await getStore();
  const team = data.staff.filter((s) => s.active).slice(0, 3);

  return (
    <div className="pb-20 pt-28">
      {/* Intro */}
      <section className="wrap">
        <Reveal>
          <span className="eyebrow">About</span>
          <h1 className="section-title max-w-3xl">
            An optical house built on clarity and restraint
          </h1>
          <p className="section-lead mt-4">
            LUMINA began with a simple belief: vision care should feel as refined
            as the frames you wear. We designed a store where clinical precision
            and quiet luxury share the same room.
          </p>
        </Reveal>
      </section>

      {/* Brand story */}
      <section className="section">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)]">
              <Image
                src="https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1200&q=80"
                alt="Eye examination at LUMINA"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <span className="eyebrow">Our story</span>
            <h2 className="section-title !text-[clamp(2rem,4vw,3rem)]">
              Precision without noise
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed">
              From comprehensive eye examinations to progressive lens fittings,
              every visit is paced for accuracy. Our optometrists take the time
              your eyes deserve — no rush, no upselling theatre.
            </p>
            <p className="mt-4 text-[1.05rem] leading-relaxed">
              Alongside the clinic, our atelier curates acetate, titanium, and
              metal frames with an editor&apos;s eye. Fewer options. Better ones.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Craftsmanship */}
      <section className="section !pt-0">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Craft</span>
            <h2 className="section-title">Craftsmanship you can feel</h2>
            <p className="section-lead">
              Measurements, materials, and finishing — the invisible details that
              make all-day wear effortless.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                title: "Measured fittings",
                text: "Pupillary distance, pantoscopic tilt, and wrap — dialed in so lenses sit exactly where they should.",
              },
              {
                title: "Material honesty",
                text: "Italian acetate, featherweight titanium, and brushed metals chosen for balance and longevity.",
              },
              {
                title: "Lens science",
                text: "Progressive, blue-light, polarized, and office lenses matched to how you actually see your day.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <div className="border-t border-[var(--line-strong)] pt-6">
                  <h3 className="font-[family-name:var(--font-display)] text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-3">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team teaser */}
      <section className="section bg-white/50">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Team</span>
            <h2 className="section-title">The people behind the lenses</h2>
            <p className="section-lead">
              Optometrists and optical specialists dedicated to precise care.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {team.map((member, i) => (
              <Reveal key={member.id} delay={i * 90}>
                <article>
                  <div
                    className="mb-5 aspect-[4/5] rounded-[var(--radius)]"
                    style={{
                      background: `linear-gradient(160deg, ${member.color}33, ${member.color}88), linear-gradient(180deg, #eef2f5, #dce4ec)`,
                    }}
                  />
                  <h3 className="font-[family-name:var(--font-display)] text-2xl">
                    {member.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
                    {member.title}
                  </p>
                  {member.bio && (
                    <p className="mt-3 text-sm leading-relaxed">{member.bio}</p>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary">
                Book Eye Exam
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                Visit the store
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
