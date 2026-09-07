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

function normalizeUnicode(str: string): string {
  return str
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/–/g, "--")
    .replace(/—/g, "---")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

function escapeLatex(str: string): string {
  return normalizeUnicode(str)
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

// Convert **bold** and *italic* markers to LaTeX commands.
// Must run after escapeLatex so inner content is already safe.
function applyFormatting(str: string): string {
  return str
    .replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}")
    .replace(/\*([^*]+)\*/g, "\\textit{$1}");
}

function e(str: string | null | undefined): string {
  return applyFormatting(escapeLatex(str ?? ""));
}

function renderExperienceEntry(entry: EntryWithCategory): string {
  const dateStr = [entry.startDate, entry.endDate].filter(Boolean).join(" -- ");
  const lines: string[] = [];
  // #1=title #2=date #3=organization #4=location  (matches Jake's Experience layout)
  lines.push(
    `    \\resumeSubheading{${e(entry.title)}}{${e(dateStr)}}{${e(entry.organization ?? "")}}{${e(entry.location ?? "")}}`
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
  const dateStr = [entry.startDate, entry.endDate].filter(Boolean).join(" -- ");
  const techTags = entry.tags.length > 0 ? ` $|$ \\emph{${e(entry.tags.join(", "))}}` : "";
  const lines: string[] = [];
  lines.push(
    `      \\resumeProjectHeading{\\textbf{${e(entry.title)}}${techTags}}{${e(dateStr)}}`
  );
  if (entry.bullets.length > 0) {
    lines.push("        \\resumeItemListStart");
    for (const bullet of entry.bullets) {
      lines.push(`          \\resumeItem{${e(bullet)}}`);
    }
    lines.push("        \\resumeItemListEnd");
  }
  return lines.join("\n");
}

// Matches Jake's original Technical Skills format:
// \begin{itemize}[leftmargin=0.15in, label={}]
//   \small{\item{
//     \textbf{Category}{: item1, item2} \\
//   }}
// \end{itemize}
function renderSkillsSection(entries: EntryWithCategory[]): string {
  const lines = entries.map((entry) => {
    const items = [entry.description, entry.tags.join(", ")].filter(Boolean).join(", ");
    return `     \\textbf{${e(entry.title)}}{: ${e(items)}} \\\\`;
  });
  return (
    `  \\begin{itemize}[leftmargin=0.15in, label={}]\n` +
    `    \\small{\\item{\n` +
    lines.join("\n") + "\n" +
    `    }}\n` +
    `  \\end{itemize}`
  );
}

function renderEducationEntry(entry: EntryWithCategory): string {
  const dateStr = [entry.startDate, entry.endDate].filter(Boolean).join(" -- ");
  // #1=school #2=location #3=degree #4=date  (matches Jake's Education layout)
  return `    \\resumeSubheading{${e(entry.organization ?? entry.title)}}{${e(entry.location ?? "")}}{${e(entry.title)}}{${e(dateStr)}}`;
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
      content = `  \\resumeSubHeadingListStart\n${entries.map(renderExperienceEntry).join("\n")}\n  \\resumeSubHeadingListEnd`;
  }

  return `\\section{${escapeLatex(title)}}\n${content}`;
}

export function render(
  identity: Identity,
  entriesByCategory: { category: Category; entries: EntryWithCategory[] }[]
): string {
  const contactParts = [
    identity.phone ? e(identity.phone) : null,
    identity.email
      ? `\\href{mailto:${identity.email}}{\\underline{${e(identity.email)}}}`
      : null,
    identity.linkedin
      ? `\\href{https://${identity.linkedin}}{\\underline{${e(identity.linkedin)}}}`
      : null,
    identity.github
      ? `\\href{https://${identity.github}}{\\underline{${e(identity.github)}}}`
      : null,
    identity.website
      ? `\\href{${identity.website}}{\\underline{${e(identity.website)}}}`
      : null,
  ].filter(Boolean);

  const sections = entriesByCategory
    .map(({ category, entries }) => renderSection(category.name, category.slug, entries))
    .filter(Boolean)
    .join("\n\n");

  return `%-------------------------
% Resume in LaTeX
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%-------------------------

\\documentclass[letterpaper,11pt]{article}

\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
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

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

%-------------------------
% Custom commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubSubheading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small#1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}

\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-------------------------------------------

\\begin{document}

%----------HEADING----------
\\begin{center}
  \\textbf{\\Huge \\scshape ${e(identity.name)}} \\\\ \\vspace{1pt}
  \\small ${contactParts.join(" $|$ ")}
\\end{center}

${sections}

\\end{document}
`;
}
