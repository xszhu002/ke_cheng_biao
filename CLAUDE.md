# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a web-based course schedule management system (网页版课程表管理系统) built with Node.js/Express backend and vanilla JavaScript frontend. It supports multi-teacher schedule management, drag-and-drop course rearrangement, special care scheduling, and calendar management.

## Development Commands

### Setup and Initialization
```bash
npm install                    # Install dependencies
npm run init-db               # Initialize SQLite database with tables and sample data
```

### Running the Application
```bash
npm start                     # Start production server on port 3000
npm run dev                   # Start development server with nodemon (auto-restart)
```

### Database Management
```bash
npm run init-db               # Reset and initialize database with sample data
```

## Architecture Overview

### Backend Structure
- **server.js**: Main Express server with all API routes
- **database/schedule.db**: SQLite database file
- **scripts/init-db.js**: Database initialization script

### Frontend Structure
- **public/index.html**: Main application interface with 9x5 schedule grid
- **public/js/**:
  - `app.js`: Main application controller and initialization
  - `schedule.js`: Schedule rendering and management
  - `dragdrop.js`: HTML5 drag-and-drop functionality for course rearrangement
  - `calendar.js`: Calendar view and special care date management
  - `api.js`: API communication layer
  - `utils.js`: Utility functions
- **public/css/**: Modular CSS files for different components

### Database Schema
Key tables:
- `teachers`: Teacher information
- `semester_config`: Academic semester settings
- `schedules`: Teacher schedule instances
- `course_arrangements`: Individual course slots (regular and special_care types)
- `operation_history`: Change tracking

### Key Features
- **Time Slots**: 9 time periods (8 regular + 1 special care)
  - Regular: 上午1-3, 午间管理, 下午1-3, 晚托
  - Special: 特需托管 (specific date-based scheduling)
- **Drag & Drop**: HTML5 API for moving courses between time slots
- **Multi-Teacher Support**: Switch between different teacher schedules
- **Week Navigation**: Navigate through semester weeks
- **Special Care Management**: Date-specific scheduling outside regular weekly pattern

## API Structure

### Teachers
- `GET /api/teachers` - List all teachers
- `POST /api/teachers` - Create new teacher

### Schedules
- `GET /api/schedules/teacher/:teacherId` - Get teacher's schedule
- `GET /api/schedules/:scheduleId/week/:week` - Get week-specific courses

### Courses
- `PUT /api/courses/:id/move` - Move course to new time slot

### Special Care
- `GET /api/special-care/schedule/:scheduleId` - List special care items
- `POST /api/special-care` - Add special care item
- `PUT /api/special-care/:id` - Update special care item
- `DELETE /api/special-care/:id` - Delete special care item

### Calendar
- `GET /api/calendar/semester/current` - Get current semester configuration

## Development Notes

- Uses vanilla JavaScript (no frameworks) for frontend
- SQLite for simple file-based data persistence
- Responsive design with CSS Grid for schedule layout
- Time zone handling for Beijing Time (GMT+8)
- Operation history tracking for course movements
- Drag-and-drop conflict validation to prevent scheduling conflicts