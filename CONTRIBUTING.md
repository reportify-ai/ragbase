# Contributing to RAGBASE

Thank you for your interest in contributing to RAGBASE! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We are committed to providing a welcoming and inspiring community for all.

## How Can I Contribute?

### Reporting Bugs

- Use the GitHub issue template
- Include detailed steps to reproduce
- Provide system information and error logs
- Check if the bug has already been reported

### Suggesting Enhancements

- Use the feature request template
- Describe the use case clearly
- Explain the expected behavior
- Consider the impact on existing features

### Code Contributions

- Fork the repository
- Create a feature branch
- Make your changes
- Add tests if applicable
- Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Local Development

1. **Fork and Clone**
   ```bash
   git clone https://github.com/reportify-ai/ragbase.git
   cd ragbase
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Database**
   ```bash
   npm run db
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Start Electron App (Optional)**
   ```bash
   npm run electron:dev
   ```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types
- Use descriptive variable names
- Avoid `any` type when possible

### React Components

- Use functional components with hooks
- Follow the existing component structure
- Use proper TypeScript interfaces for props
- Implement error boundaries where appropriate

### File Structure

```
src/
├── app/           # Next.js app router pages
├── components/    # Reusable UI components
├── lib/          # Utility functions and services
└── db/           # Database schema and migrations
```

### Naming Conventions

- **Files**: Use kebab-case (e.g., `file-card.tsx`)
- **Components**: Use PascalCase (e.g., `FileCard`)
- **Functions**: Use camelCase (e.g., `handleFileUpload`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `API_ENDPOINT`)

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(chat): add message history persistence`
- `fix(ui): resolve button alignment issue`
- `docs(readme): update installation instructions`

### Pull Request Process

1. **Create a descriptive PR title**
2. **Fill out the PR template**
3. **Include tests for new features**
4. **Update documentation if needed**
5. **Ensure all checks pass**

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new features
- Maintain good test coverage
- Use descriptive test names
- Follow the existing test patterns

## Documentation

### Code Comments

- Write clear, concise comments
- Explain complex logic
- Use JSDoc for functions and classes
- Keep comments up to date

### README Updates

- Update README for new features
- Include usage examples
- Update installation instructions if needed
- Add screenshots for UI changes

## Review Process

1. **Automated Checks**: All PRs must pass CI checks
2. **Code Review**: At least one maintainer must approve
3. **Testing**: Ensure all tests pass
4. **Documentation**: Update docs for new features

## Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: support@ragbase.app for urgent matters

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Project documentation

## License

By contributing to RAGBASE, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to RAGBASE! 🚀 