# Exam Service - Database Schema

```mermaid
erDiagram
    Exams {
        ObjectId _id PK
        string name "Exam name"
        string description "Exam description"
        string type "placement|progress|final|mock|practice"
        string targetLevel "A1|A2|B1|B2|C1|C2"
        object structure "Sections, duration, passing score"
        object configuration "Randomization, review, attempts config"
        array questionPool "Array of Question ObjectIds"
        boolean isActive
        boolean isTemplate
        ObjectId createdBy FK "Reference to User"
        ObjectId approvedBy FK "Reference to User"
        datetime createdAt
        datetime updatedAt
    }

    Questions {
        ObjectId _id PK
        string type "multiple_choice|true_false|open_text|essay|fill_blanks|drag_drop|matching|ordering|audio_response|file_upload"
        string competency "reading|writing|listening|speaking|grammar|vocabulary"
        string level "A1|A2|B1|B2|C1|C2"
        int difficulty "1-5 difficulty scale"
        object content "Question text, options, media, correct answers"
        object metadata "Topic, tags, time, points, rubricId"
        object statistics "Usage stats, average score/time"
        boolean isActive
        ObjectId createdBy FK "Reference to User"
        ObjectId reviewedBy FK "Reference to User"
        datetime createdAt
        datetime updatedAt
        datetime lastUsed
    }

    Sessions {
        ObjectId _id PK
        ObjectId examId FK "Reference to Exams"
        ObjectId user FK "Reference to User"
        string sessionName "Session name"
        object scheduling "Start/end dates, time slots"
        object participants "Candidates, proctors, capacity"
        object settings "Proctor, recording, lockdown settings"
        string status "scheduled|in_progress|completed|cancelled|expired"
        object stats "Registration and completion stats"
        string sessionType "Session type"
        object timing "Timing configuration"
        number finalScore "Final exam score"
        number maxScore "Maximum possible score"
        boolean isEvaluated "Whether session is evaluated"
        datetime evaluatedAt
        datetime completedAt
        ObjectId createdBy FK "Reference to User"
        datetime createdAt
        datetime updatedAt
    }

    Responses {
        ObjectId _id PK
        ObjectId sessionId FK "Reference to Sessions"
        ObjectId candidateId FK "Reference to external Candidate"
        ObjectId examId FK "Reference to Exams"
        ObjectId questionId FK "Reference to Questions"
        string competency "reading|writing|listening|speaking"
        object response "Answer data with type and content"
        mixed answer "Direct answer access"
        object evaluation "Score, feedback, evaluator info"
        boolean isEvaluated
        datetime evaluatedAt
        int timeSpent "Time spent in seconds"
        int attempts "Number of attempts"
        datetime submittedAt
        datetime createdAt
        datetime updatedAt
    }

    Levels {
        ObjectId _id PK
        string code UK "A1|A2|B1|B2|C1|C2"
        string name "Level name"
        string description "Level description"
        object competencyRequirements "Min scores for each competency"
        int overallMinScore "Overall minimum score"
        boolean isActive
        ObjectId createdBy FK "Reference to User"
        datetime createdAt
        datetime updatedAt
    }

    Rubrics {
        ObjectId _id PK
        string name "Rubric name"
        string competency "reading|writing|listening|speaking"
        string level "A1|A2|B1|B2|C1|C2"
        array criteria "Evaluation criteria with weights and levels"
        string scoringType "holistic|analytic"
        int maxScore "Maximum score"
        boolean isActive
        ObjectId createdBy FK "Reference to User"
        datetime createdAt
        datetime updatedAt
    }

    Users {
        ObjectId _id PK
        string level "User level for exam references"
        string difficulty "User difficulty"
        boolean isActive
        ObjectId createdBy FK
        datetime createdAt
        datetime updatedAt
    }

    Attempts {
        ObjectId _id PK
        ObjectId candidateId FK "Reference to external Candidate"
        ObjectId examId FK "Reference to Exams"
        ObjectId sessionId FK "Reference to Sessions"
        array responses "Array of Response ObjectIds"
        object scores "Competency and overall scores"
        object timing "Start, end, duration info"
        object feedback "Generated feedback"
        object technicalInfo "Browser, device info"
        string status "in_progress|completed|abandoned"
        boolean notificationSent
        boolean certificateGenerated
        datetime createdAt
        datetime updatedAt
    }

    %% Relationships
    Exams ||--o{ Sessions : "instantiated in"
    Exams ||--o{ Questions : "contains"
    Exams }o--|| Levels : "targets"
    Sessions ||--o{ Responses : "generates"
    Sessions ||--o{ Attempts : "contains"
    Questions ||--o{ Responses : "answered in"
    Questions }o--|| Rubrics : "evaluated with"
    Questions }o--|| Levels : "categorized by"
    Levels ||--o{ Rubrics : "applies to"
    Users ||--o{ Exams : "creates"
    Users ||--o{ Questions : "creates"
    Users ||--o{ Sessions : "creates"
    Users ||--o{ Levels : "creates"
    Users ||--o{ Rubrics : "creates"
```

## Field Details

### Exams Table
- **structure**: {sections: Array<{name, competency, duration, questionCount, weight}>, totalDuration, passingScore}
- **configuration**: {randomizeQuestions, allowReview, showResults, attemptsAllowed, timeBetweenAttempts}

### Questions Table
- **content**: Question text, instructions, context, mediaUrl, options, correctAnswer, keywords, templates, items, audio prompts
- **metadata**: {topic, subtopic, tags, estimatedTime, points, rubricId}
- **statistics**: {timesUsed, averageScore, averageTime, difficulty}

### Sessions Table
- **scheduling**: {startDate, endDate, timeSlots: Array<{date, startTime, endTime, capacity, enrolled}>}
- **participants**: {maxCandidates, registeredCandidates[], proctors[], currentActive}
- **settings**: {requireProctor, enableRecording, enableLockdown, allowLateEntry, lateEntryMinutes}
- **stats**: {totalRegistered, totalCompleted, totalAbandoned, averageScore}

### Responses Table
- **response**: {type, answer, selectedOptions, audioUrl, fileUrl, text}
- **evaluation**: {isCorrect, score, maxScore, feedback, evaluatedBy, evaluatorId, evaluatedAt, rubricScores}

### Levels Table
- **competencyRequirements**: {reading, writing, listening, speaking: {minScore, description, canDoStatements}}

### Rubrics Table
- **criteria**: Array<{name, description, weight, levels: Array<{score, description, examples}>}>

### Indexes
- Exams: name, type+targetLevel, isActive+isTemplate, createdBy
- Questions: type+competency+level, metadata.tags, isActive, createdBy
- Sessions: examId+status, scheduling dates, participants, status, createdBy
- Responses: sessionId+candidateId+questionId, candidateId+examId, questionId, competency
- Levels: isActive
- Rubrics: competency+level, isActive