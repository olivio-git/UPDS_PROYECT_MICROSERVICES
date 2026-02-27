# Session Manager Service - Database Schema

```mermaid
erDiagram
    ActiveSessions {
        string _id PK "Session ID"
        string sessionId UK "Unique session identifier"
        string examId "Reference to exam"
        string sessionName "Display name"
        string examName "Exam display name"
        string sessionType "group_synchronized|individual_flexible"
        string status "scheduled|lobby_open|active|paused|completed|cancelled"
        datetime startedAt
        datetime endedAt
        object timing "Timing configuration"
        map individualSessions "Map of individual session data"
        object settings "Session configuration"
        object participants "Participant management"
        object questions "Question and response data"
        object stats "Real-time statistics"
        object technical "Server and connection info"
        string createdBy "User who created session"
        datetime createdAt
        datetime updatedAt
        datetime scheduledAt
        boolean lobbyActive
        datetime lobbyCreatedAt
        object memoryStats "Memory management statistics"
    }

    ParticipantStatus {
        string participantId PK "Embedded in ActiveSessions"
        string status "waiting|connected|in_progress|completed|disconnected"
        datetime joinedAt
        datetime lastActivity
        int currentQuestionIndex
        array answeredQuestions "Question IDs answered"
        int timeSpent "Total time in seconds"
        string ipAddress
        string userAgent
    }

    IndividualSessions {
        string candidateId PK "Embedded in ActiveSessions map"
        string subSessionId "Unique sub-session ID"
        datetime startedAt
        datetime expiresAt
        int timeAllowed "Time allowed in seconds"
        int autoSaveInterval "Auto-save interval in seconds"
        string status "waiting|active|completed|expired"
        datetime lastAutoSave
        int disconnections "Number of disconnections"
        datetime lastActivity
    }

    SessionResponses {
        string questionId PK "Embedded in ActiveSessions"
        string candidateId PK "Embedded in ActiveSessions"
        mixed response "Response data"
        int timeSpent "Time spent on question"
        datetime timestamp
        object evaluation "Response evaluation"
    }

    TimingConfig {
        object sessionWindow "start and end dates"
        int examDuration "Duration in minutes"
        boolean guaranteedTime "Whether time is guaranteed"
        string lateJoinPolicy "guaranteed|remaining|sliding"
        int maxLateness "Max lateness in minutes"
        int autoSaveInterval "Auto-save interval in seconds"
        int memoryCleanupInterval "Cleanup interval in minutes"
    }

    %% Relationships
    ActiveSessions ||--o{ ParticipantStatus : "manages participants"
    ActiveSessions ||--o{ IndividualSessions : "contains individual sessions"
    ActiveSessions ||--o{ SessionResponses : "stores responses"
    ActiveSessions ||--|| TimingConfig : "configured with"
```

## Field Details

### ActiveSessions Table
- **timing**: TimingConfig object for flexible sessions
- **individualSessions**: Map<candidateId, IndividualSessionData> for individual flexible sessions
- **settings**: {duration, autoStart, autoEnd, allowLateJoin, showResults, randomizeQuestions, maxAttempts, instructions, maxParticipants, requiresTechnicalVerification, allowOpenRegistration, registrationDeadline, competencies}
- **participants**: {registeredCandidates[], activeCandidates[], proctors[], status: Map<userId, ParticipantStatus>}
- **questions**: {totalQuestions, questionsPerCandidate: Map<candidateId, questionIds[]>, responses: SessionResponse[]}
- **stats**: {totalParticipants, activeParticipants, completedParticipants, averageProgress, averageTimeSpent}
- **technical**: {serverInstance, lastHeartbeat, connections}
- **memoryStats**: {totalSubSessions, activeSubSessions, lastCleanup, autoSaveJobs}

### ParticipantStatus (Embedded)
- Tracks real-time participant state within active sessions
- **answeredQuestions**: Array of question IDs that participant has answered
- **timeSpent**: Cumulative time spent in session

### IndividualSessions (Embedded Map)
- For individual_flexible session type only
- **subSessionId**: Format like "SESSION-ID.001", "SESSION-ID.002"
- **timeAllowed**: Individual time allocation in seconds
- **autoSaveInterval**: How often to auto-save responses
- **disconnections**: Count of network disconnections

### SessionResponses (Embedded Array)
- **evaluation**: {isCorrect, score, maxScore, feedback, evaluatedBy, evaluatedAt}
- Stores all responses within the active session for real-time processing

### TimingConfig (Embedded Object)
- **sessionWindow**: {start: Date, end: Date} - Available time window for flexible sessions
- **lateJoinPolicy**: How to handle late joiners (guaranteed time vs remaining time)
- **memoryCleanupInterval**: How often to clean expired individual sessions

### Indexes
- Primary: sessionId (unique)
- Secondary: sessionType+status, examId, participants arrays, createdAt, technical.lastHeartbeat, memoryStats.lastCleanup

### Session Types
1. **group_synchronized**: Traditional exam where all participants start/end together
2. **individual_flexible**: Participants can start within a time window and get individual time allocation

### Memory Management
- Automatic cleanup of expired individual sessions
- Memory statistics tracking for monitoring
- Auto-save functionality for individual sessions