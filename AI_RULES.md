# AI Development Rules & Tech Stack

## Tech Stack
- **Framework**: React with Vite
- **Language**: TypeScript
- **Routing**: React Router (Routes defined in `src/App.tsx`)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **UI Components**: shadcn/ui (built on Radix UI)
- **State Management**: React Hooks (useState, useReducer, useContext)

## Architecture & File Structure
- **Pages**: Located in `src/pages/`. The entry point is `src/pages/Index.tsx`.
- **Components**: Located in `src/components/`.
- **Naming Conventions**: Directory names must be all lower-case (e.g., `src/pages`). Component files should use PascalCase (e.g., `Button.tsx`).
- **File Size**: Aim for components under 100 lines. Refactor and split into smaller files when they exceed this limit.

## Development Rules
- **Component Creation**: Create a new file for every new component or hook. Do not add multiple components to a single file.
- **Styling**: Always use Tailwind CSS classes for layout, spacing, and design. Avoid inline styles or separate CSS files unless absolutely necessary.
- **UI Consistency**: Prioritize using shadcn/ui components. If a modification is needed, create a wrapper component rather than editing the base shadcn file.
- **Simplicity**: Do not overengineer. Focus on the direct request with the simplest, most elegant solution.
- **Error Handling**: Do not use silent try/catch blocks unless specifically requested; allow errors to bubble up for better debugging.
- **Responsiveness**: All designs must be responsive and mobile-friendly by default using Tailwind's responsive modifiers.