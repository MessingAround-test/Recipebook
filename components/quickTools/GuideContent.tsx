import type { QuickGuide } from '../../lib/quickTools'

export default function GuideContent({ guide }: { guide: QuickGuide }) {
    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground leading-relaxed m-0">{guide.summary}</p>
            {guide.sections.map((section, i) => (
                <section key={i} className="flex flex-col gap-2">
                    {section.heading && (
                        <h3 className="m-0 text-[11px] font-black uppercase tracking-widest text-accent">{section.heading}</h3>
                    )}
                    {section.body && (
                        <p className="m-0 text-sm leading-relaxed text-foreground/80">{section.body}</p>
                    )}
                    {section.bullets && section.bullets.length > 0 && (
                        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                            {section.bullets.map((bullet, bi) => (
                                <li key={bi} className="flex gap-2.5 text-sm leading-relaxed text-foreground/80">
                                    <span className="mt-[0.45rem] shrink-0 w-1.5 h-1.5 rounded-full bg-accent/70" />
                                    <span>{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    )
}
