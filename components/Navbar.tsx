"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/#services", label: "Services" },
  { href: "/shop", label: "Glasses" },
  { href: "/book", label: "Book Exam" },
  { href: "/gallery", label: "Gallery" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "bg-[rgba(247,248,250,0.9)] backdrop-blur-xl border-b border-[var(--line)]"
          : "bg-transparent"
      }`}
    >
      <div className="wrap flex items-center justify-between py-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-[1.55rem] tracking-[0.08em]">
          LUM<span style={{ color: "var(--accent)" }}>I</span>NA
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-[0.92rem] font-medium text-[var(--slate)]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--ink)] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link href="/admin" className="text-sm text-[var(--slate)] hover:text-[var(--ink)]">
            Admin
          </Link>
          <Link href="/book" className="btn btn-primary !min-h-11 !px-5 !text-sm">
            Book Eye Exam
          </Link>
        </div>

        <button
          className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-strong)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[var(--line)] bg-[rgba(247,248,250,0.98)]">
          <div className="wrap flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-3 text-[1rem] font-medium hover:bg-white"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/book" className="btn btn-primary mt-2" onClick={() => setOpen(false)}>
              Book Eye Exam
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
