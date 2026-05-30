type ContentSection = {
  title: string;
  paragraphs: string[];
};

type Props = {
  sections: ContentSection[];
};

export default function InfoSections({ sections }: Props) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section
          key={section.title}
          className="smk-surface rounded-[28px] px-5 py-5 sm:px-6"
        >
          <h2 className="border-b border-[color:var(--smk-border)] pb-4 text-lg font-semibold text-[color:var(--smk-text)] sm:text-xl">
            {section.title}
          </h2>
          <div className="space-y-3 pt-4 text-sm leading-7 text-[color:var(--smk-text-muted)] sm:text-[15px]">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.title}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

