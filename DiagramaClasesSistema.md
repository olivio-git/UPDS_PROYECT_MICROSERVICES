classDiagram
    %% Core User Management
    class User {
        +ObjectId _id
        +String email
        +String password
        +String firstName
        +String lastName
        +String role
        +String status
        +Object profile
        +Array permissions
        +Date createdAt
        +Date updatedAt
        +Date lastLogin
        +Object teacherData
        +Object proctorData
        +login()
        +logout()
        +updateProfile()
        +changePassword()
        +hasPermission(permission)
        +isActive()
    }

    class Candidate {
        +ObjectId _id
        +Object personalInfo
        +Object academicInfo
        +Object technicalSetup
        +Array examHistory
        +String status
        +ObjectId registeredBy
        +String notes
        +Date createdAt
        +Date updatedAt
        +register()
        +verify()
        +updateTechnicalSetup()
        +getExamHistory()
        +isEligibleForLevel(level)
        +calculateTargetLevel()
    }

    %% Academic Content Management
    class Level {
        +ObjectId _id
        +String code
        +String name
        +String description
        +Object competencyRequirements
        +Number overallMinScore
        +Boolean isActive
        +ObjectId createdBy
        +Date createdAt
        +Date updatedAt
        +validateScore(scores)
        +getRequirements()
        +activate()
        +deactivate()
    }

    class Rubric {
        +ObjectId _id
        +String name
        +String competency
        +String level
        +Array criteria
        +String scoringType
        +Number maxScore
        +Boolean isActive
        +ObjectId createdBy
        +Date createdAt
        +Date updatedAt
        +calculateScore(response)
        +validateCriteria()
        +clone()
        +export()
    }

    class Question {
        +ObjectId _id
        +String type
        +String competency
        +String level
        +Number difficulty
        +Object content
        +Object metadata
        +Object statistics
        +Boolean isActive
        +ObjectId createdBy
        +ObjectId reviewedBy
        +Date createdAt
        +Date updatedAt
        +Date lastUsed
        +evaluate(response)
        +updateStatistics()
        +clone()
        +validate()
        +getAudioFile()
        +assignToPool()
    }

    class Exam {
        +ObjectId _id
        +String name
        +String description
        +String type
        +String targetLevel
        +Object structure
        +Object configuration
        +Array questionPool
        +Boolean isActive
        +Boolean isTemplate
        +ObjectId createdBy
        +ObjectId approvedBy
        +Date createdAt
        +Date updatedAt
        +generateQuestions(candidateId)
        +validateStructure()
        +calculateDuration()
        +clone()
        +activate()
        +getQuestionPool(competency)
    }

    %% Session Management
    class ExamSession {
        +ObjectId _id
        +ObjectId examId
        +String sessionName
        +Object scheduling
        +Object participants
        +Object settings
        +String status
        +Object stats
        +ObjectId createdBy
        +Date createdAt
        +Date updatedAt
        +schedule()
        +start()
        +end()
        +addCandidate(candidateId)
        +addProctor(proctorId)
        +checkCapacity()
        +generateReport()
        +cancel()
        +getActiveParticipants()
    }

    class ExamResult {
        +ObjectId _id
        +ObjectId candidateId
        +ObjectId examId
        +ObjectId sessionId
        +Array responses
        +Object scores
        +Object timing
        +Object feedback
        +Object technicalInfo
        +String status
        +Boolean notificationSent
        +Boolean certificateGenerated
        +Date createdAt
        +Date updatedAt
        +calculateScores()
        +generateFeedback()
        +determineLevel()
        +sendNotification()
        +generateCertificate()
        +getCompetencyScore(competency)
        +isPassed()
        +exportResults()
    }

    %% Response Management
    class Response {
        +ObjectId questionId
        +String competency
        +Object response
        +Object evaluation
        +Number timeSpent
        +Number attempts
        +evaluate()
        +autoGrade()
        +humanGrade()
        +aiGrade()
        +getScore()
        +getFeedback()
    }

    class Evaluation {
        +Boolean isCorrect
        +Number score
        +Number maxScore
        +String feedback
        +String evaluatedBy
        +ObjectId evaluatorId
        +Date evaluatedAt
        +Array rubricScores
        +calculate()
        +validate()
        +addFeedback()
    }

    %% Support Classes
    class AuditLog {
        +ObjectId _id
        +ObjectId userId
        +String action
        +String resource
        +ObjectId resourceId
        +Object details
        +Object metadata
        +Date timestamp
        +String severity
        +log()
        +query()
        +export()
    }

    class SystemConfig {
        +ObjectId _id
        +String category
        +String key
        +Mixed value
        +String description
        +String dataType
        +Boolean isEncrypted
        +ObjectId lastModifiedBy
        +Date lastModifiedAt
        +Number version
        +get()
        +set()
        +validate()
        +encrypt()
        +decrypt()
    }

    class Notification {
        +ObjectId _id
        +ObjectId recipientId
        +String recipientType
        +String type
        +String channel
        +Object content
        +Object delivery
        +Object metadata
        +Date createdAt
        +Date updatedAt
        +send()
        +retry()
        +markDelivered()
        +markFailed()
        +isExpired()
    }

    %% File Management
    class FileStorage {
        +ObjectId _id
        +String filename
        +String contentType
        +Number size
        +String path
        +Object metadata
        +Date uploadedAt
        +ObjectId uploadedBy
        +upload()
        +download()
        +delete()
        +getUrl()
        +validateType()
    }

    %% AI/ML Services
    class AIService {
        +String modelName
        +String version
        +Object configuration
        +evaluateWriting(text, level)
        +evaluateSpeaking(audioFile, level)
        +generateQuestions(level, competency)
        +provideFeedback(response, rubric)
        +detectLanguageLevel(text)
        +scoreResponse(response, rubric)
    }

    class GradingEngine {
        +gradeMultipleChoice(response)
        +gradeOpenText(response, rubric)
        +gradeAudio(audioFile, rubric)
        +gradeEssay(text, rubric)
        +calculateCompetencyScore(responses)
        +determineLevel(scores)
        +generateFeedback(scores, level)
    }

    %% Real-time Services
    class SessionManager {
        +ObjectId sessionId
        +Map participants
        +String status
        +Date startTime
        +joinSession(participantId)
        +leaveSession(participantId)
        +updateProgress(participantId, progress)
        +broadcastUpdate(data)
        +endSession()
        +getParticipants()
        +monitorActivity()
    }

    class RealtimeMonitor {
        +ObjectId sessionId
        +Array connections
        +Object stats
        +connect(userId)
        +disconnect(userId)
        +broadcastToProctors(data)
        +updateCandidateStatus(candidateId, status)
        +logIncident(incident)
        +getSessionStats()
    }

    %% Analytics and Reporting
    class ReportGenerator {
        +generateSessionReport(sessionId)
        +generateCandidateReport(candidateId)
        +generateCompetencyReport(competency)
        +generateLevelReport(level)
        +exportToPDF(data)
        +exportToCSV(data)
        +exportToExcel(data)
        +scheduleReport(reportType, schedule)
    }

    class Analytics {
        +getCandidateStats()
        +getSessionStats()
        +getQuestionStats()
        +getCompetencyTrends()
        +getLevelDistribution()
        +getPerformanceMetrics()
        +generateDashboardData(role)
        +predictPerformance(candidateId)
    }

    %% Security and Validation
    class AuthService {
        +authenticate(email, password)
        +generateJWT(user)
        +validateToken(token)
        +refreshToken(token)
        +resetPassword(email)
        +changePassword(userId, oldPassword, newPassword)
        +validatePermissions(userId, resource, action)
    }

    class ValidationService {
        +validateEmail(email)
        +validatePassword(password)
        +validateQuestionContent(question)
        +validateExamStructure(exam)
        +validateCandidateData(candidate)
        +validateSessionSchedule(session)
    }

    %% Relationships
    User "1" --> "many" Candidate : registers
    User "1" --> "many" Question : creates
    User "1" --> "many" Exam : creates
    User "1" --> "many" ExamSession : creates
    User "1" --> "many" Rubric : creates
    User "1" --> "many" Level : creates
    User "1" --> "many" AuditLog : generates

    Candidate "1" --> "many" ExamResult : has
    Candidate "many" --> "many" ExamSession : participates_in

    Level "1" --> "many" Question : categorizes
    Level "1" --> "many" Rubric : applies_to
    Level "1" --> "many" Exam : targets

    Rubric "1" --> "many" Question : evaluates
    Rubric "1" --> "many" Response : scores

    Question "many" --> "1" Exam : belongs_to
    Question "1" --> "many" Response : generates

    Exam "1" --> "many" ExamSession : instantiates
    Exam "1" --> "many" ExamResult : produces

    ExamSession "1" --> "many" ExamResult : contains
    ExamSession "1" --> "1" SessionManager : managed_by

    ExamResult "1" --> "many" Response : contains
    Response "1" --> "1" Evaluation : has

    FileStorage "many" --> "1" Question : stores_media
    FileStorage "many" --> "1" Response : stores_recordings

    AIService "1" --> "1" GradingEngine : powers
    GradingEngine "1" --> "many" Response : evaluates

    SessionManager "1" --> "1" RealtimeMonitor : uses
    RealtimeMonitor "1" --> "many" ExamSession : monitors

    Analytics "1" --> "1" ReportGenerator : feeds
    ReportGenerator "1" --> "many" User : serves

    AuthService "1" --> "many" User : authenticates
    ValidationService "1" --> "many" User : validates
    ValidationService "1" --> "many" Question : validates
    ValidationService "1" --> "many" Exam : validates
    ValidationService "1" --> "many" Candidate : validates

    Notification "many" --> "1" User : notifies
    Notification "many" --> "1" Candidate : notifies

    %% Styling
    style User fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    style Candidate fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    style AuthService fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000
    
    style Level fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    style Rubric fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    style Question fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    style Exam fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    
    style ExamSession fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    style ExamResult fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    style Response fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    style Evaluation fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    style SessionManager fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    style RealtimeMonitor fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    
    style AIService fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    style GradingEngine fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    style Analytics fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    style ReportGenerator fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    style ValidationService fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    
    style AuditLog fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000
    style SystemConfig fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000
    style Notification fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000
    style FileStorage fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000