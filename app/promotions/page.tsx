import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import DestinationPage from "@/components/home/DestinationPage";
import { getStore } from "@/lib/db/store";
import { isPromotionActive } from "@/lib/appointments";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promotions — LUMINA Optical",
  description: "Current LUMINA offers on exams, frames, and complete pairs.",
};

export default async function PromotionsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const activePromos = data.promotions
    .filter(
      (p) =>
        p.homepageVisible && isPromotionActive(p.startDate, p.endDate, p.active)
    )
    .sort((a, b) => a.priority - b.priority);

  return (
    <>
      <DestinationPage
        destKey="promotions"
        image="https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=1800&q=80"
        primaryHref="/book"
        secondaryHref="/contact"
      />

      {activePromos.length > 0 ? (
        <section className="wrap pb-20">
          <h2 className="section-title !mt-0">{t(dict, "home.offersTitle")}</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activePromos.map((promo) => (
              <article
                key={promo.id}
                className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]"
              >
                {promo.image ? (
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={promo.image}
                      alt={promo.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <span className="pill">{promo.discount}</span>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl">
                    {promo.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--slate)]">{promo.description}</p>
                  <Link href="/book" className="btn btn-accent mt-5 !min-h-11 !px-5 !text-sm">
                    {t(dict, "home.offersCta")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
