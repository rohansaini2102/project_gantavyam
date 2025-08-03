# Code Style and Conventions

## General
- **Language**: JavaScript (ES6+)
- **No TypeScript**: Pure JavaScript throughout
- **Module System**: CommonJS in backend (require/module.exports), ES6 modules in frontend (import/export)

## Frontend (React)
- **Components**: Functional components with hooks
- **File Naming**: PascalCase for components (e.g., `UserDashboard.js`)
- **Component Structure**:
  ```javascript
  import React, { useState, useEffect } from 'react';
  const ComponentName = () => {
    // hooks first
    // handlers/functions
    // effects
    // return JSX
  };
  export default ComponentName;
  ```
- **State Management**: useState, useContext, custom hooks
- **Async Operations**: Axios with try-catch blocks
- **Props**: Destructured in function parameters

## Backend (Node.js/Express)
- **File Structure**: MVC pattern (models, routes, controllers)
- **Naming**: camelCase for variables/functions, PascalCase for models
- **Error Handling**: Try-catch blocks with appropriate status codes
- **Middleware**: Separate middleware folder
- **Database Models**: Mongoose schemas with validation
- **API Routes**: RESTful conventions (/api/resource)

## Common Patterns
- **Comments**: Minimal, code should be self-documenting
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Used consistently
- **Async/Await**: Preferred over callbacks
- **Environment Variables**: All caps with underscores (e.g., `REACT_APP_API_URL`)