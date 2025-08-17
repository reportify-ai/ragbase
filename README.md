# RAGBASE

A local RAG (Retrieval-Augmented Generation) application that enables users to chat, search, and conduct deep research with local files without any privacy concerns.

## Features

- 🔒 **Privacy-First**: All processing happens locally on your machine
- 💬 **Chat Interface**: Interactive chat with your documents
- 🔍 **Advanced Search**: Semantic search across your knowledge base
- 📚 **Document Processing**: Support for various file formats
- 🧠 **Local LLM Integration**: Works with local language models
- 🖥️ **Desktop App**: Native Tauri application
- ⚡ **Fast & Efficient**: Optimized for local processing

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Drizzle ORM
- **Desktop**: Tauri (Rust)
- **AI/ML**: Local LLM integration, Vector embeddings
- **Database**: SQLite with vector support

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Rust (for Tauri)
- Local LLM setup (optional)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/reportify-ai/ragbase.git
cd ragbase
```

2. Install dependencies:
```bash
npm install
```

## Getting Started

### Development Mode

```bash
# Install dependencies
npm install

# DB migration
npm run db

# Run development server
npm run dev

# Run Tauri development app
npm run tauri:dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Production Build

For building the desktop app:

```bash
# Build desktop app
npm run tauri:build
```

## Usage

1. **Setup Knowledge Base**: Add your documents to create a knowledge base
2. **Configure Models**: Set up your local LLM models
3. **Start Chatting**: Begin conversations with your documents
4. **Search & Research**: Use semantic search for deep document exploration

## Project Structure

```
ragbase/
├── src/
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/          # Utility libraries
│   └── db/           # Database schema and migrations
├── src-tauri/       # Tauri backend (Rust)
└── tests/           # Test files
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Database powered by [Drizzle ORM](https://orm.drizzle.team/)

## Support

- 📧 Email: support@ragbase.app
- 🐛 Issues: [GitHub Issues](https://github.com/reportify-ai/ragbase/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/reportify-ai/ragbase/discussions)

---

Made with ❤️ for the open source community