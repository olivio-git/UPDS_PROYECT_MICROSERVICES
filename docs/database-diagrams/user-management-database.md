# User Management Service - Database Schema

```mermaid
erDiagram
    Users {
        ObjectId _id PK
        string email UK "Unique email address"
        string firstName "First name"
        string lastName "Last name"
        string role "admin|teacher|proctor|student"
        string status "active|inactive|suspended|pending"
        object profile "User preferences and settings"
        array permissions "Resource permissions"
        datetime createdAt
        datetime updatedAt
        datetime lastLogin "Last login timestamp"
        object teacherData "Teacher-specific data"
        object proctorData "Proctor-specific data"
        string authServiceUserId "ID from auth service"
        datetime lastSync "Last sync with auth service"
        string createdBy "User who created this record"
    }

    Candidates {
        ObjectId _id PK
        ObjectId userId FK "Reference to Users"
        object personalInfo "Name, email, phone, nationality, etc"
        object academicInfo "Current/target level, institution, etc"
        object technicalSetup "Camera, microphone, internet setup"
        array examHistory "Previous exam results"
        string status "registered|active|inactive|suspended"
        ObjectId registeredBy FK "User who registered this candidate"
        string notes "Optional notes"
        datetime createdAt
        datetime updatedAt
    }

    Roles {
        ObjectId _id PK
        string name "Role name"
        string description "Role description"
        array permissions "Default permissions for role"
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    %% Relationships
    Users ||--o{ Candidates : "can register"
    Users }o--|| Roles : "has role"
    Candidates }o--|| Users : "belongs to"
    Users ||--o{ Users : "created by"
```

## Field Details

### Users Table
- **profile**: Contains user preferences (language, timezone, notifications)
- **permissions**: Array of {resource: string, actions: string[]}
- **teacherData**: {department: string, specialization: string[], experience: number}
- **proctorData**: {certificationLevel: string, languages: string[], maxSimultaneousSessions: number}

### Candidates Table
- **personalInfo**: {firstName, lastName, email, phone, dateOfBirth, nationality, identification, address}
- **academicInfo**: {currentLevel: MCERLevel, targetLevel: MCERLevel, studyPurpose, institution, previousExperience}
- **technicalSetup**: {hasCamera: boolean, hasMicrophone: boolean, hasStableInternet: boolean, browser, operatingSystem}
- **examHistory**: Array of {examId, sessionId, date, level, result, overallScore, competencyScores}

### Indexes
- Users: email (unique), role, status, authServiceUserId
- Candidates: userId, status, registeredBy, personalInfo.email
- Roles: name (unique), isActive