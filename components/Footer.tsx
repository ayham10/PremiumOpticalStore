import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--ink)] text-white">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
            LUM<span style={{ color: "#7eb6d8" }}>I</span>NA
          </div>
          <p className="mt-4 max-w-sm text-[0.95rem] text-white/65">
            Premium optical care — precise examinations, curated frames, and
            effortless appointments.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-[0.18em] uppercase text-white/45">
            Visit
          </div>
          <p className="mt-4 text-white/75">
            128 King George Street
            <br />
            Tel Aviv
          </p>
          <p className="mt-3 text-white/75">+972-3-555-0180</p>
          <p className="text-white/75">hello@lumina.optics</p>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-[0.18em] uppercase text-white/45">
            Explore
          </div>
          <div className="mt-4 flex flex-col gap-2 text-white/75">
            <Link href="/shop">Shop</Link>
            <Link href="/book">Book Exam</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/admin">Staff Login</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-2 py-5 text-sm text-white/45 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} LUMINA Optical.</span>
          <span>Precision vision. Quiet luxury.</span>
        </div>
      </div>
    </footer>
  );
}
