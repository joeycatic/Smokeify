"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const TOOLBAR_BUTTON =
  "rounded-md border border-black/15 px-2 py-1 text-xs font-semibold text-stone-700 hover:border-black/30 transition";

const TOOLBAR_ACTIVE = "bg-[#2f3e36] text-white border-[#2f3e36]";

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] rounded-md border border-black/15 px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "<p></p>", false);
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("bold") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("italic") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("bulletList") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Bullets
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("orderedList") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Numbered
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("blockquote") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Quote
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("paragraph") ? TOOLBAR_ACTIVE : ""
          }`}
        >
          Paragraph
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("heading", { level: 2 }) ? TOOLBAR_ACTIVE : ""
          }`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${TOOLBAR_BUTTON} ${
            editor.isActive("heading", { level: 3 }) ? TOOLBAR_ACTIVE : ""
          }`}
        >
          H3
        </button>
      </div>
      {placeholder && !editor.getText().trim() ? (
        <div className="text-xs text-stone-400">{placeholder}</div>
      ) : null}
      <div className="rich-text-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
