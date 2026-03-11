# Congress Accountability Tracker

This is a web app that tracks the accountability of congress members. It uses multiple government APIs to provide comprehensive insights into congressional activity and political influence.

## Data Sources

### Primary APIs
- **CapitolTrades API**: Tracks stock trades made by Congress members
- **Congress.gov API**: Legislative data including bills, votes, and member information
- **OpenFEC API**: Federal Election Commission campaign finance data

### Additional APIs (Optional)
- **USAspending API**: Federal spending and contract data
- **Census API**: Demographic and economic data for district context

## Backend Architecture

The backend is written in Rust and uses the Axum web framework. It provides RESTful API endpoints that aggregate data from multiple government sources.

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/politicians` | Congress members from CapitolTrades |
| `/api/trades` | Stock trades by Congress members |
| `/api/congress/bills` | Legislative bills from Congress.gov |
| `/api/congress/members` | Member information from Congress.gov |
| `/api/fec/candidates` | Campaign candidates from OpenFEC |
| `/api/fec/receipts` | Campaign contributions from OpenFEC |

## Getting Started

### Prerequisites
- Rust (latest stable)
- Node.js 18+ (for frontend)
- API keys for the services you want to use

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd congress-tracker
   ```

2. **Set up API keys**
   ```bash
   ./setup-api-keys.sh
   ```
   Then edit the `.env` file with your actual API keys.

3. **Start the backend server**
   ```bash
   cd backend
   cargo run --bin backend_server
   ```

4. **Start the frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4020

## Environment Variables

See `.env.example` for all available environment variables.

## Development

### Backend Structure
```
backend/
├── crates/
│   ├── capitoltrades_api/    # CapitolTrades API client
│   ├── congress_api/         # Congress.gov API client
│   ├── openfec_api/          # OpenFEC API client
│   └── backend_server/       # Axum web server
├── Cargo.toml
└── README.md
```

### Frontend Structure
```
frontend/
├── app/                      # Next.js app directory
├── components/               # React components
├── lib/                      # Utilities and services
└── public/                   # Static assets
```

## License

MIT
