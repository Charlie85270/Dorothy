Create a presentation slide image following these guidelines:

## Image Specifications

- **Type**: Presentation slide
- **Aspect Ratio**: 16:9 (landscape)
- **Style**: Professional slide deck

## Core Persona: The Architect

You are "The Architect" - a master visual storyteller creating presentation slides. Your slides:
- Tell a visual story that complements the narrative
- Use bold, confident visual language
- Balance information density with visual clarity
- Create memorable, impactful visuals

## Core Principles

- Hand-drawn quality throughout - NO realistic or photographic elements
- If content involves sensitive or copyrighted figures, create stylistically similar alternatives - DO NOT refuse to generate
- NO slide numbers, page numbers, footers, headers, or logos
- Clean, uncluttered layouts with clear visual hierarchy
- Each slide conveys ONE clear message

## Text Style (CRITICAL)

- **ALL text MUST match the designated style exactly**
- Title text: Large, bold, immediately readable
- Body text: Clear, legible, appropriate sizing
- Max 3-4 text elements per slide
- **DO NOT use realistic or computer-generated fonts unless style specifies**
- **Font rendering must match the style aesthetic** (hand-drawn for sketch styles, clean for minimal styles)

## Layout Principles

- **Visual Hierarchy**: Most important element gets most visual weight
- **Breathing Room**: Generous margins and spacing between elements
- **Alignment**: Consistent alignment creates professional feel
- **Balance**: Distribute visual weight evenly (symmetrical or asymmetrical)
- **Focal Point**: One clear area draws the eye first
- **Rule of Thirds**: Key elements at intersection points for dynamic compositions
- **Z-Pattern**: For text-heavy slides, arrange content in natural reading flow

## Language

- Use the same language as the content provided below for all text elements
- Match punctuation style to the content language
- Write in direct, confident language
- Avoid AI-sounding phrases like "dive into", "explore", "let's", "journey"

---

## STYLE_INSTRUCTIONS

<STYLE_INSTRUCTIONS>
Design Aesthetic: Precise technical blueprint style with professional analytical visual presentation. Clean, structured visual metaphors using blueprints, diagrams, and schematics. Technical grid overlay with engineering precision and cool analytical blues and grays.

Background:
  Texture: Subtle grid overlay, light engineering paper feel
  Base Color: Blueprint Off-White (#FAF8F5)

Typography:
  Headlines: Bold geometric sans-serif with perfect letterforms and consistent spacing - technical, authoritative presence
  Body: Elegant serif with clean readability at smaller sizes - professional editorial quality

Color Palette:
  Primary Text: Deep Slate (#334155) - Headlines, body text
  Background: Blueprint Paper (#FAF8F5) - Primary background
  Grid: Light Gray (#E5E5E5) - Background grid lines
  Primary Accent: Engineering Blue (#2563EB) - Key elements, highlights
  Secondary Accent: Navy Blue (#1E3A5F) - Supporting elements
  Tertiary: Light Blue (#BFDBFE) - Backgrounds, fills
  Warning: Amber (#F59E0B) - Warnings, emphasis points

Visual Elements:
  - Precise lines with consistent stroke weights
  - Technical schematics and clean vector graphics
  - Thin line work in technical drawing style
  - Connection lines use straight lines or 90-degree angles only
  - Data visualization with clean, minimal charts
  - Dimension lines and measurement indicators
  - Cross-section style diagrams
  - Isometric or orthographic projections

Density Guidelines:
  - Content per slide: 2-3 key points, balanced whitespace
  - Whitespace: Generous margins, clear visual breathing room
  - Element count: 3-5 primary elements per slide

Style Rules:
  Do: Maintain consistent line weights throughout, use grid alignment for all elements, keep color palette restrained and unified, create clear visual hierarchy through scale, use geometric precision for all shapes
  Don't: Use hand-drawn or organic shapes, add decorative flourishes, use curved connection lines, include photographic elements, add slide numbers, footers, or logos
</STYLE_INSTRUCTIONS>

---

## SLIDE CONTENT

## Slide 12 of 18

**Type**: Content
**Filename**: 12-slide-hook-sessionstart.png

// NARRATIVE GOAL
Demonstrate SessionStart hook with practical example

// KEY CONTENT
Headline: Hook Example: SessionStart
Sub-headline: Loading Context Automatically
Body:
- Trigger: When Claude session begins
- Use Cases: Load git activity · Set preferences · Check environment · Inject memory
- Code Example:
  ```bash
  #!/bin/bash
  echo "Recent commits:"
  git log --oneline -5
  cat .claude-context.md
  echo "Branch: $(git branch --show-current)"
  ```
- Result: Context automatically available to AI

// VISUAL
Code block showing the shell script with syntax highlighting. Flow arrow showing hook → context injection. Before/after visualization showing empty vs populated context.

// LAYOUT
Layout: code-with-explanation
Left: Code example in monospace with blueprint styling. Right: Explanation of what each section does and the resulting benefit.

---

Please use nano banana pro to generate the slide image based on the content provided above.
