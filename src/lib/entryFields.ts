export type FieldConfig = {
  titleLabel: string;
  organizationLabel?: string; // undefined = hidden
  location: boolean;
  dates: boolean;
  description: boolean | string; // string = custom label
  bullets: boolean;
  url: boolean;
  tagsLabel?: string; // undefined = hidden
};

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
  experience: {
    titleLabel: "Job Title",
    organizationLabel: "Employer / Company",
    location: true,
    dates: true,
    description: false,
    bullets: true,
    url: false,
  },
  education: {
    titleLabel: "Degree",
    organizationLabel: "School / University",
    location: true,
    dates: true,
    description: false,
    bullets: false,
    url: false,
  },
  projects: {
    titleLabel: "Project Name",
    location: false,
    dates: true,
    description: false,
    bullets: true,
    url: true,
    tagsLabel: "Technologies",
  },
  skills: {
    titleLabel: "Skill Category",
    location: false,
    dates: false,
    description: "Notes",
    bullets: false,
    url: false,
    tagsLabel: "Skills",
  },
};

export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  titleLabel: "Title",
  organizationLabel: "Organization",
  location: true,
  dates: true,
  description: true,
  bullets: true,
  url: true,
  tagsLabel: "Tags",
};

export function getFieldConfig(slug: string): FieldConfig {
  return FIELD_CONFIGS[slug] ?? DEFAULT_FIELD_CONFIG;
}
