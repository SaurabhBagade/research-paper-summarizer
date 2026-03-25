# 🌌 Research Paper Analyst (Frontend)

A modern, high-performance web interface designed for scholars and researchers to actively interact with complex academic papers. Built with an emphasis on speed, precision, and a "classic, professional" aesthetic.

## ✨ The Tri-Pane Architecture

This frontend has been completely overhauled from a basic chat interface into a **Professional Tri-Pane Workspace**:

1. **Source Document (Left Pane):** A high-fidelity PDF viewer that supports *Dynamic Sentence-Level Highlighting*. When the AI Analyst references a specific paragraph or formula, the document automatically scrolls and physically highlights the exact coordinates of the information used.
2. **AI Analyst (Center Pane):** A conversational interface connected to a localized RAG engine. It maintains strict conversational context across multi-turn questions and intelligently parses citations.
3. **Intel Hub (Right Pane):** A dedicated intelligence board that dynamically populates with relevant charts, figures, and extracted metadata based *strictly* on what you are currently researching in the chat.

## 🛠 Tech Stack

*   **Core:** React 18 + TypeScript + Vite
*   **Aesthetics:** Tailwind CSS v4 + Radix UI Primitives + Lucide Icons
*   **Orchestration:** `react-resizable-panels` for fluid, drag-and-drop workspace customization.
*   **Syntax & Layout:** Clean glassmorphism overlays with dark-mode optimized gradients (Indigo + Slate-900).

## 🚀 Running the Frontend

### Option A: Dockerized (Production/Integration)
The frontend is part of a larger multi-container application. Ensure you are in the root directory and run:
```bash
docker-compose up -d --build
```
The application will be exposed identically at `http://localhost:3001`.

### Option B: Local Hot-Reloading (Development)
If you are modifying UI components and want instant feedback without rebuilding the Docker container:

1. Ensure you have Node.js 18+ installed.
2. Install the necessary packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the UI at **`http://localhost:3000`**.

*(Note: In local development, the UI expects your `backend` Docker container to be mapped to port `8080`, otherwise document uploads and chat responses will fail).*

## 🧠 Key Features & API Handshakes
*   **`context_highlights`**: The frontend captures precise `[x0, y0, x1, y1]` bounding box coordinates returned by the API to pinpoint exact sentences in the PDF.
*   **`relevant_images`**: A dedicated API listener fetches semantic figures related to your query and renders them chronologically in the Intel Hub.
*   **CPU-Optimized Backing**: The frontend connects to a heavily unbloated, CPU-optimized backend guaranteeing fast data delivery without relying on external GPUs.

---
*Maintained under the `feature/tripane-classic-ui` branch.*
