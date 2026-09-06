import type { Category, Entry } from "@prisma/client";

type Identity = {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
};

type EntryWithCategory = Entry & { category: Category };

function escapeLatex(str: string): string {
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function e(str: string | null | undefined): string {
  return escapeLatex(str ?? "");
}

function renderExperienceEntry(entry: EntryWithCategory): string {
  const lines: string[] = [];
  lines.push(
    `    \\resumeSubheading{${e(entry.title)}}{${e(entry.startDate ?? "")}${entry.endDate ? " -- " + e(entry.endDate) : ""}}{${e(entry.organization ?? "")}}{${e(entry.location ?? "")}}`
  );
  if (entry.bullets.length > 0) {
    lines.push("      \\resumeItemListStart");
    for (const bullet of entry.bullets) {
      lines.push(`        \\resumeItem{${e(bullet)}}`);
    }
    lines.push("      \\resumeItemListEnd");
  }
  return lines.join("\n");
}

function renderProjectEntry(entry: EntryWithCategory): string {
  const lines: string[] = [];
  const techTags = entry.tags.length > 0 ? ` $|$ \\emph{${e(entry.tags.join(", "))}}` : "";
  const dateStr = [entry.startDate, entry.endDate].filter(Boolean).join(" -- ");
  lines.push(
    `    \\resumeProjectHeading{\\textbf{${e(entry.title)}}${techTags}}{${e(dateStr)}}`
  );
  if (entry.bullets.length > 0) {
    lines.push("      \\resumeItemListStart");
    for (const bullet of entry.bullets) {
      lines.push(`        \\resumeItem{${e(bullet)}}`);
    }
    lines.push("      \\resumeItemListEnd");
  }
  return lines.join("\n");
}

function renderSkillsSection(entries: EntryWithCategory[]): string {
  const items = entries.map((entry) => {
    const detail = [entry.description, entry.tags.join(", ")].filter(Boolean).join(": ");
    return `\\textbf{${e(entry.title)}}{: ${e(detail)}}`;
  });
  return `    \\resumeItemListStart\n      \\resumeItem{${items.join(" \\\\ ")}}\n    \\resumeItemListEnd`;
}

function renderEducationEntry(entry: EntryWithCategory): string {
  const dateStr = [entry.startDate, entry.endDate].filter(Boolean).join(" -- ");
  return `    \\resumeSubheading{${e(entry.organization ?? entry.title)}}{${e(dateStr)}}{${e(entry.title)}}{${e(entry.location ?? "")}}`;
}

function renderSection(
  title: string,
  slug: string,
  entries: EntryWithCategory[]
): string {
  if (entries.length === 0) return "";

  let content = "";

  switch (slug) {
    case "experience":
      content = `  \\resumeSubHeadingListStart\n${entries.map(renderExperienceEntry).join("\n")}\n  \\resumeSubHeadingListEnd`;
      break;
    case "projects":
      content = `  \\resumeSubHeadingListStart\n${entries.map(renderProjectEntry).join("\n")}\n  \\resumeSubHeadingListEnd`;
      break;
    case "skills":
      content = renderSkillsSection(entries);
      break;
    case "education":
      content = `  \\resumeSubHeadingListStart\n${entries.map(renderEducationEntry).join("\n")}\n  \\resumeSubHeadingListEnd`;
      break;
    default:
      // Custom category: render like experience
      content = `  \\resumeSubHeadingListStart\n${entries.map(renderExperienceEntry).join("\n")}\n  \\resumeSubHeadingListEnd`;
  }

  return `\\section{${escapeLatex(title)}}\n${content}`;
}

export function render(
  identity: Identity,
  entriesByCategory: { category: Category; entries: EntryWithCategory[] }[]
): string {
  const contactParts = [
    identity.phone,
    identity.email ? `\\href{mailto:${identity.email}}{${e(identity.email)}}` : null,
    identity.linkedin ? `\\href{https://${identity.linkedin}}{${e(identity.linkedin)}}` : null,
    identity.github ? `\\href{https://${identity.github}}{${e(identity.github)}}` : null,
    identity.website ? `\\href{${identity.website}}{${e(identity.website)}}` : null,
  ].filter(Boolean);

  const sections = entriesByCategory
    .map(({ category, entries }) => renderSection(category.name, category.slug, entries))
    .filter(Boolean)
    .join("\n\n");

  return `%-------------------------
% Resume in LaTeX
% Based on Jake's Resume Template
%-------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

%--- Custom commands ---
\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}

%--- Header ---
\\begin{center}
  \\textbf{\\Huge \\scshape ${e(identity.name)}} \\\\ \\vspace{1pt}
  \\small ${contactParts.join(" $|$ ")}
\\end{center}

${sections}

\\end{document}
`;
}
