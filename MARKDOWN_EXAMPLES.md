# Markdown Examples for Instruction Content

Now you can use Markdown syntax in your instruction `content` fields to add styling and formatting!

## 📝 How to Use

In your `app/data/instructions.ts` or `app/data/instructions-he.ts` files, write content like this:

```typescript
{
  id: "example-instruction",
  title: "Example Instruction",
  explanation: [
    {
      type: "text",
      content: "This is **bold text** and this is *italic text*."
    }
  ]
}
```

## ✨ Available Markdown Features

### Bold Text
```
**bold text** or __bold text__
```
Result: **bold text**

### Italic Text
```
*italic text* or _italic text_
```
Result: *italic text*

### Bold + Italic
```
***bold and italic*** or ___bold and italic___
```
Result: ***bold and italic***

### Links
```
[Link text](https://example.com)
```
Result: [Link text](https://example.com)

### Headings
```
### Heading 3
#### Heading 4
##### Heading 5
```

### Lists

**Unordered Lists:**
```
- Item 1
- Item 2
  - Nested item
- Item 3
```

**Ordered Lists:**
```
1. First step
2. Second step
3. Third step
```

### Inline Code
```
Use `code` for inline code snippets
```
Result: Use `code` for inline code snippets

### Code Blocks
````
```
function hello() {
  console.log("Hello!");
}
```
````

### Blockquotes
```
> This is a quoted text
> It can span multiple lines
```

### Horizontal Rules
```
---
```

### Line Breaks
Use `\n\n` (double newline) for paragraph breaks:
```
First paragraph.\n\nSecond paragraph.
```

## 💡 Real-World Examples

### Example 1: Simple Formatting
```typescript
{
  type: "text",
  content: "To complete this step:\n\n1. Click the **Save** button\n2. Wait for the *confirmation message*\n3. You're done!"
}
```

### Example 2: Rich Content
```typescript
{
  type: "text",
  content: "### Important Note\n\n**Always remember** to:\n\n- Check your work\n- Save frequently\n- Test your changes\n\nFor more information, visit [our guide](https://example.com)."
}
```

### Example 3: Mixed Content
```typescript
explanation: [
  {
    type: "text",
    content: "Follow these **critical steps**:\n\n1. Open the menu\n2. Select **Settings**\n3. Enable the feature"
  },
  {
    type: "image",
    content: "/path/to/image.jpg"
  },
  {
    type: "text",
    content: "After completing the steps above, you should see a *success message*."
  }
]
```

## 🎨 Styling Applied

The Markdown content is automatically styled with:
- Bold text uses `font-weight: 700`
- Links use your accent color (`--color-accent-10`)
- Headings use your subheading font
- Code blocks have a subtle background
- Lists are properly indented
- All spacing follows your design system tokens

## 🚀 Start Using It Now!

Just edit your instruction files and add Markdown syntax - no code changes needed!
