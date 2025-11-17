# GT3 Auto-Rickshaw Booking System (Gantavyam/RideSync)

## Purpose
GT3 (Gantavyam/RideSync) is a comprehensive auto-rickshaw booking platform similar to Uber/Lyft, specifically designed for auto-rickshaw services. It provides:
- Real-time ride booking and tracking
- Driver and passenger matching
- Voice-activated booking
- Scheduled rides and smart reminders
- Calendar integration
- Admin dashboard for fleet management
- OTP-based verification system

## Key Features
- **User Types**: Passengers, Drivers, Admins
- **Real-time Communication**: Socket.IO for live updates and ride tracking
- **Mapping**: Google Maps API integration + Leaflet for routes and tracking
- **Payment**: Flexible payment options, fare splitting, and dynamic fare management
- **Queue Management**: Advanced booth and queue system for organized pickups at stations
- **Manual Booking**: Admin can manually book rides with drag-and-drop interface
- **Driver Management**: Registration, approval, status tracking, info recovery
- **OTP System**: SMS-based OTP verification using Twilio
- **Metro Integration**: Metro station pickup locations
- **Analytics**: Ride analytics and financial reporting

## Recent Updates (Latest)
- **Security**: Fixed dependency conflicts and security vulnerabilities
- **OTP Integration**: Completed SMS-based OTP sending functionality (Twilio)
- **Fare Management**: Fixed fare calculation issues and added fare management system
- **Production Fixes**: Resolved data vanishing errors in production
- **Driver UI**: Completed driver side UI improvements
- **Drag-and-Drop Maps**: Added drag map functionality for user side
- **Manual Booking**: Completed manual ride booking from admin panel with online flow
- **Queue System**: Enhanced queue position management
- **Driver Fare Migration**: Implemented driver fare tracking in ride history

## Current Development State
The project is in active development with focus on:
- Production stability and bug fixes
- Enhanced fare calculation and management
- OTP verification system
- Driver experience improvements
- Admin tools for ride and driver management
- Queue optimization at pickup locations