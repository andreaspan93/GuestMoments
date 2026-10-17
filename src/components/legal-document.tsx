import { CookieSettingsButton } from "@/components/cookie-settings-button";
import {
  cookieInventory,
  privacyCopy,
  privacyLanguage,
  type LegalSlug,
} from "@/content/privacy-copy";

export function LegalDocumentView({ locale, slug }: { locale: string; slug: LegalSlug }) {
  const copy = privacyCopy[privacyLanguage(locale)];
  const document = copy.documents[slug];

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="rounded-2xl bg-muted px-4 py-3 text-sm leading-6">{copy.draft}</p>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{document.title}</h1>
      {document.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-7 text-foreground/80">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      {slug === "cookies" ? (
        <>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-semibold">{copy.cookieColumns.name}</th>
                  <th className="py-2 pr-4 font-semibold">{copy.cookieColumns.category}</th>
                  <th className="py-2 pr-4 font-semibold">{copy.cookieColumns.purpose}</th>
                  <th className="py-2 font-semibold">{copy.cookieColumns.duration}</th>
                </tr>
              </thead>
              <tbody>
                {cookieInventory.map((cookie) => (
                  <tr key={cookie.id} className="border-b border-border align-top">
                    <th className="py-3 pr-4 font-medium" scope="row">
                      {cookie.name}
                    </th>
                    <td className="py-3 pr-4">{copy.cookieCategories[cookie.category]}</td>
                    <td className="py-3 pr-4 leading-6">{copy.cookieRows[cookie.id].purpose}</td>
                    <td className="py-3 leading-6">{copy.cookieRows[cookie.id].duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6">
            <CookieSettingsButton label={copy.nav.cookieSettings} />
          </p>
        </>
      ) : null}
    </article>
  );
}
