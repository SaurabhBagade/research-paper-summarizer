# 🎨 Figma Design Prompt: Research Paper Summarizer - NotebookLM-Inspired UI

## PROJECT VISION

Transform the Research Paper Summarizer into a modern, clean, structured research management platform inspired by NotebookLM's design language. The interface will function like a repository structure where users can organize, analyze, and extract insights from research papers through an intuitive trio-panel workspace.

---

## DESIGN AESTHETICS

### Color Palette (Dark Theme - Primary)
- **Primary Background**: #1F2937 (Dark charcoal gray)
- **Secondary Background**: #111827 (Deep black-gray)
- **Card Background**: #1F2937 with subtle borders (#374151)
- **Text Primary**: #F3F4F6 (Off-white)
- **Text Secondary**: #9CA3AF (Medium gray)
- **Accent Color**: #3B82F6 (Bright blue) OR #60A5FA (Sky blue)
- **Success/Action**: #10B981 (Teal green)
- **Hover State**: #374151 (Slightly lighter gray)
- **Border**: #374151 (Subtle dark border)
- **Highlight**: #3B82F6 with 15% opacity

### Typography
- **Font Family**: Inter, -apple-system, BlinkMacSystemFont
- **Heading 1**: 28px Bold (#F3F4F6)
- **Heading 2**: 20px Semi-bold (#F3F4F6)
- **Heading 3**: 16px Semi-bold (#E5E7EB)
- **Body Large**: 15px Regular (#D1D5DB)
- **Body Regular**: 14px Regular (#D1D5DB)
- **Body Small**: 13px Regular (#9CA3AF)
- **Caption**: 12px Regular (#6B7280)

### Visual Style
- **Rounded Corners**: 8px for cards/major elements, 6px for buttons, 4px for inputs
- **Shadows**: Subtle elevation (0 1px 3px rgba(0,0,0,0.3))
- **Spacing System**: 4px base unit (4, 8, 12, 16, 24, 32, 48px)
- **Icon Style**: Outline icons (1.5-2px stroke), 20-24px size

---

## SCREEN 1: DASHBOARD / HOME VIEW

### Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│ Logo + Title          Settings  Profile  PRO               │
├────────────────────────────────────────────────────────────┤
│ Tabs: All | My Notebooks | Featured Notebooks             │
│ Search [🔍         ] | Grid View | List View               │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  FEATURED SECTION                                           │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │ [Gradient    │ [Gradient    │ [Gradient    │             │
│  │  Thumbnail]  │  Thumbnail]  │  Thumbnail]  │             │
│  │              │              │              │             │
│  │ Title Text   │ Title Text   │ Title Text   │             │
│  │ Date • Sources           Date • Sources   │             │
│  └──────────────┴──────────────┴──────────────┘             │
│                                                             │
│  RECENT NOTEBOOKS SECTION                                   │
│  ┌───────────┬───────────┬───────────┬───────────┐          │
│  │ [Icon] +  │ [Icon]    │ [Icon]    │ [Icon]    │          │
│  │ Create    │ Notebook1 │ Notebook2 │ Notebook3 │          │
│  │ New       │ Date      │ Date      │ Date      │          │
│  │           │ Sources   │ Sources   │ Sources   │          │
│  └───────────┴───────────┴───────────┴───────────┘          │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Detailed Components

#### Header
- **Left**: NotebookLM-styled logo + product name
- **Center**: Tab navigation (All | My Notebooks | Featured)
- **Right**: Search bar, View toggle (Grid/List), Settings, Profile menu, "PRO" badge

#### Featured Section
- **Grid**: 3-5 columns (responsive)
- **Cards**:
  - Aspect ratio: ~2:1
  - Gradient overlay background (unique color per notebook)
  - Overlay text at bottom: Title, source count, date
  - Hover effect: Slight elevation + subtle brightness increase
  - Interactive: Click to open

#### Recent Notebooks Section
- **Grid**: 4-5 columns (responsive)
- **Cards**:
  - Square aspect ratio (1:1)
  - Icon/emoji in center or top-left
  - Title below card
  - Metadata (Date + Source count) in small text
  - "Create New" card with large "+" icon

#### Card Styling
- **Background**: #1F2937 with 1px border #374151
- **Hover**: Background lightens to #272E3E, shadow increases
- **Active/Selected**: Blue outline #3B82F6 (2px)
- **Text Overlay**: Gradient background for readability

---

## SCREEN 2: WORKSPACE - RESEARCH ANALYSIS INTERFACE

### Overall Layout
```
┌─────────────────────────────────────────────────────────────┐
│  NotebookLM Logo | Paper Title    | Analytics | Share | ⚙️  │
├──────────────────┬──────────────────────────┬────────────────┤
│                  │                          │                │
│   SOURCES        │     CHAT VIEW             │   ACTION HUB   │
│   (Left Pane)    │     (Center Pane)        │   (Right Pane) │
│                  │                          │                │
│   ├─ Sources    │  ┌──────────────────────┐ │  ┌──────────┐  │
│   ├─ Web        │  │  Chat Messages...     │ │  │ Audio    │  │
│   ├─ Documents  │  │                       │ │  │Overview  │  │
│   ├─ Full Text  │  │  63 sources cited     │ │  └──────────┘  │
│   │             │  │  [Input Box]          │ │                │
│   │             │  └──────────────────────┘ │  ┌──────────┐  │
│   │             │                           │  │Slide      │  │
│   │             │                           │  │Deck       │  │
│   │             │                           │  └──────────┘  │
│   │             │                           │                │
│   │             │                           │  ┌──────────┐  │
│   │             │                           │  │Mind      │  │
│   │             │                           │  │Map       │  │
│   │             │                           │  └──────────┘  │
│   │             │                           │                │
│   │             │                           │  ┌──────────┐  │
│   │             │                           │  │Quiz      │  │
│   │             │                           │  └──────────┘  │
│   │             │                           │                │
└──────────────────┴──────────────────────────┴────────────────┘
```

### Detailed Sections

---

## LEFT PANE: SOURCE LIBRARY & RESOURCE STRUCTURE (25-30% width)

### Header
```
┌─────────────────────────────┐
│ Sources                     │
│ [+ Add sources] [Filter]    │
├─────────────────────────────┤
```

### Content Structure

#### Section 1: Search Bar
- **Input**: "Search the web for new sources"
- **Icon**: Magnifying glass
- **Placeholder**: Light gray text
- **Style**: #272E3E background with #3B82F6 border on focus

#### Section 2: Add Sources Controls
```
┌─────────────────────────────┐
│ [⊕ Add sources]             │
├─────────────────────────────┤
│ Source Type Selector         │
│ ☐ Web     ✓                 │
│ ☐ Fast Research ✓           │
│ [Apply →]                    │
└─────────────────────────────┘
```

#### Section 3: Select All Sources
- Checkbox with label "Select all sources"
- Visual toggle

#### Section 4: Source List Items
```
Each source item contains:
┌─────────────────────────────┐
│ [Icon] Source Title         │
│ Domain • Date               │
│ ✓ (checkmark indicator)     │
│ [⋮ More options]            │
└─────────────────────────────┘
```

**Style Details:**
- Background: #1F2937
- Hover: #272E3E background
- Selected: Blue left border (3px) + blue background #1A365D
- Icon: Source-specific (globe for web, document for PDF, etc.)
- Title: 13px semi-bold white
- Metadata: 12px gray
- Spacing: 8px padding, 4px borders

#### Section 5: Source Categories (Collapsible)
```
├─ 📄 Deep Research Report: The Architectural Evolution...
├─ 🔗 A Guide to Checkpointing in Hadoop | Blog | Cloudera
├─ 📰 Apache HADOOP: Viewfs - Orchestra Community
├─ 📚 Apache HBase - GeeksforGeeks
├─ 🌐 Architecture and Working of Hive - GeeksforGeeks
```

Each category collapsible with chevron icon
- Visual hierarchy with icons and text color coding

---

## CENTER PANE: CHAT INTERFACE (45-50% width)

### Header
```
┌──────────────────────────────────┐
│ [⊡] Chat    [≡] Settings        │
└──────────────────────────────────┘
```

### Chat Area Container
```
Messages scroll area:

┌─────────────────────────────────┐
│                                 │
│ [User Message]                  │
│ User: "Explain Hadoop..."       │
│                                 │
│ [AI Response with Context]      │
│ AI: "Hadoop is..."              │
│ According to the sources:        │
│ - Deep Research Report: ...  3  │
│ - Blog article: ...          1  │
│                                 │
│ [Highlighted source indicators] │
│ 📍 See 42 more sources           │
│                                 │
│                                 │
│ [Time stamp] Today • 6:05 PM     │
│                                 │
└─────────────────────────────────┘
```

**Message Bubble Styling:**

User Message:
- Alignment: Right
- Background: #3B82F6 (blue)
- Text: White
- Border radius: 16px
- Padding: 12px 16px
- Max width: 85%

Assistant Message:
- Alignment: Left
- Background: #272E3E (dark gray)
- Text: #F3F4F6 (off-white)
- Border radius: 16px
- Padding: 12px 16px
- Max width: 85%
- With source citations inline

### Input Area
```
┌──────────────────────────────────┐
│ [Text cursor] Start typing...    │
│ [Attach] [Emoji] [Send →]        │
│ 63 sources                        │
└──────────────────────────────────┘
```

**Input Field:**
- Height: 56px
- Background: #1F2937
- Border: 1px #374151
- Focus: 2px blue border #3B82F6
- Placeholder: "Ask a follow-up question..."
- Font: 14px regular
- Padding: 12px 16px
- Right section: Action buttons

**Action Buttons (Right side):**
- Attach icon (📎) - 24px
- Emoji icon (😊) - 24px
- Send button (➜) - Blue background, white icon, 32px circular
- All with hover effects

### Source Citation Display
```
[👥 Save to note] [👍] [👎]

This text is sourced from these documents:
┌─────────────────────────────┐
│ 📄 Source 1 Title    [→]    │
│ 📄 Source 2 Title    [→]    │
│ ⊕ See 2 more sources        │
└─────────────────────────────┘
```

---

## RIGHT PANE: ACTION HUB / ANALYSIS TOOLS (20-25% width)

### Header
```
┌────────────────────────────────┐
│ Studio                [↗]      │
├────────────────────────────────┤
```

### Action Cards Grid (Stacked Vertical)

Each action card has consistent styling:
```
┌────────────────────────────────┐
│ [Icon - 32px]                  │
│                                │
│ Action Title                   │
│ (16px semi-bold white)         │
│                                │
│ Brief description              │
│ (13px gray)                    │
│                                │
│ Status badge if processing     │
│ "Create in: हिंदी, বাংলা..."   │
└────────────────────────────────┘
```

**Card Styling:**
- Background: #272E3E
- Border: 1px #374151
- Hover: #2D3E4F background, 1px #3B82F6 border, slight shadow elevation
- Cursor: pointer
- Padding: 20px 16px
- Border radius: 8px
- Transition: 200ms ease-out

### Available Action Cards

#### 1. Audio Overview
```
┌────────────────────────────────┐
│ 🎙️  Audio Overview            │
│                                │
│ Create an audio summary        │
│ of this research               │
│                                │
│ Language options:              │
│ हिंदी, বাংলা, తెలుగు...        │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
Interaction: Click to generate audio podcast-style summary
```

#### 2. Slide Deck
```
┌────────────────────────────────┐
│ 📊 Slide Deck                  │
│                                │
│ Generate a presentation        │
│ of key findings                │
│                                │
│ Format: PDF or PowerPoint       │
│                                │
│ [Status: Processing...] [50%]  │
└────────────────────────────────┘
```

#### 3. Mind Map
```
┌────────────────────────────────┐
│ 🧠 Mind Map                    │
│                                │
│ Visualize research              │
│ connections & concepts          │
│                                │
│ Hierarchy auto-generated        │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
```

#### 4. Quiz
```
┌────────────────────────────────┐
│ ❓ Quiz                        │
│                                │
│ Test knowledge on this         │
│ research paper                 │
│                                │
│ 6 questions • ~5 min           │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
```

#### 5. Reports
```
┌────────────────────────────────┐
│ 📈 Reports                     │
│                                │
│ Detailed analysis & metrics    │
│ Export as PDF or JSON          │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
```

#### 6. Infographic
```
┌────────────────────────────────┐
│ 🎨 Infographic                │
│                                │
│ Visual summary of insights     │
│                                │
│ Shareable & interactive        │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
```

#### 7. Data Table
```
┌────────────────────────────────┐
│ 📋 Data Table                  │
│                                │
│ Structured data extraction     │
│ & export (CSV, JSON, etc.)     │
│                                │
│ [Status: Ready] [+ Button]     │
└────────────────────────────────┘
```

**Card Processing States:**
- Ready: Default styling with hover
- Processing: Loading spinner, progress %, slightly dimmed
- Completed: Checkmark badge, brighter appearance
- Error: Red border #EF4444, error icon

---

## DETAILED COMPONENT SPECIFICATIONS

### 1. Notebook Card (Dashboard)
- **Dimensions**: 280px height (responsive width)
- **Aspect Ratio**: Varies (Featured: 2:1, Recent: Square)
- **Background Gradient**: Unique color per notebook (purple, blue, orange, red, green)
- **Text Overlay** (Featured only):
  - Position: Bottom left
  - Background: Linear gradient rgba(0,0,0,0.6) to rgba(0,0,0,0.2)
  - Text: White, 16px semi-bold title, 12px gray metadata
- **Hover**: Scale 1.02, shadow elevation 0 8px 16px rgba(0,0,0,0.4)
- **Active**: Blue border 2px #3B82F6

### 2. Source Item
- **Height**: 72px
- **Padding**: 12px 8px
- **Layout**: Flex with icon (32px), text content, action menu
- **Icon box**: 32x32px, colored based on source type
- **Hover**: Background #272E3E, action icons appear
- **Selected**: Left blue border 3px, background #1A365D
- **Title**: 13px semi-bold, single line truncation
- **Metadata**: 11px gray, "Domain • Date" format

### 3. Chat Message Bubble
- **User Message**:
  - Background: #3B82F6
  - Text: White, 14px regular
  - Padding: 12px 16px
  - Border radius: 16px
  - Alignment: Right, max 85% width

- **Assistant Message**:
  - Background: #272E3E with 1px border #3B82F6/20
  - Text: #F3F4F6, 14px regular
  - Padding: 12px 16px
  - Border radius: 16px
  - Alignment: Left, max 85% width
  - With citation badges inline

- **Source Citation Badge**:
  - Background: #10B981/20
  - Text: #10B981, 11px
  - Padding: 4px 8px
  - Border radius: 4px

### 4. Action Hub Card
- **Width**: Full pane minus padding
- **Height**: Min 160px
- **Background**: #272E3E
- **Border**: 1px #374151
- **Padding**: 20px 16px
- **Border radius**: 8px
- **Icon**: 32x32px, centered top
- **Title**: 16px semi-bold white, centered
- **Description**: 13px gray, centered, 2-line max
- **Language/Status**: 11px gray
- **Hover**:
  - Border: 2px #3B82F6
  - Background: #2D3E4F
  - Shadow: 0 8px 16px rgba(59, 130, 246, 0.1)
  - Action button scale: 1.1

### 5. Input Field
- **Height**: 56px
- **Background**: #1F2937
- **Border**: 1px #374151
- **Border radius**: 6px
- **Padding**: 12px 16px
- **Focus**: 2px solid #3B82F6 border
- **Placeholder**: #6B7280, 14px
- **Font**: 14px regular #F3F4F6
- **Right icons**: Spaced 8px, 24x24px, gray hover

### 6. Button Styles

**Primary Button**
- Background: #3B82F6
- Text: White, 14px semi-bold
- Padding: 10px 20px
- Border radius: 6px
- Hover: Background #2563EB, slight shadow
- Active: Scale 0.98
- Disabled: Opacity 0.5

**Secondary Button**
- Background: #374151
- Text: #F3F4F6, 14px semi-bold
- Border: 1px #4B5563
- Padding: 10px 20px
- Border radius: 6px
- Hover: Background #4B5563

**Icon Button**
- Size: 32x32px or 24x24px
- Background: Transparent
- Icon: #9CA3AF
- Hover: Background #374151, icon #F3F4F6
- Border radius: 4px

### 7. Dropdown / Select Menu
- **Background**: #272E3E
- **Border**: 1px #374151
- **Items**: 36px height each
- **Item hover**: #2D3E4F background
- **Item selected**: Blue left border 3px
- **Shadow**: 0 4px 12px rgba(0,0,0,0.4)
- **Animation**: Fade in 100ms

---

## INTERACTIONS & MICRO-ANIMATIONS

### Transitions Timing
- Default: 150ms ease-out
- Hover effects: 100ms ease-out
- Modal open/close: 200ms ease-out
- Message appear: 300ms ease-out

### Specific Interactions

#### 1. Source Selection
- Click source item → Blue left border appears (150ms)
- Background fades to #1A365D (150ms)
- Content updates in center & right panes (200ms fade)

#### 2. Message Send
- Input field: Button scale 0.95 on click
- Sending animation: Spinner in button
- Message appears: Slide in from bottom + fade (300ms)
- Auto scroll to bottom (smooth, 200ms)

#### 3. Action Card Interaction
- Hover: Border color change, shadow elevation (150ms)
- Click: Scale 0.98, then back to 1.0
- If processing: Spinner animation (continuous)
- If completed: Checkmark animation (bounce effect)

#### 4. Source List Scroll
- Smooth scroll behavior
- Sticky "Add sources" section at top
- Fade in/out at list boundaries

#### 5. Pane Resize
- Drag handles: Cursor changes to col-resize
- During drag: Live preview of new widths
- On release: Smooth animation to final position (200ms)

### Loading States
- Skeleton loaders matching component dimensions
- Pulse animation (1s loop, opacity 0.5 to 1.0)
- Loading spinner: Rotating circle (1s per rotation)
- Progress bar: Linear animation on generation cards

---

## RESPONSIVE DESIGN BREAKPOINTS

| Device | Width | Layout |
|--------|-------|--------|
| Mobile | <640px | Single column (Left → Center → Right, stacked) |
| Tablet | 640-1024px | Left pane collapsible to drawer, Center + Right visible |
| Desktop | 1024-1440px | Three panes visible (25% / 50% / 25%) |
| Wide | >1440px | Three panes visible (25% / 50% / 25%), generous spacing |

**Mobile Changes:**
- Sidebar converts to bottom nav with icons
- Action hub cards displayed as horizontal scroll
- Chat takes full width
- Sources accessible via drawer/modal

---

## ACCESSIBILITY REQUIREMENTS

- **WCAG 2.1 AA** compliance
- **Color Contrast**: 7:1 for text on background
- **Focus Indicators**: Visible 2px blue outline (inner + outer)
- **Keyboard Navigation**: Tab order logical, all interactive elements accessible
- **ARIA Labels**: Proper labels for screen readers
- **Skip Links**: Skip to main content
- **Font Size**: Minimum 14px for body text
- **Touch Targets**: Minimum 44x44px for buttons/interactive elements

---

## DARK MODE ONLY

This entire design is dark-mode first. Light mode is not required unless explicitly requested.

---

## FIGMA FILE STRUCTURE & DELIVERABLES

### Pages to Create:
1. **01 - Design System**
   - Color tokens with hex values
   - Typography scale (all sizes)
   - Spacing grid (4px base)
   - Shadows / Elevation system
   - Border radius definitions
   - Icon library (20px, 24px, 32px variants)

2. **02 - Dashboard / Home**
   - Featured section (3 variants)
   - Recent notebooks grid
   - Create new card
   - All responsive breakpoints
   - Empty state

3. **03 - Workspace Desktop**
   - Left pane: Source library (expanded, collapsed)
   - Center pane: Chat interface (various message states)
   - Right pane: Action hub (all 7 cards)
   - Resizable handles visible

4. **04 - Components Library**
   - Buttons (all states)
   - Input fields
   - Chat bubbles (user + assistant)
   - Source items
   - Action cards (all states: ready, processing, completed)
   - Notification badges
   - Loading states
   - Dropdown menus

5. **05 - Interactions & Prototypes**
   - Source click → pane update flow
   - Message send animation
   - Action card click interaction
   - Pane resize behavior
   - Mobile responsive transitions

6. **06 - Mobile Responsive**
   - Mobile layout (stacked)
   - Tablet layout (drawer + 2 panes)
   - Bottom navigation
   - Drawer/modal for sources
   - Touch-friendly buttons

7. **07 - Empty & Loading States**
   - Empty source list
   - Empty chat
   - Loading skeletons
   - Processing states
   - Error states

8. **08 - Dark Mode Finalization**
   - Final color hex codes
   - All components in dark mode
   - Text color guidelines
   - Contrast verification

---

## DEVELOPER HANDOFF NOTES

### Tech Stack Recommendations:
- **UI Framework**: React 18+
- **Styling**: Tailwind CSS or CSS-in-JS (styled-components)
- **State Management**: Zustand or Redux (for chat, sources state)
- **Animation**: Framer Motion for micro-interactions
- **Component Library**: Headless UI or Radix UI for primitives
- **Icons**: Heroicons or Radix Icons (outline style)

### Key Implementation Notes:
- Implement virtualization for long source lists (100+ items)
- Use React Query for managing API calls & caching
- Implement WebSocket for real-time chat streaming
- Debounce search input (300ms)
- Lazy load action card content
- Implement infinite scroll for chat messages

### Performance Targets:
- First contentful paint: < 2s
- Time to interactive: < 3.5s
- Lighthouse score: 90+

---

## SPECIAL FEATURES & ENHANCEMENTS

### 1. Source Highlighting
- When a message cites sources, highlight them in the left pane
- Visual connection between center and left (subtle animation)

### 2. Keyboard Shortcuts
- `Cmd/Ctrl + K`: Focus search
- `Cmd/Ctrl + Enter`: Send message
- `Escape`: Close modals/drawers
- `Tab`: Navigate between panes

### 3. Sharing & Export
- Share button top right (copies link)
- Export conversation as PDF
- Export sources as BibTeX, JSON, CSV

### 4. Advanced Filtering
- Filter sources by type (Web, PDF, Article, etc.)
- Sort by date, relevance, or source type
- Search within sources

### 5. Annotation & Notes
- Users can save important messages to notes
- Pin sources for quick access
- Highlight text in chat for later reference

---

## REFERENCE & INSPIRATION

- **NotebookLM**: Primary design language reference
- **Claude.ai**: Minimalist chat interface
- **Perplexity.ai**: Source management & citations
- **Google Design System**: Modern dark theme UI
- **Apple Design**: Motion & transitions principles

---

## FINAL CHECKLIST FOR FIGMA

- ✓ All colors documented with hex codes
- ✓ All typography defined (font, size, weight, line-height)
- ✓ Component variants created (normal, hover, active, disabled, loading)
- ✓ Spacing measurements consistent (8px grid)
- ✓ Icons finalized (outline style, black on dark)
- ✓ Interactive flows documented
- ✓ Responsive breakpoints shown
- ✓ Accessibility guidelines noted
- ✓ Animation timings specified
- ✓ Ready for developer handoff with specs

---

**This prompt is ready for a Figma designer to create a production-ready design system and UI mockups!** 🎨
