const cds = require('@sap/cds');
const { generateNextId } = require('./helper');



module.exports = cds.service.impl(function () {
  const srv = this;
  const { Job, Candidates, JobApplications } = this.entities;

  // ---- hooks (run before the standard CAP CRUD handlers) ----
  this.before('CREATE', 'Candidates', onCandidateCreate);
  this.before('CREATE', 'Job', onJobCreate);

  // ---- custom action/function handlers ----
  this.on('applyForJob', applyForJob);
  this.on('getApplicationsForJob', getApplicationsForJob);
  this.on('reviewApplication', reviewApplication);



  // Candidate CREATE: assigns the next sequential candidateId before insert
  async function onCandidateCreate(req) {
    const tx = cds.tx(req);
    req.data.candidateId = await generateNextId(tx, 'CANDIDATE');
  }

  // Job CREATE: validates required fields and assigns the next sequential jobId before insert
  async function onJobCreate(req) {
    const { jobTitle, department, location } = req.data;

    if (!jobTitle || !department || !location) {
      return req.reject(400, 'jobTitle, department and location are all required');
    }

    const tx = cds.tx(req);
    req.data.jobId = await generateNextId(tx, 'JOB');
    console.log(`[STAGE] Job ${req.data.jobId} created.`);
  }



  // Candidate apply flow: matches an existing candidate by Aadhaar or creates a new one, then creates the application
  async function applyForJob(req) {
    const { jobId, firstName, lastName, email, mobileNumber, aadharNumber } = req.data;
    const tx = cds.tx(req);

    if (!jobId || !aadharNumber) {
      return req.error(400, 'jobId and aadharNumber are required');
    }

    const job = await tx.run(SELECT.one.from(Job).where({ jobId }));
    if (!job) {
      return req.error(404, `Job ${jobId} not found`);
    }

    let candidateId;
    let isNewCandidate;

    const existingCandidate = await tx.run(SELECT.one.from(Candidates).where({ aadharNumber }));

    if (existingCandidate) {
      candidateId = existingCandidate.candidateId;
      isNewCandidate = false;
      console.log(`[STAGE] Aadhaar matched existing candidate (${candidateId}). Reusing.`);

    } else {
      if (!firstName || !lastName || !email || !mobileNumber) {
        return req.error(400, 'firstName, lastName, email and mobileNumber are required for a new candidate');
      }

      isNewCandidate = true;

      // reuse the existing Candidate CREATE handler (onCandidateCreate assigns candidateId) instead of duplicating that logic here
      const newCandidateData = { firstName, lastName, email, mobileNumber, aadharNumber };
      await srv.create(Candidates).entries(newCandidateData);
      candidateId = newCandidateData.candidateId;
      console.log(`[STAGE] New candidate created: ${candidateId}.`);
    }

    const applicationId = await generateNextId(tx, 'APPLICATION');

    await tx.run(INSERT.into(JobApplications).entries({ applicationId, candidateId, jobId, status: 'APPLICATION_SUBMITTED' }));
    console.log(`[STAGE] Application ${applicationId} created (candidate ${candidateId} -> job ${jobId}).`);

    const candidate = await tx.run(SELECT.one.from(Candidates).where({ candidateId }));
    const application = await tx.run(SELECT.one.from(JobApplications).where({ applicationId }));

    return { candidate, isNewCandidate, application };
  }

  // TA's review screen: lists every application received for a job (read-only, nothing is saved here)
  async function getApplicationsForJob(req) {
    const { jobId } = req.data;
    const tx = cds.tx(req);

    if (!jobId) {
      return req.error(400, 'jobId is required');
    }

    const job = await tx.run(SELECT.one.from(Job).where({ jobId }));
    if (!job) {
      return req.error(404, `Job ${jobId} not found`);
    }

    return await tx.run(SELECT.from(JobApplications).where({ jobId }));
  }

  // TA's manual shortlist/reject/reupload decision for one application (rejection applies a 30-day re-apply cooldown)
  async function reviewApplication(req) {
    const { applicationId, decision, reason } = req.data;
    const tx = cds.tx(req);

    if (!applicationId || !decision) {
      return req.error(400, 'applicationId and decision are required');
    }

    const validDecisions = ['SHORTLISTED', 'REJECTED', 'RESUME_REUPLOAD_REQUESTED'];
    if (!validDecisions.includes(decision)) {
      return req.error(400, `decision must be one of: ${validDecisions.join(', ')}`);
    }

    const application = await tx.run(SELECT.one.from(JobApplications).where({ applicationId }));
    if (!application) {
      return req.error(404, `Application ${applicationId} not found`);
    }

    if (decision === 'REJECTED') {
      const rejectedAt = new Date();
      const eligibleFrom = new Date(rejectedAt);
      eligibleFrom.setDate(eligibleFrom.getDate() + 30);

      await tx.run(UPDATE(JobApplications).set({
        status: 'REJECTED',
        rejectionReason: reason || null,
        rejectedAt: rejectedAt.toISOString(),
        eligibleFrom: eligibleFrom.toISOString()
      }).where({ applicationId }));

      console.log(`[STAGE] Application ${applicationId} REJECTED. Cooldown until ${eligibleFrom.toISOString()}.`);

    } else {
      await tx.run(UPDATE(JobApplications).set({
        status: decision,
        rejectionReason: reason || null
      }).where({ applicationId }));

      console.log(`[STAGE] Application ${applicationId} set to ${decision}.`);
    }

    return await tx.run(SELECT.one.from(JobApplications).where({ applicationId }));
  }

});
