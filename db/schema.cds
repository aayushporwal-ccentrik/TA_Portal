namespace ta;
 
using { cuid, managed } from '@sap/cds/common';
 
context master {
 
    entity Candidate : managed {
 
        key candidateId : String(50);
 
        // Basic Information
        firstName       : String(100);
        lastName        : String(100);
        email           : String(150);
        mobileNumber    : String(15);
 
        // Personal Information
        dateOfBirth     : Date;
        gender          : String(20);
        aadharNumber    : String(20);
        maritalStatus   : String(20);
 
        // Current Address
        currentAddress  : String(500);
        currentCity     : String(100);
        currentState    : String(100);
        currentPincode  : String(10);
 
        // Permanent Address
        permanentAddress : String(500);
        permanentCity    : String(100);
        permanentState   : String(100);
        permanentPincode : String(10);
 
        // Professional Information
        experienceType     : String(20);
        currentCompany      : String(200);
        currentDesignation : String(200);
        totalExperience    : Decimal(4,1);
        currentCTC         : Decimal(12,2);
        expectedCTC        : Decimal(12,2);
        noticePeriod       : String(50);
        lastWorkingDay     : Date;
 
        willingToRelocate : Boolean;
 
        educations   : Composition of many Educations             on educations.candidateId   = $self.candidateId;
        documents    : Composition of many Documents               on documents.candidateId    = $self.candidateId;
        applications : Composition of many transaction.JobApplications on applications.candidateId = $self.candidateId;
    }
 
    entity Counter : managed {
        key type   : String;
        lastNumber : Integer;
    }
 
    entity Educations : cuid {
 
        candidateId : String(50);
 
        qualification  : String(100);
        specialization : String(150);
        institute      : String(200);
        passingYear    : Integer;
        percentageCgpa : String(20);
    }
 
    entity Documents : cuid, managed {
 
        candidateId : String(50);
        docType     : String(50);
        docName     : String(100);
        fileUrl     : String(500);
 
        // TA verifies these BEFORE the offer goes out — this is the first
        // of two verification passes (HR does the second, later, on the
        // full onboarding package)
        verifiedBy         : String(50);
        verifiedAt         : Timestamp;
        rejectionReason    : String(500);
    }


    entity LookupValue : cuid {
 
    type   : String(50);
    code   : String(50);
    text   : String(100);
    active : Boolean default true;
}

}
 
 
context transaction {
 
    entity Job : managed {
 
        key jobId : String(50);
 
        // Job Information
        jobTitle       : String(200);
        jobDescription : LargeString;
 
        department : String(100);
        location   : String(100);
 
        // Experience Requirement
        experienceMin : Decimal(4,1);
        experienceMax : Decimal(4,1);
 
        // Skills / Requirements
        requiredSkills : LargeString;
 
        applications : Composition of many JobApplications on applications.jobId = $self.jobId;
    }
 
    entity JobApplications : managed {
 
        key applicationId : String(50);
 
        candidateId : String(50);
        jobId       : String(50);
 
        status : String(30) default 'APPLIED';  // APPLIED / SHORTLISTED / REJECTED / OFFERED / ACCEPTED
        //cooldown
        rejectedAt   : Timestamp;
        eligibleFrom : Timestamp;
 
    }
 
entity OnboardingFormToken : cuid, managed {
    applicationId : String(50);
    token     : String(100);
    expiresAt : Timestamp;
}
 

}
 
 
 