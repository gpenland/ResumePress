import { createResume } from "../actions";

const TEMPLATES = [
  { id: "jake", name: "Jake's Resume", description: "Classic single-column professional template" },
];

export default function NewResumePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">New Resume</h1>

      <form action={createResume} className="space-y-8">
        <section className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Resume Details</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Resume Name *</label>
            <input
              type="text"
              name="resumeName"
              required
              placeholder="e.g. Software Engineer Resume"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Template</label>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 cursor-pointer hover:border-zinc-300"
                >
                  <input
                    type="radio"
                    name="templateId"
                    value={t.id}
                    defaultChecked={t.id === "jake"}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Identity / Contact Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <IdentityField label="Full Name *" name="name" required />
            <IdentityField label="Email *" name="email" type="email" required />
            <IdentityField label="Phone" name="phone" placeholder="+1 (555) 000-0000" />
            <IdentityField label="Website" name="website" type="url" placeholder="https://..." />
            <IdentityField label="LinkedIn" name="linkedin" placeholder="linkedin.com/in/..." />
            <IdentityField label="GitHub" name="github" placeholder="github.com/..." />
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Create Resume
          </button>
        </div>
      </form>
    </div>
  );
}

function IdentityField({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
    </div>
  );
}
