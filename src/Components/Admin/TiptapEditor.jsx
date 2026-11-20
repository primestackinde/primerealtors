import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { uploadArticleImage } from '../../data/blogService.js'
import './TiptapEditor.css'

/**
 * Rich text editor for the article body.
 *
 * Images are uploaded to Supabase Storage (never stored as base64 in the
 * article row), and the `content` prop is only pushed back into the editor
 * when it did not come from the editor itself, so the cursor and undo history
 * survive typing.
 */
export default function TiptapEditor({ content, onChange, slug }) {
  const fileInputRef = useRef(null)
  const lastEmitted = useRef(content)

  const [panel, setPanel] = useState(false)
  const [imageMode, setImageMode] = useState('upload')
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The page already owns the single <h1>; articles may only use h2/h3.
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { loading: 'lazy' },
      }),
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
  })

  // Pull in content loaded from the database without echoing our own edits
  // back through onChange (which would mark the draft dirty on every keystroke).
  useEffect(() => {
    if (!editor || content === lastEmitted.current) return
    if (editor.getHTML() === content) {
      lastEmitted.current = content
      return
    }
    lastEmitted.current = content
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])

  if (!editor) return null

  const closePanel = () => {
    setPanel(false)
    setImageError('')
    setImageUrl('')
    setImageAlt('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const insertImage = (src) => {
    if (!src) return
    editor.chain().focus().setImage({ src, alt: imageAlt.trim() }).run()
    closePanel()
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setImageError('')
    try {
      const url = await uploadArticleImage(file, { slug: slug || 'article' })
      insertImage(url)
    } catch (err) {
      setImageError(err.message || 'Could not upload the image.')
    } finally {
      setUploading(false)
    }
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const buttons = [
    {
      key: 'undo',
      label: '↶',
      title: 'Undo (Ctrl+Z)',
      disabled: !editor.can().undo(),
      onClick: () => editor.chain().focus().undo().run(),
    },
    {
      key: 'redo',
      label: '↷',
      title: 'Redo (Ctrl+Y)',
      disabled: !editor.can().redo(),
      onClick: () => editor.chain().focus().redo().run(),
    },
    { key: 'sep1' },
    {
      key: 'h2',
      label: 'H2',
      title: 'Heading 2',
      active: editor.isActive('heading', { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: 'h3',
      label: 'H3',
      title: 'Heading 3',
      active: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: 'p',
      label: '¶',
      title: 'Normal paragraph',
      active: editor.isActive('paragraph') && !editor.isActive('heading'),
      onClick: () => editor.chain().focus().setParagraph().run(),
    },
    { key: 'sep2' },
    {
      key: 'ul',
      label: '•≡',
      title: 'Bullet list',
      active: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: 'ol',
      label: '1≡',
      title: 'Numbered list',
      active: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: 'quote',
      label: '❝',
      title: 'Quote',
      active: editor.isActive('blockquote'),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    { key: 'sep3' },
    {
      key: 'bold',
      label: '<b>B</b>',
      title: 'Bold (Ctrl+B)',
      active: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      label: '<i>I</i>',
      title: 'Italic (Ctrl+I)',
      active: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      label: '<u>U</u>',
      title: 'Underline (Ctrl+U)',
      active: editor.isActive('underline'),
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'strike',
      label: '<s>S</s>',
      title: 'Strikethrough',
      active: editor.isActive('strike'),
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'code',
      label: '&lt;/&gt;',
      title: 'Inline code',
      active: editor.isActive('code'),
      onClick: () => editor.chain().focus().toggleCode().run(),
    },
    { key: 'sep4' },
    {
      key: 'link',
      label: '🔗 Link',
      title: 'Insert link',
      active: editor.isActive('link'),
      onClick: setLink,
    },
    {
      key: 'image',
      label: uploading ? 'Uploading…' : '🖼️ Image',
      title: 'Insert image',
      disabled: uploading,
      onClick: () => setPanel((open) => !open),
    },
    {
      key: 'hr',
      label: '—',
      title: 'Horizontal rule',
      onClick: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ]

  return (
    <div className="tiptap-editor-wrap">
      <div className="tiptap-toolbar">
        {buttons.map((button) =>
          button.key.startsWith('sep') ? (
            <span key={button.key} className="tiptap-sep" />
          ) : (
            <button
              key={button.key}
              type="button"
              className={`tiptap-btn ${button.active ? 'is-active' : ''}`}
              onClick={button.onClick}
              disabled={button.disabled}
              title={button.title}
              dangerouslySetInnerHTML={{ __html: button.label }}
            />
          ),
        )}
      </div>

      {panel && (
        <div className="tiptap-image-panel">
          <div className="tiptap-image-tabs">
            <button
              type="button"
              className={imageMode === 'upload' ? 'active' : ''}
              onClick={() => setImageMode('upload')}
            >
              Upload
            </button>
            <button
              type="button"
              className={imageMode === 'url' ? 'active' : ''}
              onClick={() => setImageMode('url')}
            >
              Image URL
            </button>
          </div>

          <label className="tiptap-field">
            <span>Description (alt text)</span>
            <input
              type="text"
              value={imageAlt}
              placeholder="Describes the image for search engines and screen readers"
              onChange={(event) => setImageAlt(event.target.value)}
            />
          </label>

          {imageMode === 'upload' ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="tiptap-panel-btn"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Choose image (max 5 MB)'}
              </button>
            </>
          ) : (
            <>
              <label className="tiptap-field">
                <span>Image URL</span>
                <input
                  type="text"
                  value={imageUrl}
                  placeholder="/blog/your-image.webp"
                  onChange={(event) => setImageUrl(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="tiptap-panel-btn"
                onClick={() => insertImage(imageUrl.trim())}
                disabled={!imageUrl.trim()}
              >
                Insert image
              </button>
            </>
          )}

          {imageError && <p className="tiptap-panel-error">{imageError}</p>}

          <button type="button" className="tiptap-panel-cancel" onClick={closePanel}>
            Cancel
          </button>
        </div>
      )}

      <div className="tiptap-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
