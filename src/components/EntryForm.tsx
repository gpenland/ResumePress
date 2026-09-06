"use client";

import { useRef, useState } from "react";
import type { Category, Entry } from "@prisma/client";

type Props = {
  categories: Category[];
  entry?: Entry;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

export default function EntryForm({ categories, entry, action, submitLabel }: Props) {
  const [bullets, setBullets] = useState<string[]>(entry?.bullets ?? [""]);
  const formRef = useRef<HTMLFormElement>(null);

  function addBullet() {
    setBullets((prev) => [...prev, ""]);
  }

  function updateBullet(index: number, value: string) {
    setBullets((prev) => prev.map((b, i) => (i === index ? value : b)));
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <input type="hidden" name="bullets" value={bullets.filter(Boolean).join("\n")} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Title *" name="title" defaultValue={entry?.title} required />
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Category *</label>
          <select
            name="categoryId"
            defaultValue={entry?.categoryId ?? ""}
            required
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="" disabled>
              Select category
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Organization / Employer" name="organization" defaultValue={entry?.organization ?? ""} />
        <Field label="Location" name="location" defaultValue={entry?.location ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date" name="startDate" placeholder="e.g. Jan 2022" defaultValue={entry?.startDate ?? ""} />
        <Field label="End Date" name="endDate" placeholder="e.g. Dec 2023 or Present" defaultValue={entry?.endDate ?? ""} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
        <textarea
          name="description"
          defaultValue={entry?.description ?? ""}
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
          placeholder="Brief summary..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-700">Bullet Points</label>
          <button
            type="button"
            onClick={addBullet}
            className="text-sm text-blue-600 hover:underline"
          >
            Add bullet
          </button>
        </div>
        <div className="space-y-2">
          {bullets.map((bullet, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="mt-2 text-zinc-300 text-xs">•</span>
              <textarea
                value={bullet}
                onChange={(e) => updateBullet(i, e.target.value)}
                rows={2}
                className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
                placeholder="Bullet point..."
              />
              {bullets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBullet(i)}
                  className="mt-2 text-zinc-400 hover:text-red-500 transition-colors text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="URL" name="url" type="url" defaultValue={entry?.url ?? ""} placeholder="https://..." />
        <Field
          label="Tags"
          name="tags"
          defaultValue={entry?.tags.join(", ") ?? ""}
          placeholder="React, TypeScript, Node.js"
          helpText="Comma-separated"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  helpText,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
        {helpText && <span className="ml-1 text-zinc-400 font-normal">({helpText})</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
    </div>
  );
}
