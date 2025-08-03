# Task Completion Checklist

When completing any coding task in this project, ensure you:

## 1. Code Quality
- [ ] Follow existing code style (2-space indentation, single quotes)
- [ ] Use functional components and hooks for React
- [ ] Implement proper error handling with try-catch
- [ ] Add validation where appropriate

## 2. Testing
- [ ] Test the feature manually in the browser
- [ ] Check browser console for errors
- [ ] Test with different user roles (admin, driver, user)
- [ ] Verify Socket.IO connections if real-time features are involved

## 3. API Integration
- [ ] Ensure frontend API calls match backend routes
- [ ] Handle loading states and errors in UI
- [ ] Check authentication tokens are properly sent

## 4. Before Committing
- [ ] Run the application and verify no regressions
- [ ] Check `git status` for unintended changes
- [ ] Review changed files for debugging code/console.logs
- [ ] Ensure no sensitive data in code (use .env files)

## 5. Documentation
- [ ] Update relevant documentation if adding new features
- [ ] Add comments only for complex logic
- [ ] Update .env.example if new environment variables added

Note: Currently no linting or automated testing is configured. Manual testing is essential.