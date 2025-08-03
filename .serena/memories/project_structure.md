# Project Structure

```
gantavyam/gt3/
├── client/                    # Frontend React application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── admin/       # Admin-specific components
│   │   │   ├── driver/      # Driver-specific components
│   │   │   └── user/        # User-specific components
│   │   ├── pages/           # Page components (routes)
│   │   │   ├── admin/       # Admin pages
│   │   │   ├── driver/      # Driver pages
│   │   │   ├── user/        # User pages
│   │   │   └── test/        # Test/demo pages
│   │   ├── services/        # API calls and external services
│   │   ├── contexts/        # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Utility functions
│   │   ├── config/          # Configuration files
│   │   ├── App.js           # Main app component
│   │   └── index.js         # Entry point
│   └── package.json
│
├── server/                   # Backend Node.js/Express application
│   ├── models/              # Mongoose database models
│   ├── routes/              # API route definitions
│   │   └── admin/          # Admin-specific routes
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Express middleware
│   ├── services/            # Business logic
│   ├── utils/               # Utility functions
│   ├── config/              # Configuration files
│   ├── seeders/             # Database seeders
│   ├── server.js            # Express server setup
│   ├── index.js             # Entry point
│   ├── socket.js            # Socket.IO configuration
│   └── package.json
│
├── .serena/                 # Serena MCP server files
├── .claude/                 # Claude-specific files
├── ecosystem.config.js      # PM2 configuration
├── start-app.sh            # Application startup script
└── README.md               # Project documentation
```

## Key Directories
- **components/**: Organized by user type (admin, driver, user)
- **pages/**: Follows the same organization as components
- **services/**: Contains api.js for HTTP requests and socket.js for WebSocket
- **models/**: MongoDB schemas for User, Driver, Ride, etc.
- **routes/**: RESTful API endpoints organized by resource