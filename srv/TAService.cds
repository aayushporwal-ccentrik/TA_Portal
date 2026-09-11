using { ta.transaction as txn, ta.master as master } from '../db/schema';

service TAService {
    entity Job as projection on txn.Job;



  entity Candidates as projection on master.Candidate;
  entity Educations as projection on master.Educations;
  entity Documents  as projection on master.Documents;

  // explicit projection so applyForJob/reviewApplication can reference it by name below
  entity JobApplications as projection on txn.JobApplications;

  // Candidate applies for a job: reuses an existing candidate by Aadhaar or creates a new one, then creates the application
  action applyForJob(
    jobId        : String(50),
    firstName    : String(100),
    lastName     : String(100),
    email        : String(150),
    mobileNumber : String(15),
    aadharNumber : String(20)
  ) returns {
    candidate      : Association to one Candidates;
    isNewCandidate : Boolean;
    application    : Association to one JobApplications;
  };

  // TA's review screen: lists every application received for a given job (read-only)
  function getApplicationsForJob(jobId : String(50)) returns array of JobApplications;

  // TA's shortlist/reject/reupload decision on one application
  action reviewApplication(
    applicationId : String(50),
    decision      : String(30),
    reason        : String(500)
  ) returns JobApplications;

}
